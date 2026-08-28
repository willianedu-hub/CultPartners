// RFC 9728 — metadados do RECURSO protegido: "quem autoriza o acesso a mim".
//
// É o primeiro passo da descoberta. O cliente recebe 401 do `/api/mcp`, lê o
// `resource_metadata` do `WWW-Authenticate`, cai aqui, e daqui vai para o servidor de
// autorização.
//
// **Existem duas rotas para isto de propósito.** A RFC manda inserir o caminho do recurso
// depois do `.well-known`: para `https://host/api/mcp`, o endereço canônico é
// `https://host/.well-known/oauth-protected-resource/api/mcp` — e é ele que o
// `WWW-Authenticate` aponta. Mas parte dos clientes tenta a raiz primeiro. Servir as duas
// custa um arquivo e evita uma falha de descoberta que não parece de descoberta.
// A variante com caminho está em `[...caminho]/route.ts`.

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
