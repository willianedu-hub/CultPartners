// Servidor MCP do CultPartners — a porta de MÁQUINA para os dados do portal de parceiros.
//
// O que responde: JSON-RPC 2.0 por POST, streamable HTTP **sem estado**. Somente leitura:
// nenhuma ferramenta altera dado.
//
// A rota é fina de propósito — autenticação, despacho e auditoria vivem em
// `src/lib/mcp/handler.ts`, que é testável sem subir servidor. Aqui fica só a costura com o
// Next. A autenticação por token precisa do banco (Prisma/bcrypt), então mora na rota e não em
// middleware (que roda na borda, sem Prisma).
//
// Como conectar:
//   claude mcp add cultpartners --transport http https://SEU-APP/api/mcp \
//     --header "Authorization: Bearer cp_..."

import { tratarGet, tratarPost, type Saida } from "@/lib/mcp/handler";

// `nodejs` porque o Prisma/bcrypt não rodam no Edge; `force-dynamic` porque toda resposta
// depende do token no header e nada aqui pode ser cacheado por engano.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resposta(saida: Saida): Response {
  // Notificação JSON-RPC não tem corpo: 202 sem corpo é a resposta certa, e um `null`
  // serializado aqui faria cliente estrito reclamar de resposta sem `id`.
  if (saida.corpo === undefined) return new Response(null, { status: saida.status, headers: saida.headers });
  return new Response(JSON.stringify(saida.corpo), {
    status: saida.status,
    headers: {
      "content-type": "application/json",
      // Resposta de dado nunca deve ficar em cache de intermediário.
      "cache-control": "no-store",
      ...(saida.headers ?? {}),
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  return resposta(await tratarPost(req));
}

export async function GET(req: Request): Promise<Response> {
  return resposta(await tratarGet(req));
}
