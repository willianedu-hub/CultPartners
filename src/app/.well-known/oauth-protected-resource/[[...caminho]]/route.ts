// RFC 9728 — metadados do RECURSO protegido: "quem autoriza o acesso a mim".
//
// É o primeiro passo da descoberta: o cliente recebe 401 do `/api/mcp`, lê o
// `resource_metadata` do `WWW-Authenticate`, cai aqui e daqui vai ao servidor de autorização.
//
// **Catch-all OPCIONAL (`[[...caminho]]`) de propósito** — serve as DUAS formas com um
// arquivo só:
//   • a raiz          `/.well-known/oauth-protected-resource`
//   • a canônica RFC  `/.well-known/oauth-protected-resource/api/mcp` (o caminho do recurso
//                      vem depois do `.well-known`; é o que o WWW-Authenticate aponta)
//
// Antes eram dois arquivos (`route.ts` + `[...caminho]/route.ts`). Em produção na Vercel o
// catch-all REQUERIDO sombreava a rota-base e a raiz devolvia 404 (em dev funcionava). O
// catch-all opcional casa o pai e qualquer profundidade, então a base volta a responder.
// Como o CultPartners tem um recurso protegido só, o documento é o mesmo para qualquer
// `caminho`; se um dia houver mais de um, é aqui que eles se separam.

import { baseUrl } from "@/lib/appUrl";
import { protectedResourceMetadata } from "@/lib/oauth/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return Response.json(protectedResourceMetadata(baseUrl(req)), {
    headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
