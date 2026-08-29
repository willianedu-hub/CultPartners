import "server-only";

// Coleta TODAS as oportunidades do escopo (a tabela e o kanban filtram/ordenam no
// cliente, como no CRM). `loadOpps` já pagina de 50 em 50 com o escopo aplicado; aqui
// só juntamos as páginas: a 1ª descobre o total, o resto vem em paralelo.

import type { SessionUser } from "@/lib/rbac";
import { loadOpps } from "@/lib/mcp/dados";
import type { OppRow } from "./OpportunitiesTable";

export async function loadAllOpps(user: SessionUser): Promise<OppRow[]> {
  const first = await loadOpps(user, { page: 1 });
  let itens = [...first.itens];
  if (first.totalPaginas > 1) {
    const rest = await Promise.all(
      Array.from({ length: first.totalPaginas - 1 }, (_, i) => loadOpps(user, { page: i + 2 })),
    );
    for (const r of rest) itens = itens.concat(r.itens);
  }
  return itens as unknown as OppRow[];
}
