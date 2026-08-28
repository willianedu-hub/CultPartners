// Dashboard comercial do CultPartners — Server Component.
//
// Espelha o dashboard do CRM (mesmos cartões/gráficos/painéis) e o comportamento de
// `legacy/js/dashboard.js` (cartões clicáveis com drill-down, donut por etapa, ranking
// por parceiro/produto, linha por fechamento, alerta de 60 dias). Toda a leitura passa
// pela fundação já com escopo por audiência: `dashboardData` (agregações) e os catálogos
// de `@/lib/mcp/dados`; o drill-down usa `dashboardOpps` (lista achatada no escopo).
//
// A interação (modais, drill) vive na ilha client `DashboardClient`. Este arquivo só
// resolve a sessão, carrega os dados no servidor e injeta as props serializadas.

import { requireUser, isAdmin } from "@/lib/rbac";
import { dashboardData } from "@/lib/domain/leitura";
import { listProducts, listStatus, listPartners } from "@/lib/mcp/dados";
import { dashboardOpps } from "./data";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const admin = isAdmin(user);

  const [data, opps, produtos, status, parceiros] = await Promise.all([
    dashboardData(user),
    dashboardOpps(user),
    listProducts(),
    listStatus(),
    // Lista de parceiros só é necessária para o seletor da OppModal do admin.
    admin ? listPartners(user) : Promise.resolve([]),
  ]);

  return (
    <DashboardClient
      data={data}
      opps={opps}
      produtos={produtos.map((p) => ({ id: p.id, nome: p.nome, categoria: p.categoria }))}
      status={status.map((s) => ({ id: s.id, nome: s.nome }))}
      parceiros={parceiros.map((p) => ({ id: p.id, nome: p.nome }))}
      isAdmin={admin}
      audience={user.audience}
      canCreate={admin || user.audience === "partner"}
    />
  );
}
