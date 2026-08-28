import { requireUser, isAdmin } from "@/lib/rbac";
import { listStatus, listProducts, listPartners } from "@/lib/mcp/dados";
import { loadAllOpps } from "./data";
import { OpportunitiesTable } from "./OpportunitiesTable";

// Página de OPORTUNIDADES — tabela espelhando o CRM (table-kit) e o SPA legado
// (legacy/js/table.js): filtros, ordenação, seleção de colunas, paginação, export CSV,
// edição por duplo-clique/botão e ações de aprovação para admin. Todo o escopo e as
// permissões vivem no servidor (leituras via dados.ts, escritas via domain/opps).

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  // Admin e executivo de canal veem a coluna/filtro de parceiro; parceiro não.
  const showParceiro = user.audience === "internal";

  const [opps, status, produtos, parceiros] = await Promise.all([
    loadAllOpps(user),
    listStatus(),
    listProducts(),
    showParceiro ? listPartners(user) : Promise.resolve([]),
  ]);

  return (
    <main className="flex h-[calc(100dvh-3rem-var(--bnav))] w-full flex-col overflow-hidden px-4 py-4 max-md:h-auto max-md:overflow-visible sm:px-6 sm:py-5">
      <OpportunitiesTable
        opps={opps}
        status={status.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor, ordem: s.ordem }))}
        produtos={produtos.map((p) => ({ id: p.id, nome: p.nome, categoria: p.categoria }))}
        parceiros={parceiros.map((p) => ({ id: p.id, nome: p.nome }))}
        isAdmin={admin}
        audience={user.audience}
        showParceiro={showParceiro}
      />
    </main>
  );
}
