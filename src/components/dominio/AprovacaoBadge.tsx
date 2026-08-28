// Etiqueta do estado de APROVAÇÃO da oportunidade. Três estados fixos, com os tons
// semânticos do DS (verde/âmbar/vermelho). Apresentacional (sem "use client").

import { CheckCircle2, Clock, XCircle } from "lucide-react";

type Aprovacao = "Pendente" | "Aprovado" | "Rejeitado";

const MAP: Record<Aprovacao, { rotulo: string; cor: string; Icon: typeof Clock }> = {
  Pendente: { rotulo: "Pendente", cor: "var(--tom-atencao)", Icon: Clock },
  Aprovado: { rotulo: "Aprovado", cor: "var(--tom-bom)", Icon: CheckCircle2 },
  Rejeitado: { rotulo: "Rejeitado", cor: "var(--tom-critico)", Icon: XCircle },
};

export function AprovacaoBadge({
  aprovacao,
  className = "",
}: {
  aprovacao: Aprovacao | string | null | undefined;
  className?: string;
}) {
  const key = (aprovacao ?? "Pendente") as Aprovacao;
  const cfg = MAP[key] ?? MAP.Pendente;
  const { rotulo, cor, Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={{
        color: cor,
        background: `color-mix(in srgb, ${cor} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${cor} 30%, transparent)`,
      }}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {rotulo}
    </span>
  );
}
