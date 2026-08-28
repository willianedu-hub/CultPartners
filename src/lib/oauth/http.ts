import "server-only";

// Formato das respostas OAuth, num lugar só.
//
// Existe porque os três endpoints precisam concordar em coisas chatas que a especificação
// fixa e que erram fácil: `Cache-Control: no-store` (a resposta do `/token` NÃO pode ser
// guardada em cache), o CORS que o cliente de navegador precisa, e o corpo de erro no
// formato `{error, error_description}` (RFC 6749 §5.2) — e não no nosso formato de erro
// habitual, porque é o campo `error` que o cliente lê para decidir se reautoriza ou se
// reregistra.

import { statusDoErro, type ErroOAuth } from "./rules";

/**
 * CORS aberto de propósito. Não é frouxidão: nenhum destes endpoints usa cookie para
 * autorizar nada (o `/authorize` usa, mas ele responde HTML/redirect, não JSON), então
 * não há o que um site de terceiro roube com uma chamada do navegador dele. O que protege
 * o `/token` é o `code_verifier`, que só o cliente legítimo tem.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
};

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function jsonOAuth(corpo: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "content-type": "application/json",
      // A resposta do `/token` carrega credencial: cache aqui é vazamento em proxy.
      "cache-control": "no-store",
      pragma: "no-cache",
      ...CORS,
      ...extra,
    },
  });
}

export function erroOAuth(erro: ErroOAuth, detalhe: string, status?: number, extra: Record<string, string> = {}): Response {
  const cabecalho: Record<string, string> = { ...extra };
  // RFC 6749 §5.2: `invalid_client` com autenticação por header pede o desafio de volta.
  if (erro === "invalid_client") cabecalho["www-authenticate"] = `Basic realm="cultpartners"`;
  return jsonOAuth({ error: erro, error_description: detalhe }, status ?? statusDoErro(erro), cabecalho);
}

/**
 * Envolve o corpo de um endpoint OAuth para uma falha nossa não sair como 500.
 *
 * Com o Postgres fora do ar, o `/register` devolveria a página HTML de erro do Next com
 * status 500. Para um cliente OAuth isso é ilegível — ele espera JSON com o campo `error`, e
 * um 500 sem código não diz se vale a pena tentar de novo. `temporarily_unavailable` com 503
 * diz exatamente isso: o pedido estava certo, o servidor não estava. É a mesma escolha que
 * `statusRecusa` faz em `tokenAuth` para o motivo `indisponivel` — 401 faria o cliente jogar
 * fora uma credencial que está boa.
 *
 * Não engole erro em silêncio: o console guarda o original, porque banco fora do ar é
 * problema de infraestrutura e alguém precisa ver.
 */
export async function protegido(nome: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[oauth] falha em ${nome}:`, e);
    return erroOAuth("temporarily_unavailable", "O servidor não conseguiu atender agora. Tente novamente.", 503, {
      "retry-after": "30",
    });
  }
}

/**
 * Lê o corpo nos DOIS formatos.
 *
 * O `/token` e o `/revoke` são `application/x-www-form-urlencoded` por especificação; o
 * `/register` é JSON. Mas cliente real erra isso o tempo todo, e recusar por `Content-Type`
 * gera um `invalid_request` que ninguém consegue depurar do outro lado. Aceitar os dois
 * custa nada e não afrouxa segurança nenhuma — o que autoriza são os valores, não a forma.
 */
export async function lerCorpo(req: Request): Promise<Record<string, string>> {
  const bruto = await req.text();
  if (!bruto) return {};
  const tipo = (req.headers.get("content-type") ?? "").toLowerCase();
  if (tipo.includes("json") || bruto.trimStart().startsWith("{")) {
    try {
      const o = JSON.parse(bruto) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string") out[k] = v;
        else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string").join(" ");
        else if (v !== null && v !== undefined) out[k] = String(v);
      }
      return out;
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(bruto));
}

/** O corpo cru como JSON, para o `/register` (que precisa dos arrays de verdade). */
export async function lerJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const bruto = await req.text();
    if (!bruto) return {};
    const o: unknown = JSON.parse(bruto);
    return typeof o === "object" && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Credenciais do cliente: `Authorization: Basic` (RFC 6749 §2.3.1) ou no corpo.
 *
 * A especificação prefere o header e permite o corpo; o Claude usa o corpo. Ler os dois é
 * o que faz o servidor funcionar com clientes reais.
 */
export function credenciaisDoCliente(req: Request, corpo: Record<string, string>): { clientId: string | null; secret: string | null } {
  const h = req.headers.get("authorization");
  if (h && /^basic /i.test(h)) {
    try {
      const cru = Buffer.from(h.slice(6).trim(), "base64").toString("utf8");
      const i = cru.indexOf(":");
      if (i > 0) {
        // RFC 6749 §2.3.1 manda os dois virem com percent-encoding dentro do Basic.
        return { clientId: decodeURIComponent(cru.slice(0, i)), secret: decodeURIComponent(cru.slice(i + 1)) };
      }
    } catch {
      /* header malformado cai para o corpo */
    }
  }
  return { clientId: corpo.client_id || null, secret: corpo.client_secret || null };
}
