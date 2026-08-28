import { requireUser } from "@/lib/rbac";
import { janelaPeriodo, type Periodo } from "@/lib/mcp/dados";
import { getReportsView } from "./data";
import { ReportsView } from "./ReportsView";

export const dynamic = "force-dynamic";

const PERIODOS_VALIDOS: Periodo[] = ["MES", "MES_PASSADO", "TRIMESTRE", "ANO", "12M", "TUDO"];

type Params = { periodo?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const sp = await searchParams;

  // O período vem da URL, mas só vale se for uma chave conhecida (o padrão é "tudo").
  const periodo: Periodo = PERIODOS_VALIDOS.includes(sp.periodo as Periodo) ? (sp.periodo as Periodo) : "TUDO";
  const data = await getReportsView(user, periodo);
  const janela = janelaPeriodo(periodo);

  const escopoLabel =
    user.audience === "partner"
      ? "suas oportunidades"
      : data.report.admin
        ? "toda a operação"
        : "seus parceiros";

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Relatórios</h1>
        <p className="mt-1 text-sm text-muted">
          Análise de {escopoLabel} · {janela.rotulo.toLowerCase()}.
        </p>
      </header>

      <ReportsView data={data} periodo={periodo} />
    </main>
  );
}
