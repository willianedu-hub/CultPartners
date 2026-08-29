// O documento OpenAPI da API de leitura.
//
// **Aberto, sem credencial.** É o contrário do resto de `/api/v1`, e é deliberado: o documento
// descreve a FORMA da API, não dado nenhum. Exigir token para lê-lo obrigaria quem vai integrar
// a ter credencial antes de saber se a API serve — e a forma de descobrir sem o documento é
// tentar endpoints às cegas, que é pior para todos.
//
// Cacheável por 5 minutos: muda quando o código muda, não quando o dado muda.

import { documentoOpenApi } from "@/lib/api/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return new Response(JSON.stringify(documentoOpenApi(req), null, 2), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
