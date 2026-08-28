// Casca fina: o trabalho está em `src/lib/api/rota.ts` e a declaração em `catalogo.ts`.
import { atender, preflightV1 } from "@/lib/api/rota";
import { rotaDe } from "@/lib/api/catalogo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEF = rotaDe("/api/v1/opportunities/{id}");

/** Next 16: `params` é Promise. */
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS() {
  return preflightV1();
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  return atender(req, DEF, { id });
}
