"use client";

// O formulário do login do CultPartners — DUAS audiências no mesmo cartão flutuante.
// A moldura (arte, marca, rodapé) é do `LoginShell`; aqui mora só a lógica de sessão
// expirada, prefill, visibilidade de senha e as duas portas de entrada:
//
//  1. PARCEIRO (caminho principal): login + senha → provider "partner" (tabela `parceiros`).
//  2. EQUIPE CULTSEC (secundário, recolhido atrás de um botão): e-mail + senha → provider
//     "credentials" (usuários internos), mais "Entrar com a conta Microsoft" quando o Entra
//     está configurado neste ambiente (`microsoft`).
//
// Os dois submits seguem o mesmo padrão do CRM: `signIn(..., { redirect: false })` para
// mostrar o erro no próprio cartão e só então `router.push(destinoSeguro(next))`.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Clock, ShieldAlert, UserX } from "lucide-react";
import { LAST_ACTIVITY_KEY, LAST_EMAIL_KEY, destinoSeguro, type LoginReason } from "@/lib/sessionPolicy";

/** Aviso do topo do formulário conforme o motivo de ter caído aqui. */
const REASONS: Record<LoginReason, { Icon: typeof Clock; text: string }> = {
  expirada: { Icon: Clock, text: "Sua sessão expirou por inatividade. Entre novamente para continuar." },
  encerrada: { Icon: ShieldAlert, text: "Suas sessões foram encerradas por um administrador. Entre novamente." },
  inativa: { Icon: UserX, text: "Seu acesso está desativado. Fale com um administrador." },
};

