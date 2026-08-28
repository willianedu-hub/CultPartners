import "server-only";

// A casca de toda rota `/api/v1/**` do CultPartners. Autentica, chama a FERRAMENTA, limpa,
// valida, audita. Espelha `src/lib/api/rota.ts` do CRM, adaptado ao domínio.
//
// A decisão que organiza este arquivo: **a REST reaproveita o `run` das ferramentas MCP.**
// Não é economia de linhas — é o que garante que o número da API seja o MESMO número do MCP e
// da tela, por construção. Uma segunda consulta com o `where` copiado é a forma mais comum de
// duas superfícies divergirem seis meses depois: alguém copia o molde sem o filtro de escopo.
//
// O que muda em relação ao MCP (mesma tabela do CRM):
//
//  | | MCP | REST (aqui) |
//  |---|---|---|
//  | envelope com cerca e marca | sim | **não** — corromperia o valor num programa |
//  | limpeza de invisíveis | sim | **sim** — faz mal a qualquer consumidor |
//  | escopo | avisado em prosa | campo `escopo` estruturado |
//  | "não é seu" | `encontrada: false` | **404**, igual a "não existe" |
//  | teto por minuto | 120 (chat) | 600 (programa), com cabeçalhos `RateLimit-*` |

import { z } from "zod";
import { audit } from "@/lib/audit";
import { limparProfundo } from "@/lib/textoSeguro";
import { baseUrl } from "@/lib/appUrl";
import { isAdmin, type SessionUser } from "@/lib/rbac";
import {
  mensagemRecusa,
  statusRecusa,
  touchToken,
  userFromApiToken,
  type MotivoRecusa,
} from "@/lib/tokenAuth";
import { acharFerramenta, escopoDe } from "@/lib/mcp/catalog";
import { FERRAMENTAS } from "@/lib/mcp/tools";
import type { CodigoErro } from "./saidas";

export type DefinicaoRota = {
  /** Método e caminho, para o OpenAPI e para a mensagem de erro. */
  metodo: "GET" | "POST";
  caminho: string;
  /** Uma linha: o que este endereço responde. Vai para o OpenAPI. */
  resumo: string;
  /** A ferramenta MCP que faz o trabalho. O nome é conferido na carga (ver `rotaDe`). */
  ferramenta: string;
  /** Monta os argumentos da ferramenta a partir da URL e do corpo. */
  args: (ctx: { url: URL; params: Record<string, string>; corpo: Record<string, unknown> }) => Record<string, unknown>;
  /** Schema de saída: documenta o OpenAPI e valida em desenvolvimento. */
  saida: z.ZodType;
  /**
   * A ferramenta devolveu "não achei"? Vira **404**.
   *
   * As ferramentas dizem `{ encontrada: false, motivo }` porque um chat lê a frase. Um programa
   * lê o status, e é aqui que a tradução acontece — preservando de graça a decisão anti-oráculo:
   * "não é sua" e "não existe" são o mesmo 404.
   */
  ausente?: (dados: Record<string, unknown>) => boolean;
  /** Anota `escopo` estruturado na resposta. Omitir = não anota (catálogo global, identidade). */
  escopo?: boolean;
};

/** Corpo grande de quem não tem credencial não deve custar parse. */
const MAX_CORPO = 128 * 1024;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

export function preflightV1(): Response {
  return new Response(null, { status: 204, headers: { ...CORS, "access-control-max-age": "86400" } });
}

function json(corpo: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS, ...extra },
  });
}

export function erroV1(
  codigo: CodigoErro,
  mensagem: string,
  status: number,
  extra: Record<string, string> = {},
  detalhe?: string,
): Response {
  return json({ error: { codigo, mensagem, ...(detalhe ? { detalhe } : {}) } }, status, extra);
}

/**
 * `escopo` estruturado, derivado da MESMA regra de escopo do servidor (`rbac`/`dados`).
 *
 * `ALL` = admin (todo o canal); `TEAM` = executivo de canal (só os seus parceiros); `OWNER` =
 * parceiro (só as suas). Na v1 todo token é interno, então na prática sai `ALL` ou `TEAM` — o
 * `OWNER` fica escrito para o dia em que existir token de parceiro, e o `switch` do consumidor
 * já precisa tratá-lo.
 */
function escopoDaResposta(user: SessionUser): "OWNER" | "TEAM" | "ALL" {
  if (isAdmin(user)) return "ALL";
  if (user.audience === "partner") return "OWNER";
  return "TEAM";
}

/**
 * A partir disto a leitura deixa de ser consulta e passa a ser extração.
 *
 * `>=` e não `>`, ao contrário do MCP: aqui a página **topa em 50** (`TAM_PAGINA`), então "mais
 * de 50" nunca aconteceria numa listagem e o evento EXPORT seria inalcançável — a trilha
 * registraria tudo como VIEW e a pergunta "quem tirou dado em volume?" não teria resposta. Uma
 * página cheia É o sinal de que alguém pediu o máximo.
 */
