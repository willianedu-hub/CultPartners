"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Modal de alerta desenhado (substitui window.alert). Mostra um título, uma
 * mensagem e — quando a mensagem tem o padrão "intro: item; item." — uma lista
 * de itens em bullets. Fecha no ✕, no botão, no ESC ou clicando no fundo.
 */
export function AlertDialog({
  title = "Não é possível concluir",
  message,
  tone = "warning",
  onClose,
}: {
  title?: string;
  message: string;
  tone?: "warning" | "error";
  onClose: () => void;
}) {
  // ESC na fase de CAPTURA e com stopPropagation: quando este alerta está dentro de um
  // Dialog (Radix), sem isso o ESC fecharia os dois — e o de fora leva o formulário
  // preenchido embora. Fora de um Dialog, parar a propagação não muda nada.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Quebra "Para mover para X faltam: a; b." em intro + [a, b].
  let intro = message;
  let items: string[] = [];
  const idx = message.indexOf(": ");
  if (idx !== -1) {
    const rest = message.slice(idx + 2).replace(/\.\s*$/, "");
    const parts = rest.split("; ").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      intro = message.slice(0, idx);
      items = parts;
    }
  }

  const accent = tone === "error" ? "#ef4444" : "#f59e0b";

  if (typeof document === "undefined") return null;
  return createPortal(
    // As duas defesas abaixo existem porque este alerta pode ser aberto de DENTRO de um
    // Dialog (Radix) — é o caso do aviso de desvio de foco na oportunidade — e ele é
    // portado para o <body>, ou seja, fica FORA do conteúdo do Dialog:
    //
    //  1. `pointer-events-auto`: o Radix marca o <body> com `pointer-events: none`
    //     enquanto está aberto. Sem isto, nem o botão nem o fundo do alerta clicam e o
    //     usuário fica preso.
    //  2. `onPointerDown`/`onMouseDown` com stopPropagation: o Radix detecta "clique
    //     fora" ouvindo o documento. Sem isto, clicar no alerta FECHA o modal de trás e
    //     leva o formulário preenchido embora.
    <div
      className="pointer-events-auto fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="modal-scrim absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} aria-hidden />
      {/* Mobile: bottom-sheet (cantos retos embaixo + safe-area); desktop: centrado, inalterado. */}
      <div role="alertdialog" aria-modal="true" aria-labelledby="alert-title" className="modal-pop pb-safe relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl rounded-b-none border border-border bg-surface shadow-[var(--shadow-lg)] sm:max-w-md sm:rounded-2xl sm:pb-0">
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="alert-title" className="text-base font-semibold text-text">{title}</h3>
            <p className="mt-0.5 text-sm text-muted">{intro}{items.length > 0 ? ":" : ""}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-surface2 hover:text-text max-sm:h-10 max-sm:w-10">✕</button>
        </div>

        {items.length > 0 && (
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-5 py-4">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text">
                <span className="mt-0.5 shrink-0" style={{ color: accent }}>•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            autoFocus
            className="rounded-lg bg-[#e91e8c] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:bg-[#d81b80] active:translate-y-px max-sm:min-h-11"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
