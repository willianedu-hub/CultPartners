// RFC 9728, variante canônica: o caminho do recurso vem DEPOIS do `.well-known`.
//
// Para o recurso `https://host/api/mcp`, o endereço que a especificação manda é
// `https://host/.well-known/oauth-protected-resource/api/mcp`. É este que o
// `WWW-Authenticate` do 401 aponta, e é este que um cliente que segue a RFC vai buscar.
//
// Responde o mesmo documento da raiz — o CultPartners tem um recurso protegido só. Se um dia
// houver mais de um (por exemplo, a API REST com escopos próprios), é aqui que eles se
// separam, e o `caminho` já chega pronto para isso.

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
