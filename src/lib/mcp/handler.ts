import "server-only";

// Despacho dos métodos MCP do CultPartners. É aqui que identidade, catálogo, auditoria e
// limite se encontram — e o único lugar que sabe que existe um `Request`.
//
// Espelha `src/lib/mcp/handler.ts` do CRM, adaptado ao domínio:
//  - `mensagemRecusa` / `statusRecusa` / `MotivoRecusa` vivem em `@/lib/tokenAuth` (não há
//    `tokenRules` separado aqui);
//  - a lista de ferramentas é o export `tools` de `./tools`;
//  - `audit()` do CultPartners recebe o ator por `userId`/`userName`/`userEmail` (não um
//    objeto `user`), e o `context.route` é carimbado explicitamente.

import { z } from "zod";
import { audit } from "@/lib/audit";
import {
  mensagemRecusa,
  statusRecusa,
  touchToken,
  userFromApiToken,
  type MotivoRecusa,
  type TokenIdentidade,
} from "@/lib/tokenAuth";
import { baseUrl } from "@/lib/appUrl";
import { tools as FERRAMENTAS } from "./tools";
import { acharFerramenta, escopoDe, ferramentasDe, jsonSchemaDe } from "./catalog";
import { envelopar } from "./envelope";
import {
  ERRO_INTERNO,
  ERRO_METODO,
  ERRO_PEDIDO,
  erro,
  erroDeFerramenta,
  lerPedido,
  ok,
  respostaInitialize,
  textoDeFerramenta,
  type RpcId,
  type RpcResposta,
} from "./rpc";

/** Corpo além disto não é uso legítimo — é alguém empurrando trabalho de parse. */
const MAX_CORPO = 256 * 1024;

/**
 * `corpo` é OPCIONAL, não `unknown | null`: aquela união colapsa para `unknown` e o tipo deixa
 * de distinguir "sem corpo" de "corpo nulo". A diferença é real — notificação JSON-RPC não
 * leva corpo nenhum, e um `"null"` no corpo faz cliente estrito reclamar de resposta sem `id`.
 */
export type Saida = { status: number; corpo?: unknown; headers?: Record<string, string> };

/**
 * Trata um POST inteiro: autentica, despacha, audita.
 *
 * A ordem é deliberada — autenticar ANTES de ler o corpo. Um corpo grande de quem não tem
 * credencial não deve custar parse.
 */
export async function tratarPost(req: Request): Promise<Saida> {
  const auth = await userFromApiToken(req);
  if (!auth.ok) return recusa(auth.motivo, req);

  // Limite por janela vive na linha do token (vale entre instâncias serverless).
  const { excedeu } = await touchToken(auth.ident.token.id);
  if (excedeu) {
    return {
      status: 429,
      corpo: erro(null, ERRO_PEDIDO, "Limite de chamadas por minuto excedido para esta credencial."),
      headers: { "retry-after": "60" },
    };
  }

  let bruto: string;
  try {
    bruto = await req.text();
  } catch {
    return { status: 400, corpo: erro(null, ERRO_PEDIDO, "Não foi possível ler o corpo da requisição.") };
  }
  if (bruto.length > MAX_CORPO) {
    return { status: 413, corpo: erro(null, ERRO_PEDIDO, "Corpo grande demais.") };
  }

  let body: unknown;
  try {
    body = JSON.parse(bruto);
  } catch {
    // -32700 leva id nulo porque não deu nem para saber qual era o id.
    return { status: 400, corpo: erro(null, -32700, "JSON inválido.") };
  }

  const lido = lerPedido(body);
  if (lido.tipo === "erro") return { status: 400, corpo: erro(null, lido.codigo, lido.mensagem) };
  if (lido.tipo === "notificacao") {
    // Notificação não tem resposta, por definição do protocolo. 202 com corpo vazio.
    return { status: 202 };
  }

  const { id, method, params } = lido.pedido;
  try {
    return { status: 200, corpo: await despachar(id, method, params, auth.ident) };
  } catch (e) {
    // Falha nossa nunca vaza detalhe de banco para o outro lado; o console guarda.
    console.error(`[mcp] falha em ${method}:`, e);
    return { status: 200, corpo: erro(id, ERRO_INTERNO, "Erro interno ao atender a requisição.") };
  }
}

/**
 * `WWW-Authenticate` do 401 — com `resource_metadata` (RFC 9728).
 *
 * O cliente MCP leva 401, lê este header, busca o documento de metadados do recurso e começa a
 * descoberta do servidor de autorização — sem ninguém colar URL em lugar nenhum.
 */