const LIMIAR_EXPORT = 50;

function contarRegistros(dados: unknown): number {
  if (!dados || typeof dados !== "object") return 0;
  const d = dados as Record<string, unknown>;
  let n = 0;
  for (const v of Object.values(d)) if (Array.isArray(v)) n += v.length;
  return n;
}

/**
 * Atende um pedido inteiro. É a única função que as rotas chamam.
 *
 * A ordem é deliberada: autenticar ANTES de ler o corpo, e conferir o escopo do token ANTES de
 * tocar no banco.
 */
export async function atender(
  req: Request,
  def: DefinicaoRota,
  params: Record<string, string> = {},
): Promise<Response> {
  const auth = await userFromApiToken(req);
  if (!auth.ok) return recusa(req, auth.motivo);
  const { user, token } = auth.ident;

  // Mesmo contador de janela do MCP (na linha do token), com o teto MAIOR da REST.
  const uso = await touchToken(token.id, new Date(), "api");
  const cabecalhosLimite = {
    "ratelimit-limit": String(uso.teto),
    "ratelimit-remaining": String(uso.restam),
    "ratelimit-reset": String(uso.resetEmS),
  };
  if (uso.excedeu) {
    return erroV1("limite_excedido", `Limite de ${uso.teto} chamadas por minuto excedido para esta credencial.`, 429, {
      ...cabecalhosLimite,
      "retry-after": String(uso.resetEmS),
    });
  }

  const f = acharFerramenta(def.ferramenta, FERRAMENTAS);
  if (!f) {
    // Só acontece se alguém renomear uma ferramenta e esquecer a rota. Erro nosso, 500.
    console.error(`[api] rota ${def.caminho} aponta para ferramenta inexistente: ${def.ferramenta}`);
    return erroV1("erro_interno", "Endpoint mal configurado no servidor.", 500, cabecalhosLimite);
  }

  // O RBAC decide o que a PESSOA alcança; o escopo do token só estreita para o que ela
  // consentiu dar a este aplicativo. Nunca amplia. Mesma regra do `handler.ts` do MCP.
  const escopoExigido = escopoDe(f);
  if (!token.scopes.includes(escopoExigido)) {
    return erroV1(
      "escopo_insuficiente",
      `A credencial não tem o escopo "${escopoExigido}", exigido por este endpoint.`,
      403,
      cabecalhosLimite,
      `Escopos autorizados: ${token.scopes.join(", ") || "(nenhum)"}.`,
    );
  }
  if (!f.exige(user)) {
    return erroV1("sem_permissao", "Seu acesso no CultPartners não alcança este recurso.", 403, cabecalhosLimite);
  }

  let corpo: Record<string, unknown> = {};
  if (def.metodo === "POST") {
    let bruto: string;
    try {
      bruto = await req.text();
    } catch {
      return erroV1("parametro_invalido", "Não foi possível ler o corpo da requisição.", 400, cabecalhosLimite);
    }
    if (bruto.length > MAX_CORPO) {
      return erroV1("parametro_invalido", "Corpo grande demais.", 413, cabecalhosLimite);
    }
    if (bruto) {
      try {
        const o: unknown = JSON.parse(bruto);
        if (typeof o !== "object" || o === null || Array.isArray(o)) throw new Error("não é objeto");
        corpo = o as Record<string, unknown>;
      } catch {
        return erroV1("parametro_invalido", "O corpo precisa ser um objeto JSON.", 400, cabecalhosLimite);
      }
    }
  }

  const url = new URL(req.url);
  const brutos = def.args({ url, params, corpo });
  const args = f.entrada.safeParse(brutos);
  if (!args.success) {
    return erroV1(
      "parametro_invalido",
      "Parâmetros inválidos.",
      400,
      cabecalhosLimite,
      args.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
        .join("; "),
    );
  }

  let dados: unknown;
  try {
    dados = await f.run(args.data as never, { user });
  } catch (e) {
    console.error(`[api] ${def.caminho} falhou:`, e);
    return erroV1("erro_interno", "Não foi possível consultar o CultPartners agora.", 500, cabecalhosLimite);
  }

  const obj = (dados ?? {}) as Record<string, unknown>;
  if (def.ausente?.(obj)) {
    // 404 tanto para inexistente quanto para fora do escopo — ver `DefinicaoRota.ausente`.
    return erroV1("nao_encontrado", "Recurso não encontrado.", 404, cabecalhosLimite);
  }

  // O `escopo` entra ANTES da limpeza para ele também passar pela serialização — e depois do
  // `ausente`, porque num 404 ele não significa nada.
  const comEscopo = def.escopo ? { ...obj, escopo: escopoDaResposta(user) } : obj;

  // **Sem envelope, COM limpeza.** Ver o cabeçalho de `src/lib/textoSeguro.ts`.
  const limpo = limparProfundo(comEscopo);

  conferirSaida(def, limpo);
  await auditar(def, comEscopo, user, token);

  return json(limpo, 200, cabecalhosLimite);
}

