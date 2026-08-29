// Regras do OAuth 2.1 — módulo PURO (sem Prisma, sem `next/*`).
//
// Mesma disciplina de `tokenAuth.ts` e do MCP: o que dá para decidir sem ir ao banco fica
// aqui e é testável de verdade; a ida ao banco fica na casca fina (`store.ts`). Num servidor
// de autorização isso vale dobrado — as recusas são a parte que precisa de teste, e quase
// todas são decidíveis sobre valores.
//
// **Sem JWT, sem `jose`.** Os tokens aqui são opacos, com SHA-256 no banco. O OAuth 2.1
// permite, e isso evita a superfície inteira de validação de JWT (algoritmo, chave, `alg`
// nenhum, rotação de JWKS). `node:crypto` cobre PKCE S256 sem dependência nova.

import { createHash, randomBytes, timingSafeEqual } from "crypto";

// ───────────────────────────── vocabulário ─────────────────────────────

/** Escopos que este servidor concede. A v1 só lê. */
export const ESCOPOS_SUPORTADOS = ["read"] as const;
export type Escopo = (typeof ESCOPOS_SUPORTADOS)[number];

/** Vida do código de autorização. Curta de propósito: é para ser resgatado na hora. */
export const CODIGO_TTL_MS = 60_000;
/** Vida do access token emitido pelo fluxo. */
export const ACCESS_TTL_MS = 60 * 60 * 1000;
/** Vida do refresh. Longa, mas não eterna — e cada uso rotaciona. */
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Erros do OAuth 2.1, com o código exato que a especificação manda. Não é preciosismo: o
 * cliente decide o que fazer lendo este campo — `invalid_grant` manda ele reautorizar,
 * `invalid_client` manda ele reregistrar, e um `server_error` genérico faria os dois
 * caírem no lugar errado.
 */
export type ErroOAuth =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "access_denied"
  | "server_error"
  | "temporarily_unavailable";

/** Códigos que o `/token` devolve com 400; `invalid_client` é 401. */
export function statusDoErro(erro: ErroOAuth): number {
  if (erro === "invalid_client") return 401;
  if (erro === "server_error") return 500;
  if (erro === "temporarily_unavailable") return 503;
  return 400;
}

// ───────────────────────────── segredos ─────────────────────────────

