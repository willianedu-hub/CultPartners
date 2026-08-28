import { prisma } from "@/lib/db";
import { requireInternal, isAdmin } from "@/lib/rbac";
import { EmptyState } from "@/components/ui/EmptyState";
import { createProduct, updateProduct, deactivateProduct } from "@/lib/domain/admin";
import { ProductsClient, type ProductRow } from "./ProductsClient";

export const dynamic = "force-dynamic";

/**
 * CRUD de PRODUTOS — SÓ admin (as actions reexigem admin de qualquer forma). Lista todos
 * os produtos (ativos e inativos) para permitir reativação; ordenados pelo campo `ordem`.
 */
export default async function ProdutosPage() {
  const user = await requireInternal();

  if (!isAdmin(user)) {
    return (
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold">Produtos e serviços</h1>
        <div className="mt-6">
          <EmptyState
            title="Acesso restrito"
            hint="Apenas administradores podem gerenciar o catálogo de produtos."
          />
        </div>
      </main>
    );
  }

  const produtos = await prisma.produto.findMany({
    select: { id: true, nome: true, categoria: true, descricao: true, ordem: true, ativo: true },
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }],
  });

  const rows: ProductRow[] = produtos.map((p) => ({
    id: Number(p.id),
    nome: p.nome,
    categoria: p.categoria,
    descricao: p.descricao,
    ordem: p.ordem,
    ativo: p.ativo,
  }));

  return (
    <ProductsClient
      rows={rows}
      actions={{ createProduct, updateProduct, deactivateProduct }}
    />
  );
}