/**
 * A validação de saída está ligada?
 *
 * **Não dá para usar só o `NODE_ENV`**: `next start` roda com `NODE_ENV=production` por
 * definição, então a garantia ficaria desligada justamente onde ela é exercitada — nos roteiros
 * e2e, que precisam de um servidor construído. Daí o interruptor explícito: `CP_VALIDA_SAIDA=1`
 * liga, `=0` desliga, e sem a variável vale o padrão pelo ambiente.
 */
function validacaoLigada(): boolean {
  const v = process.env.CP_VALIDA_SAIDA;
  if (v === "1") return true;
  if (v === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Valida a resposta contra o schema — **fora de produção**, e sem tocar no payload.
 *
 * O `parse` do zod remove chave desconhecida em silêncio; usar o resultado dele como resposta
 * seria "documentar" apagando dado de quem integrou. Então aqui só se OLHA: a resposta
 * serializada é sempre o objeto original (já limpo).
 *
 * Estourar (e não avisar) é a escolha certa: um schema que divergiu em silêncio produz um
 * OpenAPI que mente, e OpenAPI que mente é pior que OpenAPI que falta.
 */
function conferirSaida(def: DefinicaoRota, limpo: unknown): void {
  if (!validacaoLigada()) return;
  const r = def.saida.safeParse(limpo);
  if (r.success) return;
  const resumo = r.error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
    .join("; ");
  throw new Error(
    `[api] a resposta de ${def.metodo} ${def.caminho} divergiu do schema de saída — ` +
      `atualize \`src/lib/api/saidas.ts\` (e o OpenAPI acompanha). Divergências: ${resumo}`,
  );
}

/**
 * Uma linha de auditoria por chamada, com `canal: "rest"`.
 *
 * `audit()` do CultPartners recebe o ator por `userId`/`userName`/`userEmail` (não um objeto
 * `user`), e `context.route` é carimbado explicitamente — sem ele a trilha da API sairia com
 * rota vazia, porque `requestContext()` deriva a rota do `referer` e programa nenhum manda um.
 */
async function auditar(
  def: DefinicaoRota,
  dados: Record<string, unknown>,
  user: SessionUser,
  token: { id: string; name: string; prefix: string; scopes: string[] },
): Promise<void> {
  const registros = contarRegistros(dados);
  const exportacao = registros >= LIMIAR_EXPORT;
  await audit({
    action: exportacao ? "EXPORT" : "VIEW",
    entityType: "ApiV1",
    entityId: def.caminho,
    entityLabel: def.caminho,
    summary: exportacao
      ? `leu ${registros} registros pela API em ${def.caminho}`
      : `chamou ${def.caminho} pela API`,
    meta: {
      canal: "rest",
      endpoint: def.caminho,
      ferramenta: def.ferramenta,
      registros,
      tokenId: token.id,
      tokenNome: token.name,
      tokenPrefixo: token.prefix,
      escopo: dados.escopo ?? null,
      admin: isAdmin(user),
    },
    userId: user.id,
    userName: user.name ?? null,
    userEmail: user.email ?? null,
    context: { route: def.caminho },
  });
}

/**
 * `WWW-Authenticate` com `resource_metadata`: é o que faz um cliente OAuth descobrir o servidor
 * de autorização sozinho ao levar 401 aqui, igual ao MCP (`handler.ts`).
 */
function recusa(req: Request, motivo: MotivoRecusa): Response {
  const codigo: CodigoErro = motivo === "indisponivel" ? "indisponivel" : "nao_autenticado";
  const partes = [`Bearer realm="cultpartners"`];
  // `invalid_token` só quando HAVIA token e ele não serve: para "ausente" o desafio sai sem
  // `error`, que diz "autentique-se" em vez de "a credencial que você tem está ruim" — a
  // diferença decide se o cliente reautoriza ou joga fora um token que está bom.
  if (motivo !== "ausente" && motivo !== "indisponivel") partes.push(`error="invalid_token"`);
  partes.push(`resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"`);
  return erroV1(codigo, mensagemRecusa(motivo), statusRecusa(motivo), {
    "www-authenticate": partes.join(", "),
  });
}

// ───────────────────────────── ajuda para as rotas ─────────────────────────────

/** Lê um inteiro da query, ou `undefined`. Valor inválido é ignorado, não recusado. */
export function inteiro(url: URL, nome: string): number | undefined {
  const v = url.searchParams.get(nome);
  if (v === null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
}

/** Lê uma string da query, ou `undefined` (vazia conta como ausente). */
export function texto(url: URL, nome: string): string | undefined {
  const v = url.searchParams.get(nome);
  return v && v.trim() !== "" ? v.trim() : undefined;
}

/** Lê um booleano da query: `true`/`1`/`sim` ligam. */
export function booleano(url: URL, nome: string): boolean | undefined {
  const v = url.searchParams.get(nome);
  if (v === null) return undefined;
  return ["true", "1", "sim", ""].includes(v.toLowerCase());
}
