import { prisma } from "@/lib/db";
import { requireInternal, isAdmin } from "@/lib/rbac";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  createPartner,
  updatePartner,
  softDeletePartner,
  setPartnerPassword,
} from "@/lib/domain/admin";
import { PartnersClient, type PartnerRow } from "./PartnersClient";

export const dynamic = "force-dynamic";

/**
 * Administração de PARCEIROS — SÓ admin. Executivo de canal / parceiro caem no
 * EmptyState de acesso (fail-closed no servidor; as próprias actions reexigem admin).
 *
 * A listagem consulta o banco direto, mas `senhaHash` fica DELIBERADAMENTE fora do
 * select — nunca sai deste servidor. Só parceiros não arquivados (`deletedAt = null`).
 */
export default async function PartnersPage() {
  const user = await requireInternal();

  if (!isAdmin(user)) {
    return (
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold">Parceiros</h1>
        <div className="mt-6">
          <EmptyState
            title="Acesso restrito"
            hint="Apenas administradores podem gerenciar os parceiros de canal."
          />
        </div>
      </main>
    );
  }

  const parceiros = await prisma.parceiro.findMany({
    where: { deletedAt: null },
    // `senhaHash` NUNCA no select.
    select: { id: true, nome: true, cnpj: true, site: true, login: true, email: true, ativo: true },
    orderBy: { nome: "asc" },
  });

  const rows: PartnerRow[] = parceiros.map((p) => ({
    id: Number(p.id),
    nome: p.nome,
    cnpj: p.cnpj,
    site: p.site,
    login: p.login,
    email: p.email,
    ativo: p.ativo,
  }));

  return (
    <PartnersClient
      rows={rows}
      actions={{ createPartner, updatePartner, softDeletePartner, setPartnerPassword }}
    />
  );
}
