import "server-only";

// Leitura e validação dos parâmetros dos três endpoints do fluxo: `/authorize`, `/token` e
// `/register`. Estar num arquivo só não é estética.
//
// No `/authorize`, os TRÊS lugares que precisam concordar — o `GET`, a tela de consentimento
// e o `POST` — leem o pedido pela MESMA função. Se a tela validasse menos que o POST, alguém
// montaria o formulário à mão e pularia a checagem; se validasse mais, o botão apareceria
// para um pedido que o POST recusa.
//
// ⚠️ **A distinção mais importante deste arquivo é entre erro que redireciona e erro que
// não redireciona.** Se o `client_id` ou a `redirect_uri` estão errados, mandar o erro de
// volta pela `redirect_uri` seria usar um endereço que não foi verificado — exatamente o
// que um atacante quer (ele registra a URL dele e o servidor vira redirecionador aberto).
// Nesses dois casos o erro é mostrado numa página própria. Todo o resto volta pelo redirect,
// como a RFC 6749 §4.1.2.1 manda.

import { urlDoMcp } from "@/lib/appUrl";
import {
  ESCOPOS_SUPORTADOS,
  escoposConcedidos,
  recursoConfere,
  redirectPermitido,
  redirectRegistravel,
  type ErroOAuth,
  type Escopo,
} from "./rules";
import { acharCliente, type ClienteRow } from "./store";

// ═══════════════════════════════ /authorize ═══════════════════════════════

export type PedidoAutorizacao = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
  scopes: Escopo[];
  resource: string | null;
};

export type Analise =
  | { tipo: "ok"; pedido: PedidoAutorizacao; cliente: ClienteRow }
  /** Não dá para devolver pelo redirect: o endereço em si não é confiável. */
  | { tipo: "fatal"; titulo: string; detalhe: string }
  | { tipo: "devolver"; redirectUri: string; erro: ErroOAuth; detalhe: string; state: string | null };

export async function analisarPedido(p: URLSearchParams, req: Request): Promise<Analise> {
  const clientId = p.get("client_id");
  const cliente = await acharCliente(clientId);
  if (!cliente) {
    return {
      tipo: "fatal",
      titulo: "Aplicativo desconhecido",
      detalhe: "O `client_id` deste pedido não está registrado no CultPartners. Registre o conector novamente.",
    };
  }
  if (cliente.disabled) {
    return {
      tipo: "fatal",
      titulo: "Aplicativo desativado",
      detalhe: `O acesso do aplicativo “${cliente.name}” foi desativado por um administrador do CultPartners.`,
    };
  }

  // Omitir a `redirect_uri` só é aceitável quando não há ambiguidade — com duas
  // registradas, escolher uma por conta própria seria adivinhar para onde mandar o código.
  const pedida = p.get("redirect_uri") ?? (cliente.redirectUris.length === 1 ? cliente.redirectUris[0] : null);
  if (!pedida) {
    return {
      tipo: "fatal",
      titulo: "Endereço de retorno ausente",
      detalhe: "Este aplicativo tem mais de um endereço registrado, então `redirect_uri` é obrigatória.",
    };
  }
  if (!redirectPermitido(pedida, cliente.redirectUris)) {
    return {
      tipo: "fatal",
      titulo: "Endereço de retorno não registrado",
      detalhe:
        "O endereço para onde este pedido quer voltar não é um dos registrados por este aplicativo. " +
        "O CultPartners não devolve nada para um endereço que ele não conhece.",
    };
  }

  const state = p.get("state");
  const devolver = (erro: ErroOAuth, detalhe: string): Analise =>
    ({ tipo: "devolver", redirectUri: pedida, erro, detalhe, state });

  const tipoResposta = p.get("response_type");
  if (tipoResposta !== "code") {
    // `token` (fluxo implícito) foi REMOVIDO no OAuth 2.1 — não é "não implementamos".
    return devolver("invalid_request", `response_type não suportado: ${tipoResposta ?? "(ausente)"} (só code)`);
  }

  const desafio = p.get("code_challenge");
  const metodo = p.get("code_challenge_method") ?? "";
  if (!desafio) {
    // PKCE é OBRIGATÓRIO aqui, inclusive para cliente confidencial: no OAuth 2.1 ele
    // deixou de ser proteção só de cliente público.
    return devolver("invalid_request", "code_challenge é obrigatório (PKCE S256)");
  }
  if (metodo !== "S256") {
    return devolver("invalid_request", `code_challenge_method não suportado: ${metodo || "(ausente)"} (só S256)`);
  }

  const recurso = p.get("resource");
  // RFC 8707: o token nasce amarrado a um recurso. Aceitar um recurso de terceiro seria
  // emitir credencial para outro servidor com o consentimento dado a este.
  if (recurso && !recursoConfere(recurso, urlDoMcp(req))) {
    return devolver("invalid_request", `resource não corresponde a este servidor: ${recurso}`);
  }

  const escopos = escoposConcedidos(p.get("scope"));
  // Só chega aqui se TUDO que foi pedido é desconhecido — `escoposConcedidos` já descarta
  // o que sobra e cai no padrão quando nada foi pedido.
  if (escopos.length === 0) {
    return devolver("invalid_scope", `nenhum escopo suportado em "${p.get("scope")}"`);
  }

  return {
    tipo: "ok",
    cliente,
    pedido: {
      clientId: cliente.clientId,
      redirectUri: pedida,
      state,
      codeChallenge: desafio,
      codeChallengeMethod: metodo,
      scopes: escopos,
      resource: recurso,
    },
  };
}

