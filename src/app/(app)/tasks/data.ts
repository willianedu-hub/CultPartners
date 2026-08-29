import "server-only";

// Carga da tela de TAREFAS. Lista as tarefas das oportunidades DENTRO do escopo do usuário
// (parceiro → só as suas; executivo → seus parceiros; admin → todas), sempre com a
// oportunidade não excluída (`deletedAt = null`). A tarefa herda o escopo da oportunidade —
// o mesmo princípio de `listTasks` em `src/lib/mcp/dados.ts`.
//
// Invariantes de dados.ts valem aqui: escopo no servidor, soft-delete respeitado, BigInt →
// Number na saída.

import { prisma } from "@/lib/db";
import { oportunidadeScopeWhere, type SessionUser } from "@/lib/rbac";

export type TaskRow = {
  id: number;
  oportunidadeId: number;
  empresa: string;
  descricao: string;
  prazo: string | null; // "YYYY-MM-DD"
  responsavel: string | null;
  concluida: boolean;
  concluidaEm: string | null;
};

/** Recorte de tempo local (00:00 de hoje) para separar atrasadas / hoje / próximas. */
function hojeISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export type TasksData = {
  hoje: string;
  atrasadas: TaskRow[];
  doDia: TaskRow[];
  proximas: TaskRow[];
  concluidas: TaskRow[];
  totalAbertas: number;
};

/** Todas as tarefas no escopo, já agrupadas para a tela. */
export async function loadScopedTasks(user: SessionUser): Promise<TasksData> {
  const rows = await prisma.tarefa.findMany({
    where: {
      oportunidade: { AND: [oportunidadeScopeWhere(user), { deletedAt: null }] },
    },
    select: {
      id: true,
      oportunidadeId: true,
      descricao: true,
      prazo: true,
      responsavel: true,
      concluida: true,
      concluidaEm: true,
      oportunidade: { select: { empresa: true } },
    },
    // Sem prazo por último; entre com prazo, o mais antigo primeiro.
    orderBy: [{ prazo: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  const tasks: TaskRow[] = rows.map((t) => ({
    id: Number(t.id),
    oportunidadeId: Number(t.oportunidadeId),
    empresa: t.oportunidade?.empresa ?? "—",
    descricao: t.descricao ?? "",
    prazo: t.prazo ? t.prazo.toISOString().slice(0, 10) : null,
    responsavel: t.responsavel,
    concluida: t.concluida,
    concluidaEm: t.concluidaEm ? t.concluidaEm.toISOString() : null,
  }));

  const hoje = hojeISO();
  const abertas = tasks.filter((t) => !t.concluida);

  const atrasadas = abertas.filter((t) => t.prazo && t.prazo < hoje);
  const doDia = abertas.filter((t) => t.prazo === hoje);
  const proximas = abertas.filter((t) => !t.prazo || t.prazo > hoje);
  // Concluídas mais recentes primeiro (para permitir reabrir).
  const concluidas = tasks
    .filter((t) => t.concluida)
    .sort((a, b) => (b.concluidaEm ?? "").localeCompare(a.concluidaEm ?? ""));

  return { hoje, atrasadas, doDia, proximas, concluidas, totalAbertas: abertas.length };
}
