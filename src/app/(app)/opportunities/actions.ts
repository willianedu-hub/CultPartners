"use server";

// Loader fino para o modal de EDIÇÃO. A tabela/kanban já recebem a forma "resumida"
// (loadOpps), mas a edição precisa também dos `produtoIds` e da lista completa de
// TAREFAS — senão o diff de `saveTasks` apagaria tarefas existentes ao salvar.
//
// Toda a leitura passa por `getOpp` (dados.ts), que aplica o ESCOPO no servidor: fora
// do alcance responde igual a "não existe". Nada de novo é reescrito aqui — só a ponte
// entre o clique de "editar" no cliente e a leitura escopada.

import { requireUser } from "@/lib/rbac";
import { getOpp } from "@/lib/mcp/dados";
import type { OppParaEdicao } from "@/components/dominio/OppModal";

/** Carrega a oportunidade completa (para o OppModal) no escopo do usuário, ou `null`. */
export async function fetchOppForEdit(id: number): Promise<OppParaEdicao | null> {
  const u = await requireUser();
  const o = await getOpp(u, id);
  if (!o.encontrada) return null;

  return {
    id: o.id,
    empresa: o.empresa,
    cnpj: o.cnpj,
    siteEmpresa: o.siteEmpresa,
    contato: o.contato,
    cargo: o.cargo,
    obs: o.obs,
    statusId: o.status?.id ?? null,
    parceiroId: o.parceiro?.id ?? null,
    fechamento: o.fechamento,
    valorEstimado: o.valorEstimado,
    aprovacao: o.aprovacao,
    motivoRejeicao: o.motivoRejeicao ?? null,
    produtoIds: o.produtos.map((p) => p.id),
    tarefas: o.tarefasDetalhe.map((t) => ({
      id: t.id,
      descricao: t.descricao,
      prazo: t.prazo,
      responsavel: t.responsavel,
      concluida: t.concluida,
    })),
  };
}