/** Monta a volta com erro, preservando o `state` (é como o cliente casa ida e volta). */
export function urlDeErro(redirectUri: string, erro: ErroOAuth, detalhe: string, state: string | null): string {
  const u = new URL(redirectUri);
  u.searchParams.set("error", erro);
  u.searchParams.set("error_description", detalhe);
  if (state !== null) u.searchParams.set("state", state);
  return u.toString();
}

/** Monta a volta com sucesso. */
export function urlDeSucesso(redirectUri: string, codigo: string, state: string | null): string {
  const u = new URL(redirectUri);
  u.searchParams.set("code", codigo);
  if (state !== null) u.searchParams.set("state", state);
  return u.toString();
}

/** Os parâmetros que a tela de consentimento tem que repassar intactos para o POST. */
export const CAMPOS_DO_PEDIDO = [
  "client_id",
  "redirect_uri",
  "response_type",
  "state",
  "scope",
  "code_challenge",
  "code_challenge_method",
  "resource",
] as const;

// ═══════════════════════════════ /token ═══════════════════════════════

/** Grants que este servidor troca. Os outros do OAuth 2.0 foram removidos no 2.1. */
export type TipoGrant = "authorization_code" | "refresh_token";

export type PedidoToken =
  | { tipo: "authorization_code"; code: string; redirectUri: string; codeVerifier: string | null }
  | { tipo: "refresh_token"; refreshToken: string; scope: string | null }
  | { tipo: "erro"; erro: ErroOAuth; detalhe: string };

/**
 * Lê e valida o corpo do `/token` (já sem as credenciais do cliente, que o endpoint autentica
 * antes). Falta de parâmetro obrigatório vira `invalid_request`; grant desconhecido vira
 * `unsupported_grant_type` — o cliente descobre agora, não no meio do fluxo.
 *
 * A conferência do PKCE NÃO acontece aqui: ela precisa do `code_challenge` guardado no banco
 * e tem que rodar DEPOIS de o código ser consumido. Aqui só se extrai o `code_verifier`.
 */
export function lerPedidoToken(corpo: Record<string, string>): PedidoToken {
  const grant = corpo.grant_type;
  if (grant === "authorization_code") {
    if (!corpo.code) return { tipo: "erro", erro: "invalid_request", detalhe: "code é obrigatório" };
    // `redirect_uri` é obrigatória no resgate mesmo que o `/authorize` a tenha inferido: é a
    // segunda conferência do endereço, e é ela que impede o código de ser resgatado por quem
    // o interceptou num endereço diferente.
    if (!corpo.redirect_uri) {
      return { tipo: "erro", erro: "invalid_request", detalhe: "redirect_uri é obrigatória no resgate" };
    }
    return {
      tipo: "authorization_code",
      code: corpo.code,
      redirectUri: corpo.redirect_uri,
      codeVerifier: corpo.code_verifier || null,
    };
  }
  if (grant === "refresh_token") {
    if (!corpo.refresh_token) return { tipo: "erro", erro: "invalid_request", detalhe: "refresh_token é obrigatório" };
    return { tipo: "refresh_token", refreshToken: corpo.refresh_token, scope: corpo.scope || null };
  }
  return {
    tipo: "erro",
    erro: "unsupported_grant_type",
    detalhe: `grant_type não suportado: ${grant ?? "(ausente)"} (só authorization_code e refresh_token)`,
  };
}

// ═══════════════════════════════ /register (RFC 7591) ═══════════════════════════════