/** Marca da Microsoft — os quatro quadrados. SVG à mão: nada de buscar imagem externa. */
function LogoMicrosoft({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden focusable="false">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

export function LoginForm({
  reason,
  next,
  microsoft = false,
  erroExterno = null,
}: {
  reason: LoginReason | null;
  next?: string | null;
  /** O provider da Microsoft está configurado neste ambiente? */
  microsoft?: boolean;
  /** Recusa vinda do login federado (`?error=` do Auth.js). */
  erroExterno?: string | null;
}) {
  const router = useRouter();

  // Parceiro (porta principal).
  const [partnerPwd, setPartnerPwd] = useState("");
  const [showPartnerPwd, setShowPartnerPwd] = useState(false);
  const loginRef = useRef<HTMLInputElement>(null);

  // Equipe CultSec (recolhida por padrão — a maioria de quem chega aqui é parceiro).
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamPwd, setTeamPwd] = useState("");
  const [showTeamPwd, setShowTeamPwd] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const teamPwdRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState<null | "partner" | "team">(null);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Quando a sessão caiu sozinha e havia um e-mail guardado, quem estava logado era da
  // equipe: abrimos a seção da equipe, devolvemos o e-mail e mandamos o cursor para a senha.
  // Parceiro não guarda login, então nesse caso o foco vai para o campo de login do parceiro.
  //
  // Os campos são NÃO controlados de propósito: o valor vem do localStorage, que não existe
  // no servidor. Preencher por estado daria divergência de hidratação; escrever no DOM pelo
  // efeito é exatamente o caso de uso de um efeito.
  useEffect(() => {
    if (!reason) return;
    let last: string | null = null;
    try { last = localStorage.getItem(LAST_EMAIL_KEY); } catch { /* modo privado */ }
    if (last) {
      setTeamOpen(true);
      // Aguarda a seção da equipe montar antes de preencher/focar.
      queueMicrotask(() => {
        if (emailRef.current) emailRef.current.value = last!;
        teamPwdRef.current?.focus();
      });
      return;
    }
    loginRef.current?.focus();
  }, [reason]);

  async function onPartnerSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading("partner");
    setPartnerError(null);
    const login = (loginRef.current?.value ?? "").trim();
    const res = await signIn("partner", { login, password: partnerPwd, redirect: false });
    setLoading(null);
    if (res?.error) {
      setPartnerError("Login ou senha inválidos.");
      return;
    }
    // Relógio de inatividade zerado agora, senão o vigia herdaria o tempo parado da
    // sessão anterior e expiraria de imediato.
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch { /* modo privado */ }
    router.push(destinoSeguro(next));
    router.refresh();
  }

  async function onTeamSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading("team");
    setTeamError(null);
    const email = (emailRef.current?.value ?? "").trim().toLowerCase();
    const res = await signIn("credentials", { email, password: teamPwd, redirect: false });
    setLoading(null);
    if (res?.error) {
      setTeamError("E-mail ou senha inválidos.");
      return;
    }
    try {
      localStorage.setItem(LAST_EMAIL_KEY, email);
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } catch { /* modo privado */ }
    router.push(destinoSeguro(next));
    router.refresh();
  }

  // Anel de foco único: quem desenha é o :focus-visible global (magenta). O campo fica
  // direto sobre a arte (não há cartão): fundo translúcido com desfoque, senão o degradê e
  // a foto atravessam o campo e o texto digitado perde legibilidade.
  const inputCls =
    "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-text backdrop-blur-sm transition-colors placeholder:text-faint focus:bg-white/[0.1] max-sm:min-h-11";
  const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted";
  const aviso = reason ? REASONS[reason] : null;

  return (
    <div className="w-full">
      <h2 className="mb-1 text-xl font-semibold text-text">Bem-vindo de volta</h2>
      <p className="mb-6 text-sm text-muted">Acesse o portal de parceiros da CultSec.</p>

      {aviso && (
        <p
          role="status"
          className="mb-5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          <aviso.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{aviso.text}</span>
        </p>
      )}

      {erroExterno && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{erroExterno}</span>
        </p>
      )}

      {/* ─────────────────── Porta principal: PARCEIRO ─────────────────── */}
      <form onSubmit={onPartnerSubmit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="login-parceiro">Login do parceiro</label>
          <input
            id="login-parceiro"
            ref={loginRef}
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="seu-login"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="senha-parceiro">Senha</label>
          <div className="relative">
            <input
              id="senha-parceiro"
              type={showPartnerPwd ? "text" : "password"}
              required
              value={partnerPwd}
              onChange={(e) => setPartnerPwd(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`${inputCls} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPartnerPwd((v) => !v)}
              aria-label={showPartnerPwd ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPartnerPwd}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted hover:text-text"
            >
              {showPartnerPwd ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {partnerError && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {partnerError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading === "partner"}
          className="w-full rounded-lg bg-[#e91e8c] px-4 py-2.5 font-semibold text-white shadow-[var(--shadow)] transition-all hover:bg-[#d81b80] active:translate-y-px disabled:opacity-60 max-sm:min-h-11"
        >
          {loading === "partner" ? "Entrando…" : "Entrar"}
        </button>
      </form>

      {/* ─────────────────── Porta secundária: EQUIPE CULTSEC ─────────────────── */}
      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-white/15" />
        <span className="text-[11px] uppercase tracking-wider text-faint">CultSec</span>
        <span className="h-px flex-1 bg-white/15" />
      </div>

      {!teamOpen ? (
        <button
          type="button"
          onClick={() => {
            setTeamOpen(true);
            queueMicrotask(() => emailRef.current?.focus());
          }}
          className="w-full text-center text-xs text-muted underline-offset-2 hover:text-text hover:underline"
        >
          Sou da equipe CultSec
        </button>
      ) : (
        <div>
          <p className="mb-4 text-[11px] uppercase tracking-wider text-faint">Acesso da equipe</p>

          {microsoft && (
            <>
              <button
                type="button"
                onClick={() => signIn("microsoft-entra-id", { redirectTo: destinoSeguro(next) })}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2.5 font-medium text-text backdrop-blur-sm transition-colors hover:bg-white/[0.12] max-sm:min-h-11"
              >
                <LogoMicrosoft className="h-[18px] w-[18px]" />
                Entrar com a conta Microsoft
              </button>
              <div className="my-5 flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-white/15" />
                <span className="text-[11px] uppercase tracking-wider text-faint">ou</span>
                <span className="h-px flex-1 bg-white/15" />
              </div>
            </>
          )}

          <form onSubmit={onTeamSubmit} className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="login-email">E-mail corporativo</label>
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="voce@cultsec.com.br"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="login-password">Senha</label>
              <div className="relative">
                <input
                  id="login-password"
                  ref={teamPwdRef}
                  type={showTeamPwd ? "text" : "password"}
                  required
                  value={teamPwd}
                  onChange={(e) => setTeamPwd(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${inputCls} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowTeamPwd((v) => !v)}
                  aria-label={showTeamPwd ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showTeamPwd}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted hover:text-text"
                >
                  {showTeamPwd ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
            </div>

            {teamError && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {teamError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading === "team"}
              className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2.5 font-semibold text-text backdrop-blur-sm transition-colors hover:bg-white/[0.12] disabled:opacity-60 max-sm:min-h-11"
            >
              {loading === "team" ? "Entrando…" : "Entrar como equipe"}
            </button>
          </form>
        </div>
      )}

      {/* Texto, não link: não existe fluxo de recuperação de senha — um link morto seria
          pior que instrução nenhuma. Quem reseta é o administrador. */}
      <p className="mt-5 text-xs text-faint">
        Esqueceu a senha? <span className="text-muted">Fale com um administrador.</span>
      </p>
    </div>
  );
}
