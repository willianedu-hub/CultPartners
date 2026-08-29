"use server";

// Ações da tela de TAREFAS. Toda escrita passa por `saveTasks` (src/lib/domain/opps.ts), que
// reaplica escopo + permissão no servidor (parceiro só as suas; executivo é somente-leitura;
// admin tudo) e faz o diff/auditoria. Aqui só reconstruímos a lista completa da oportunidade
// (via `listTasks`, também com escopo) e aplicamos a mutação pedida sobre uma tarefa.
//
// `saveTasks` já revalida várias rotas do domínio; revalidamos "/tasks" explicitamente porque
// é a rota (em inglês) desta tela.

import { revalidatePath } from "next/cache";
import { requireUser, type SessionUser } from "@/lib/rbac";
import { listTasks } from "@/lib/mcp/dados";
import { saveTasks, type TarefaInput, type ActionResult } from "@/lib/domain/opps";

/**
 * Tarefas atuais da oportunidade (dentro do escopo), no formato de entrada de `saveTasks`.
 * `null` quando a oportunidade não está no alcance. Descrição vazia é preservada com um
 * rótulo mínimo — omitir a tarefa a APAGARIA no diff, o que não é o que queremos.
 */
async function tarefasAtuais(user: SessionUser, oppId: number): Promise<TarefaInput[] | null> {
  const r = await listTasks(user, oppId);
  if (!r.encontrada) return null;
  return r.tarefas.map((t) => ({
    id: t.id,
    descricao: t.descricao && t.descricao.trim() ? t.descricao : "(sem descrição)",
    prazo: t.prazo ? t.prazo.slice(0, 10) : null,
    responsavel: t.responsavel,
    concluida: t.concluida,
  }));
}

/** Conclui ou reabre uma tarefa (espelha `toggleDone` do legacy/js/ops.js). */
export async function toggleTaskDone(oppId: number, taskId: number, concluida: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const lista = await tarefasAtuais(user, oppId);
  if (!lista) return { ok: false, error: "Tarefa não encontrada no seu alcance." };

  const proxima = lista.map((t) => (t.id === taskId ? { ...t, concluida } : t));
  const r = await saveTasks(oppId, proxima);
  if (r.ok) revalidatePath("/tasks");
  return r;
}

/** Edita descrição / prazo / responsável de uma tarefa. */
export async function editTaskAction(
  oppId: number,
  taskId: number,
  campos: { descricao: string; prazo: string | null; responsavel: string | null },
): Promise<ActionResult> {
  const user = await requireUser();
  const desc = (campos.descricao ?? "").trim();
  if (!desc) return { ok: false, error: "Descreva a tarefa." };

  const lista = await tarefasAtuais(user, oppId);
  if (!lista) return { ok: false, error: "Tarefa não encontrada no seu alcance." };

  const proxima = lista.map((t) =>
    t.id === taskId
      ? { ...t, descricao: desc, prazo: campos.prazo || null, responsavel: campos.responsavel || null }
      : t,
  );
  const r = await saveTasks(oppId, proxima);
  if (r.ok) revalidatePath("/tasks");
  return r;
}

/** Remove uma tarefa (o diff de `saveTasks` apaga a que sumiu da lista). */
export async function removeTaskAction(oppId: number, taskId: number): Promise<ActionResult> {
  const user = await requireUser();
  const lista = await tarefasAtuais(user, oppId);
  if (!lista) return { ok: false, error: "Tarefa não encontrada no seu alcance." };

  const proxima = lista.filter((t) => t.id !== taskId);
  const r = await saveTasks(oppId, proxima);
  if (r.ok) revalidatePath("/tasks");
  return r;
}
