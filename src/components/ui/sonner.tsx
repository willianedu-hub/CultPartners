"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toaster global. Estilizado com os tokens do DS via CSS vars do sonner, de modo
 * que acompanha automaticamente os temas claro/escuro (as vars invertem com .dark).
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          borderRadius: "0.75rem",
        },
        classNames: { title: "text-sm font-medium", description: "text-xs" },
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--surface)",
          "--success-text": "var(--text)",
          "--error-bg": "var(--surface)",
          "--error-text": "var(--text)",
        } as React.CSSProperties
      }
    />
  );
}