/** SHA-256 em hex. O mesmo de `tokenAuth`, repetido aqui para o módulo ficar puro. */
export function hashOAuth(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/** Código de autorização: 32 bytes. Opaco, uso único, vida de 60 s. */
export function novoCodigo(): { codigo: string; codeHash: string } {
  const codigo = randomBytes(32).toString("base64url");
  return { codigo, codeHash: hashOAuth(codigo) };
}

/** Refresh token: 32 bytes, com marca própria para não se confundir com access. */
export function novoRefresh(): { refresh: string; refreshHash: string } {
  const refresh = `cpr_${randomBytes(32).toString("base64url")}`;
  return { refresh, refreshHash: hashOAuth(refresh) };
}

/** Identificador público de cliente. Não é segredo — vai na URL de autorização. */
export function novoClientId(): string {
  return `cpc_${randomBytes(16).toString("base64url")}`;
}

/** Segredo de cliente confidencial. Cliente público não recebe nenhum. */
export function novoClientSecret(): { secret: string; secretHash: string } {
  const secret = `cps_${randomBytes(32).toString("base64url")}`;
  return { secret, secretHash: hashOAuth(secret) };
}

/** Comparação em tempo constante, para segredo comparado em MEMÓRIA (o `code_verifier`). */
export function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// ───────────────────────────── PKCE ─────────────────────────────

/**
 * `code_challenge = BASE64URL(SHA256(code_verifier))`, sem preenchimento.
 *
 * **Só S256.** O `plain` existe na especificação e é inútil: se o desafio é o próprio
 * verificador, quem interceptou a URL de autorização já tem os dois. Aceitar `plain` seria
 * oferecer um modo sem proteção a quem pedir — e quem pede é justamente o atacante.
 */
export function desafioDe(verificador: string): string {
  return createHash("sha256").update(verificador, "utf8").digest("base64url");
}

/** O verificador tem forma definida na RFC 7636: 43–128 caracteres do alfabeto reservado. */
const VERIFICADOR_OK = /^[A-Za-z0-9\-._~]{43,128}$/;

/**
 * O verificador prova o desafio? Devolve o motivo da recusa, ou `null` quando confere.
 *
 * A ordem importa: forma antes de comparação. Um verificador malformado é recusado sem
 * chegar a hash nenhum, e a mensagem diz o que está errado — o cliente conserta o próprio
 * código em vez de ficar adivinhando por que o resgate falha.
 */
export function conferePkce(
  verificador: string | null | undefined,
  desafio: string,
  metodo: string,
): { ok: true } | { ok: false; erro: ErroOAuth; detalhe: string } {
  if (metodo !== "S256") {
    return { ok: false, erro: "invalid_grant", detalhe: `método de PKCE não suportado: ${metodo} (só S256)` };
  }
  if (!verificador) {
    return { ok: false, erro: "invalid_grant", detalhe: "code_verifier ausente" };
  }
  if (!VERIFICADOR_OK.test(verificador)) {
    return { ok: false, erro: "invalid_grant", detalhe: "code_verifier fora da forma da RFC 7636 (43-128 caracteres)" };
  }
  if (!comparaSegura(desafioDe(verificador), desafio)) {
    return { ok: false, erro: "invalid_grant", detalhe: "code_verifier não confere com o code_challenge" };
  }
  return { ok: true };
}

// ───────────────────────────── redirect_uri ─────────────────────────────

/**
 * Comparação de `redirect_uri`: **string exata**, como a RFC 6749 §3.1.2 manda para
 * cliente público.
 *
 * Nada de "começa com" nem de coringa. Um cliente registrado em
 * `https://claude.ai/api/callback` com comparação por prefixo aceitaria
 * `https://claude.ai/api/callback.evil.com` — e o código de autorização iria junto.
 */
export function redirectPermitido(pedida: string, registradas: string[]): boolean {
  return registradas.includes(pedida);
}

/**
 * A `redirect_uri` é aceitável para REGISTRO? Chamada no cadastro, não no fluxo.
 *
 * `http` só em `localhost` — cliente nativo faz laço em `http://127.0.0.1:porta` e isso é
 * legítimo. Em qualquer outro host, `http` significa o código de autorização viajando em
 * texto puro pela rede.
 */
export function redirectRegistravel(uri: string): { ok: true } | { ok: false; motivo: string } {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return { ok: false, motivo: "não é uma URL absoluta válida" };
  }
  if (u.hash) return { ok: false, motivo: "não pode ter fragmento (#)" };
  const localhost = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (u.protocol === "http:" && !localhost) {
    return { ok: false, motivo: "http só é aceito em localhost — fora dele o código viajaria em texto puro" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, motivo: `esquema não suportado: ${u.protocol}` };
  }
  return { ok: true };
}

// ───────────────────────────── escopos ─────────────────────────────

/**
 * Escopos pedidos, intersectados com o que o servidor concede. Desconhecido é
 * **descartado**, não recusado — recusar a autorização inteira porque o cliente pediu um
 * escopo a mais é hostil, e a especificação permite conceder menos do que foi pedido.
 * Quem precisa saber o que valeu lê o `scope` da resposta do `/token`.
 */
export function escoposConcedidos(pedidos: string | null | undefined): Escopo[] {
  const lista = (pedidos ?? "").split(/\s+/).filter(Boolean);
  if (lista.length === 0) return ["read"]; // padrão: o mínimo útil
  const concedidos = lista.filter((e): e is Escopo => (ESCOPOS_SUPORTADOS as readonly string[]).includes(e));
  return [...new Set(concedidos)];
}

/**
 * Um refresh só pode pedir o que já tinha, ou menos — **nunca mais**. É a regra que impede
 * o token de crescer de privilégio ao longo do tempo, longe do consentimento original.
 */