function desafio(req: Request, erro?: string): string {
  const meta = `${baseUrl(req)}/.well-known/oauth-protected-resource`;
  const partes = [`Bearer realm="cultpartners"`];
  if (erro) partes.push(`error="${erro}"`);
  partes.push(`resource_metadata="${meta}"`);
  return partes.join(", ");
}

function recusa(motivo: MotivoRecusa, req: Request): Saida {
  return {
    status: statusRecusa(motivo),
    corpo: erro(null, ERRO_PEDIDO, mensagemRecusa(motivo)),
    // `invalid_token` (RFC 6750) só quando havia token e ele não serve. Para "ausente" o
    // desafio vai sem `error`, que é o que diz ao cliente "autentique-se", e não "a credencial
    // que você tem está ruim" — a diferença decide se ele reautoriza ou joga fora um token bom.
    headers: {
      "www-authenticate": desafio(
        req,
        motivo === "ausente" || motivo === "indisponivel" ? undefined : "invalid_token",
      ),
    },
  };
}

async function despachar(
  id: RpcId,
  method: string,
  params: Record<string, unknown>,
  ident: TokenIdentidade,
): Promise<RpcResposta> {
  switch (method) {
    case "initialize":
      return ok(id, respostaInitialize(params));

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: ferramentasDe(ident.user, FERRAMENTAS).map((f) => ({
          name: f.nome,
          title: f.titulo,
          description: f.descricao,
          inputSchema: jsonSchemaDe(f.entrada),
          // Declara em metadado que nada aqui altera estado. Cliente que respeita esta dica
          // deixa de pedir confirmação a cada leitura.
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        })),
      });

    case "tools/call":
      return ok(id, await chamarFerramenta(params, ident));

    default:
      return erro(id, ERRO_METODO, `Método não suportado: ${method}.`);
  }
}

async function chamarFerramenta(params: Record<string, unknown>, ident: TokenIdentidade) {
  const f = acharFerramenta(params.name, FERRAMENTAS);
  // Ferramenta inexistente e sem permissão são `isError` no RESULTADO, não erro de protocolo:
  // erro de protocolo muitos clientes tratam como conexão quebrada e nem mostram ao modelo, que
  // então conclui que o servidor caiu.
  if (!f) {
    return erroDeFerramenta(
      `Ferramenta desconhecida: ${String(params.name)}. Use tools/list para ver as disponíveis.`,
    );
  }
  if (!f.exige(ident.user)) {
    return erroDeFerramenta(
      `Sem permissão para "${f.nome}" com a credencial de ${ident.user.name ?? ident.user.id}. ` +
        `Use tools/list para ver as ferramentas que este acesso alcança.`,
    );
  }

  // ── Escopo OAuth, ao lado do RBAC e DEPOIS dele ──────────────────────────
  //
  // A ordem é a regra: o RBAC decide o que a PESSOA alcança; o escopo só **estreita** isso para
  // o que ela consentiu em dar a ESTE aplicativo. Escopo nunca amplia. Token colado à mão
  // (`kind: "pat"`) nasce com `["read"]`, então passa igual.
  const escopo = escopoDe(f);
  if (!ident.token.scopes.includes(escopo)) {
    return erroDeFerramenta(
      `A credencial usada não tem o escopo "${escopo}", exigido por "${f.nome}". ` +
        `Ela foi autorizada apenas para: ${ident.token.scopes.join(", ") || "(nenhum)"}. ` +
        `Reautorize o aplicativo pedindo esse escopo.`,
    );
  }

  const args = f.entrada.safeParse(params.arguments ?? {});
  if (!args.success) {
    return erroDeFerramenta(
      `Argumentos inválidos para "${f.nome}": ${resumirZod(args.error)}. Confira o inputSchema em tools/list.`,
    );
  }

  let dados: unknown;
  try {
    dados = await f.run(args.data as never, { user: ident.user });
  } catch (e) {
    console.error(`[mcp] ferramenta ${f.nome} falhou:`, e);
    return erroDeFerramenta(`A ferramenta "${f.nome}" falhou ao consultar o CultPartners. Tente novamente ou reduza o escopo.`);
  }

  await auditarChamada(f.nome, dados, ident);
  // Envelope SEMPRE, inclusive em resultado sem texto livre: a cerca é o que ensina o modelo a
  // tratar tudo que vem daqui como dado. Aplicá-la só "quando tem nota" faria a fronteira
  // aparecer e desaparecer.
  return textoDeFerramenta(envelopar(dados));
}

