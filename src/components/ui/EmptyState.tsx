// Estado vazio coeso: marca, mensagem e CTA opcional.

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border text-lg text-faint shadow-[var(--shadow-sm)]"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--brand-magenta) 10%, transparent), transparent)" }}
      >
        ✷
      </div>
      <div className="text-sm font-semibold text-text">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-xs text-faint">{hint}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