export function escoposDoRefresh(
  pedidos: string | null | undefined,
  concedidosAntes: string[],
): { ok: true; escopos: string[] } | { ok: false; erro: ErroOAuth; detalhe: string } {
  if (!pedidos) return { ok: true, escopos: concedidosAntes };
  const lista = pedidos.split(/\s+/).filter(Boolean);
  const alem = lista.filter((e) => !concedidosAntes.includes(e));
  if (alem.length > 0) {
    return {
      ok: false,
      erro: "invalid_scope",
      detalhe: `escopo além do concedido no consentimento: ${alem.join(", ")}`,
    };
  }
  return { ok: true, escopos: lista };
}

// ───────────────────────────── recurso (RFC 8707) ─────────────────────────────

/**
 * O `resource` pedido é o nosso servidor MCP?
 *
 * Comparação por origem + caminho, ignorando barra final e query. Ser tolerante aqui é
 * deliberado: cliente que monta a URL com barra a mais não deveria falhar a autorização
 * inteira por isso, e o que importa de verdade é não emitir token para OUTRO recurso.
 */
export function recursoConfere(pedido: string | null | undefined, canonico: string): boolean {
  if (!pedido) return true; // omitir é permitido; o token vale para o recurso padrão
  const limpa = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.origin}${x.pathname.replace(/\/+$/, "")}`.toLowerCase();
    } catch {
      return "";
    }
  };
  const a = limpa(pedido);
  return a !== "" && a === limpa(canonico);
}

// ───────────────────────────── julgamento do código ─────────────────────────────

/** Estado mínimo de um código para ser julgado. Plano: o teste não precisa do Prisma. */
export type CodigoRow = {
  clientId: string;
  redirectUri: string;
  expiresAt: Date;
  usedAt: Date | null;
};

/**
 * O código pode ser resgatado? Devolve o motivo da recusa, ou `null`.
 *
 * ⚠️ **`usedAt` preenchido não é só "recusa".** Código resgatado duas vezes é o sintoma
 * clássico de código interceptado: alguém pegou a URL de retorno e chegou antes (ou depois)
 * do cliente legítimo. A especificação manda revogar tudo que foi emitido com aquele código
 * — quem chama esta função é responsável por isso, e o motivo `"reusado"` existe para
 * distinguir esse caso de um código simplesmente vencido.
 */
export function decideCodigo(
  row: CodigoRow,
  agora: Date,
  clientId: string,
  redirectUri: string,
): { ok: true } | { ok: false; erro: ErroOAuth; detalhe: string; reusado?: boolean } {
  if (row.usedAt) {
    return {
      ok: false,
      erro: "invalid_grant",
      detalhe: "código já resgatado",
      reusado: true,
    };
  }
  if (row.expiresAt.getTime() <= agora.getTime()) {
    return { ok: false, erro: "invalid_grant", detalhe: "código expirado" };
  }
  if (row.clientId !== clientId) {
    return { ok: false, erro: "invalid_grant", detalhe: "código não pertence a este cliente" };
  }
  if (row.redirectUri !== redirectUri) {
    return { ok: false, erro: "invalid_grant", detalhe: "redirect_uri diferente da usada na autorização" };
  }
  return { ok: true };
}

// ───────────────────────────── metadados de descoberta ─────────────────────────────

/**
 * RFC 8414 — o que o cliente lê para saber como falar com este servidor de autorização.
 * O CultPartners é o próprio AS; a Microsoft entra só como IdP do login humano.
 */
export function authorizationServerMetadata(base: string) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    scopes_supported: [...ESCOPOS_SUPORTADOS],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // Só S256: ver `desafioDe`. Anunciar `plain` seria oferecer o modo sem proteção.
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    revocation_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    service_documentation: `${base}/settings/mcp`,
  };
}

/** RFC 9728 — o recurso protegido aponta quem autoriza o acesso a ele. */
export function protectedResourceMetadata(base: string) {
  return {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    // Só header: token na URI é proibido pela especificação do MCP, e URL vaza em log.
    bearer_methods_supported: ["header"],
    scopes_supported: [...ESCOPOS_SUPORTADOS],
    resource_documentation: `${base}/settings/mcp`,
  };
}

// Nomes antigos, mantidos como apelido para quem já importava (rota .well-known do CRM).
export { authorizationServerMetadata as metadadosDoServidor };
export { protectedResourceMetadata as metadadosDoRecurso };
