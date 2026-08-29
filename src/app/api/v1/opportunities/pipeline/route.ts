// Casca fina: o trabalho está em `src/lib/api/rota.ts` e a declaração em `catalogo.ts`.
// Segmento estático — precede `/opportunities/{id}` no roteamento do Next.
import { atender, preflightV1 } from "@/lib/api/rota";
import { rotaDe } from "@/lib/api/catalogo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEF = rotaDe("/api/v1/opportunities/pipeline");

export async function OPTIONS() {
  return preflightV1();
}

export async function GET(req: Request): Promise<Response> {
  return atender(req, DEF);
}
