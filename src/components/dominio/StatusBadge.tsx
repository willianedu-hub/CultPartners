// Etiqueta de ETAPA do funil. A cor vem do próprio status (StatusFunil.cor), então é
// aplicada inline com um leve fundo derivado por color-mix — como os badges do CRM.
// Sem "use client": é puramente apresentacional.

export function StatusBadge({
  nome,
  cor,
  className = "",
}: {
  nome: string | null | undefined;
  cor?: string | null;
  className?: string;
}) {
  if (!nome) return <span className="text-faint">—</span>;
  const c = cor || "#64748b";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={{
        color: c,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} aria-hidden />
      {nome}
    </span>
  );
}
