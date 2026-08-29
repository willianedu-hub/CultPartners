// Primitivas de tabela: compacta, cabeçalho fixo translúcido, hover sutil, sombra leve.

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
      <table className="w-full min-w-[560px] border-collapse text-sm md:min-w-0">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface2 text-left text-[11px] uppercase tracking-wider text-faint">
      <tr className="border-b border-border">{children}</tr>
    </thead>
  );
}

export function TH({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  // no mobile a coluna aperta: padding menor pra caber mais conteúdo por rolagem
  return <th className={`px-4 py-3 font-semibold max-md:px-3 ${right ? "text-right" : ""}`}>{children}</th>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TRow({ children }: { children: React.ReactNode }) {
  return <tr className="transition-colors hover:bg-surface2/70">{children}</tr>;
}

export function TD({
  children,
  right,
  strong,
}: {
  children: React.ReactNode;
  right?: boolean;
  strong?: boolean;
}) {
  return (
    <td className={`px-4 py-2.5 align-middle max-md:px-3 max-md:py-3 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-medium text-text" : "text-muted"}`}>
      {children}
    </td>
  );
}
