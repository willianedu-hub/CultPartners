// A URL pública do app, num lugar só.
//
// Existe porque duas coisas precisam da MESMA string e uma divergência entre elas quebra de
// formas diferentes: o comando que a tela de credenciais monta para copiar e o
// `resource_metadata` do desafio 401 do MCP (RFC 9728). Espalhar isso em dois arquivos seria
// garantir que um dia divergem.

/**
 * Base sem barra final. Ordem: variável de ambiente explícita, depois o que a Vercel injeta,
 * depois a origem do próprio pedido, depois localhost.
 *
 * **Por que o pedido entra na conta**: em deploy de prévia da Vercel o domínio muda a cada
 * push, e uma base fixa apontaria para o lugar errado. Confiar no `Host` é a mesma aposta que
 * o `trustHost` do NextAuth já faz; quem quiser travar define `NEXT_PUBLIC_APP_URL` e o pedido
 * deixa de ser consultado.
 */
export function baseUrl(fonte?: Request | Headers): string {
  const doAmbiente =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (doAmbiente) return normalizar(doAmbiente);

  // `Headers` direto (server action / componente, via `headers()` do Next) ou o `Request` de
  // uma rota. Aceitar os dois é o que permite a tela e o endpoint usarem a MESMA função.
  const cabecalhos = fonte instanceof Headers ? fonte : fonte?.headers;

  if (cabecalhos) {
    // Os HEADERS antes de `req.url`: `req.url` no servidor do Next carrega o hostname com que o
    // processo subiu, não o que o cliente pediu.
    const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
    if (host) {
      const proto =
        cabecalhos.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }

  if (fonte instanceof Request) {
    try {
      return new URL(fonte.url).origin;
    } catch {
      /* cai no padrão */
    }
  }
  return "http://localhost:3000";
}

/** O recurso protegido, canônico. */
export function urlDoMcp(fonte?: Request | Headers): string {
  return `${baseUrl(fonte)}/api/mcp`;
}

function normalizar(u: string): string {
  const comEsquema = u.startsWith("http") ? u : `https://${u}`;
  return comEsquema.replace(/\/+$/, "");
}
