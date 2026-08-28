// RFC 8414 — metadados do servidor de autorização.
//
// É o segundo passo da descoberta: o cliente lê o `/.well-known/oauth-protected-resource`
// do recurso, descobre quem autoriza, e vem aqui saber COMO falar com esse alguém.
//
// Público de propósito, e sem segredo nenhum: são endereços e capacidades. Um cliente que
// não consegue ler isto não consegue nem começar a autorização.

import { baseUrl } from "@/lib/appUrl";
import { authorizationServerMetadata } from "@/lib/oauth/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return Response.json(authorizationServerMetadata(baseUrl(req)), {
    headers: {
      // Metadado é estável e lido a cada conexão — cache curto tira ida de rede sem
      // deixar configuração velha presa por muito tempo.
      "cache-control": "public, max-age=300",
      // A descoberta acontece a partir do cliente, que vem de outra origem.
      "access-control-allow-origin": "*",
    },
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
