import { prisma } from "@/lib/db";
import { requireInternal, isAdmin } from "@/lib/rbac";
import { EmptyState } from "@/components/ui/EmptyState";
import { createStatus, updateStatus, deactivateStatus, reorderStatus } from "@/lib/domain/admin";
import { FunilClient, type StatusRow } from "./FunilClient";

export const dynamic = "force-dynamic";

/**
 * CRUD das ETAPAS do funil — SÓ admin (as actions reexigem admin). Lista todas as etapas
 * (ativas e inativas) para permitir reativação e reordenação; ordenadas por `ordem`.
 */
export default async function FunilPage() {
  const user = await requireInternal();

  if (!isAdmin(user)) {
    return (
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold">Etapas do funil</h1>
        <div className="mt-6">
          <EmptyState
            title="Acesso restrito"
            hint="Apenas administradores podem gerenciar as etapas do funil."
          />
        </div>
      </main>
    );
  }

  const status = await prisma.statusFunil.findMany({
    select: { id: true, nome: true, cor: true, ordem: true, ativo: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });

  const rows: StatusRow[] = status.map((s) => ({
    id: Number(s.id),
    nome: s.nome,
    cor: s.cor,
    ordem: s.ordem,
    ativo: s.ativo,
  }));

  return (
    <FunilClient
      rows={rows}
      actions={{ createStatus, updateStatus, deactivateStatus, reorderStatus }}
    />
  );
}
