"use client";

// Vigia de inatividade. Duas responsabilidades, as duas no navegador porque é lá
// que se sabe se a pessoa está usando o sistema:
//
//  1. **Renovar** a sessão enquanto há atividade real — um ping em
//     `/api/auth/session`, único endpoint que reemite o cookie do Auth.js.
//     Sem atividade não há ping, e o token vence sozinho no servidor.
//  2. **Encerrar** ao completar o tempo ocioso: avisa o servidor (para a
//     auditoria registrar que foi expiração) e manda para o login.
//
// O relógio mora no localStorage, então **abas contam juntas**: trabalhar em uma
// aba não deixa a outra expirar. A renovação só sai se houve atividade desde a
// última — é o que impede uma aba esquecida aberta de manter a sessão viva para
// sempre.

import { useEffect, useRef } from "react";
import {
  CHECK_MS, IDLE_MS, LAST_ACTIVITY_KEY, LAST_EMAIL_KEY, PING_MS,
} from "@/lib/sessionPolicy";

/** Espaçamento mínimo entre gravações do relógio (não escrever a cada tecla). */
const WRITE_THROTTLE_MS = 10_000;

function readActivity(): number {
  try {
    const n = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function SessionWatch({ email }: { email: string | null }) {
  const leaving = useRef(false);
  const lastWrite = useRef(0);
  const lastPing = useRef(0);

  // E-mail do último login, para a tela de login devolvê-lo preenchido quando a
  // sessão expirar. Só o e-mail — nada de senha, nada de token.
  useEffect(() => {
    if (!email) return;
    try { localStorage.setItem(LAST_EMAIL_KEY, email); } catch { /* modo privado */ }
  }, [email]);

  useEffect(() => {
    const write = (now: number) => {
      lastWrite.current = now;
      try { localStorage.setItem(LAST_ACTIVITY_KEY, String(now)); } catch { /* modo privado */ }
    };

    const touch = () => {
      const now = Date.now();
      if (now - lastWrite.current < WRITE_THROTTLE_MS) return;
      write(now);
    };

    const expire = async () => {
      if (leaving.current) return;
      leaving.current = true;
      // Best-effort: se a chamada falhar, a saída acontece do mesmo jeito — o
      // token já está vencido (ou a um passo disso) no servidor.
      try {
        await fetch("/api/session/expire", { method: "POST", cache: "no-store" });
      } catch { /* offline */ }
      window.location.replace("/login?sessao=expirada");
    };

    const renew = async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        const s = (await r.json()) as { user?: unknown } | null;
        if (!s?.user) return expire(); // o servidor já não reconhece a sessão
      } catch { /* rede instável: tenta de novo no próximo ciclo */ }
    };

    const check = () => {
      if (leaving.current) return;
      const now = Date.now();
      const last = readActivity() || now;
      if (now - last >= IDLE_MS) return void expire();
      // Renova só se houve atividade depois da última renovação.
      if (last > lastPing.current && now - lastPing.current >= PING_MS) {
        lastPing.current = now;
        void renew();
      }
    };

    // Voltar para a aba não é atividade que renove nada — é o momento de conferir
    // se o tempo passou (máquina que dormiu chega aqui).
    const onVisible = () => { if (document.visibilityState === "visible") check(); };

    write(Date.now());       // navegação/carregamento conta como atividade
    lastPing.current = Date.now(); // o token acabou de vir com o request

    const events = ["pointerdown", "keydown", "wheel", "scroll"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, CHECK_MS);

    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
