import { requireUser, isAdmin } from "@/lib/rbac";
import { listStatus, listProducts, listPartners } from "@/lib/mcp/dados";
import { loadAllOpps } from "../opportunities/data";
import { PipelineBoard } from "./PipelineBoard";

// Página de PIPELINE (kanban por etapa do funil). Espelha o SPA legado
// (legacy/js/kanban.js) e o quadro do CRM: colunas por StatusFunil na ordem, cartões
// arrastáveis (@dnd-kit) que mudam a etapa via `moveOppStatus` (otimista + rollback).
// Escopo e permissões vivem no servidor.

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const showParceiro = user.audience === "internal";

  const [opps, status, produtos, parceiros] = await Promise.all([
    loadAllOpps(user),
    listStatus(),
    listProducts(),
    showParceiro ? listPartners(user) : Promise.resolve([]),
  ]);

  return (
    <main className="flex h-[calc(100dvh-3rem-var(--bnav))] w-full flex-col px-4 py-4 sm:px-6 sm:py-5">
      <PipelineBoard
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