/** Erros de metadado têm código PRÓPRIO na RFC 7591 — não são os erros do `/token`. */
export type ErroRegistro = "invalid_client_metadata" | "invalid_redirect_uri";

export type MetadadosRegistro = {
  name: string;
  redirectUris: string[];
  scopes: string[];
  publico: boolean;
  /** o `token_endpoint_auth_method` aceito, ecoado de volta na resposta do registro */
  metodo: "none" | "client_secret_post" | "client_secret_basic";
};

export type ResultadoRegistro =
  | { ok: true; dados: MetadadosRegistro }
  | { ok: false; error: ErroRegistro; error_description: string };

/** Teto de `redirect_uris` por cliente e tamanho máximo do nome. */
export const MAX_REDIRECTS = 5;
export const MAX_NOME = 120;

function lista(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
  return [];
}

/**
 * Valida o corpo JSON do `/register` — pura, sem banco. Devolve o metadado normalizado ou o
 * erro no formato da RFC 7591 (`invalid_client_metadata` / `invalid_redirect_uri`).
 *
 * Registro não é acesso: quem se registra só ganha o direito de pedir a uma pessoa logada que
 * ela consinta. Por isso o que se valida aqui é FORMA, não confiança — o que segura o acesso
 * é o consentimento, depois.
 */
export function validarRegistro(corpo: Record<string, unknown> | null): ResultadoRegistro {
  if (!corpo) return { ok: false, error: "invalid_client_metadata", error_description: "corpo não é um objeto JSON" };

  const redirects = lista(corpo.redirect_uris);
  if (redirects.length === 0) {
    return { ok: false, error: "invalid_redirect_uri", error_description: "redirect_uris é obrigatório e não pode ser vazio" };
  }
  if (redirects.length > MAX_REDIRECTS) {
    return { ok: false, error: "invalid_redirect_uri", error_description: `no máximo ${MAX_REDIRECTS} redirect_uris` };
  }
  for (const uri of redirects) {
    const v = redirectRegistravel(uri);
    if (!v.ok) {
      return { ok: false, error: "invalid_redirect_uri", error_description: `redirect_uri inválida (${uri}): ${v.motivo}` };
    }
  }
  // Duplicata na lista não é erro do cliente, mas vira ruído no `includes` do resgate.
  const unicas = [...new Set(redirects)];

  const grants = lista(corpo.grant_types);
  const foraGrant = grants.filter((g) => g !== "authorization_code" && g !== "refresh_token");
  if (foraGrant.length > 0) {
    // `implicit` e `password` foram REMOVIDOS pelo OAuth 2.1. Recusar explicitamente é melhor
    // que ignorar: o cliente descobre agora, e não no primeiro resgate.
    return {
      ok: false,
      error: "invalid_client_metadata",
      error_description: `grant_type não suportado: ${foraGrant.join(", ")} (só authorization_code e refresh_token)`,
    };
  }

  const respostas = lista(corpo.response_types);
  if (respostas.some((r) => r !== "code")) {
    return { ok: false, error: "invalid_client_metadata", error_description: "response_type não suportado (só code)" };
  }

  const metodoBruto = typeof corpo.token_endpoint_auth_method === "string" ? corpo.token_endpoint_auth_method : "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(metodoBruto)) {
    return { ok: false, error: "invalid_client_metadata", error_description: `token_endpoint_auth_method não suportado: ${metodoBruto}` };
  }
  const metodo = metodoBruto as MetadadosRegistro["metodo"];
  const publico = metodo === "none";

  const nome = (typeof corpo.client_name === "string" ? corpo.client_name.trim() : "") || "Cliente OAuth";
  if (nome.length > MAX_NOME) {
    return { ok: false, error: "invalid_client_metadata", error_description: `client_name muito longo (máximo ${MAX_NOME})` };
  }

  // Escopo desconhecido é DESCARTADO, não recusado — o cliente pede o que sabe pedir, e quem
  // manda no que vale é o consentimento. Mas se sobrar nada, é engano: avisa.
  const pedidos = typeof corpo.scope === "string" ? corpo.scope.split(/\s+/).filter(Boolean) : [];
  const escopos =
    pedidos.length === 0 ? ["read"] : pedidos.filter((e) => (ESCOPOS_SUPORTADOS as readonly string[]).includes(e));
  if (escopos.length === 0) {
    return { ok: false, error: "invalid_client_metadata", error_description: `nenhum escopo suportado em "${String(corpo.scope)}"` };
  }

  return { ok: true, dados: { name: nome, redirectUris: unicas, scopes: escopos, publico, metodo } };
}