function resumirZod(e: z.ZodError): string {
  return e.issues
    .slice(0, 4)
    .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`)
    .join("; ");
}

/** Acima disto a leitura deixa de ser consulta e passa a ser extração. */
const LIMIAR_EXPORT = 50;

/**
 * Uma linha de auditoria por `tools/call`.
 *
 * Duas decisões:
 *  - **`route` explícito.** `requestContext()` (`src/lib/audit.ts`) deriva a rota do `referer`,
 *    e cliente MCP não manda nenhum — sem isto toda a trilha do servidor apareceria com rota
 *    vazia.
 *  - **Acima de 50 registros o evento sobe de VIEW para EXPORT.** Levar centenas de registros
 *    para dentro de um chat é exportação, e a trilha precisa poder responder "quem tirou dado
 *    em volume" sem ler linha por linha.
 */
async function auditarChamada(ferramenta: string, dados: unknown, ident: TokenIdentidade) {
  const registros = contarRegistros(dados);
  const exportacao = registros > LIMIAR_EXPORT;

  await audit({
    action: exportacao ? "EXPORT" : "VIEW",
    entityType: "McpTool",
    entityId: ferramenta,
    entityLabel: ferramenta,
    summary: exportacao
      ? `leu ${registros} registros por MCP em ${ferramenta}`
      : `chamou ${ferramenta} por MCP`,
    meta: {
      canal: "mcp",
      ferramenta,
      registros,
      tokenId: ident.token.id,
      tokenNome: ident.token.name,
      tokenPrefixo: ident.token.prefix,
    },
    // O ator vem explícito: `audit()` do CultPartners recebe id/nome/email, não um objeto
    // `user`. Sem `context.route` a linha sairia com rota vazia (não há `referer` no MCP).
    userId: ident.user.id,
    userName: ident.user.name ?? null,
    userEmail: ident.user.email ?? null,
    context: { route: "/api/mcp" },
  });
}

/**
 * Quantos registros a resposta carrega. Heurística de propósito — o objetivo é separar
 * "consultou" de "levou a base", não contar exato. Conta arrays em qualquer profundidade e para
 * cedo: uma resposta de relatório tem dezenas de arrays pequenos e não precisa de varredura
 * completa para se saber que não é extração.
 */
function contarRegistros(v: unknown, profundidade = 0): number {
  if (profundidade > 4 || v === null || typeof v !== "object") return 0;
  if (Array.isArray(v)) {
    return v.length + v.reduce<number>((s, i) => s + contarRegistros(i, profundidade + 1), 0);
  }
  return Object.values(v as Record<string, unknown>).reduce<number>(
    (s, i) => s + contarRegistros(i, profundidade + 1),
    0,
  );
}

/**
 * Resposta do GET, e a distinção importa.
 *
 * No streamable HTTP, GET no endpoint é o pedido de abrir um stream SSE. Este servidor é sem
 * estado e não oferece SSE, então:
 *
 *  - **sem credencial válida → 401** com `WWW-Authenticate`;
 *  - **com credencial válida → 405** e `Allow: POST`.
 *
 * Responder 401 a um cliente JÁ autenticado seria dizer "sua credencial não serve" quando ela
 * serve — e o cliente entraria em laço de reautenticação. O que falta ali é o método, não a
 * credencial.
 */
export async function tratarGet(req: Request): Promise<Saida> {
  const auth = await userFromApiToken(req);
  const comum = {
    servidor: "Servidor MCP do CultPartners (somente leitura).",
    comoConectar:
      'claude mcp add cultpartners --transport http <URL>/api/mcp --header "Authorization: Bearer cp_..."',
  };

  if (!auth.ok) {
    return {
      status: statusRecusa(auth.motivo),
      corpo: { erro: "autenticacao_necessaria", mensagem: mensagemRecusa(auth.motivo), ...comum },
      headers: {
        "www-authenticate": desafio(
          req,
          auth.motivo === "ausente" || auth.motivo === "indisponivel" ? undefined : "invalid_token",
        ),
      },
    };
  }

  return {
    status: 405,
    corpo: {
      erro: "metodo_nao_permitido",
      mensagem:
        "Credencial válida, mas este endpoint não abre stream por GET (não há SSE: o transporte é " +
        "sem estado). Mande JSON-RPC 2.0 por POST.",
      ...comum,
    },
    headers: { allow: "POST" },
  };
}
