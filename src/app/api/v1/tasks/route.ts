// Casca fina: o trabalho está em `src/lib/api/rota.ts` e a declaração em `catalogo.ts`.
// `cp_list_tasks` pede `opportunityId` (query, obrigatório): a tarefa é sempre de UMA
// oportunidade, e o escopo é checado nela — fora do alcance vira 404.
import { atender, preflightV1 } from "@/lib/api/rota";
import { rotaDe } from "@/lib/api/catalogo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEF = rotaDe("/api/v1/tasks");

export async function OPTIONS() {
  return preflightV1();
}

export async function GET(req: Request): Promise<Response> {
  return atender(req, DEF);
}
