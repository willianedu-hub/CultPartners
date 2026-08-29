import "server-only";

// Autenticação por TOKEN DE MÁQUINA (MCP) — a segunda porta de entrada do CultPartners.
//
// Espelha `src/lib/tokenAuth.ts` do CRM, adaptado ao domínio:
//
//  - Formato do token: `cp_<prefixo8>_<segredo>`, lido por POSIÇÃO (não por `split("_")`,
//    porque o corpo do segredo é base64url e pode conter `_`).
//  - `tokenHash` = SHA-256 do token inteiro. A igualdade acontece dentro do índice `@unique`
//    do Postgres (`findUnique`) — não há comparação de segredo no código do app.
//  - **fail-CLOSED**: se não deu para verificar (banco fora do ar), o acesso é negado. Do
//    outro lado há um chat automatizado, não uma pessoa olhando a tela — o contrário do
//    caminho do navegador (`rbac.ts`), onde uma falha de leitura NÃO derruba ninguém.
//  - Identidade: os tokens MCP pertencem a usuários INTERNOS (admins/executivos de canal).
//    `ApiToken.userId` → `User` → `SessionUser` de audiência "internal". NÃO há token de
//    parceiro na v1.
//  - **Somente `Authorization: Bearer`.** Nunca query string: a especificação do MCP proíbe
//    token na URI, e a URL vaza em log de acesso, histórico e `Referer`.
//
// Toda mudança aqui merece a mesma desconfiança que uma mudança no login.

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { isAdmin, type SessionUser } from "@/lib/rbac";
import { loadSessionUser } from "@/lib/sessionUser";

// ───────────────────────────── formato do token ─────────────────────────────

/** Marca do produto no token, para o segredo ser reconhecível num vazamento. */
export const TOKEN_MARK = "cp";
/** Caracteres do prefixo visível. */
export const PREFIX_LEN = 8;
/** Bytes de entropia do segredo. 32 bytes = 256 bits (não há dicionário a resistir). */
export const SECRET_BYTES = 32;

/** Alfabeto do corpo do segredo: base64url, que inclui `-` e `_`. */
const B64URL = /^[A-Za-z0-9_-]+$/;
/** Alfabeto do PREFIXO: sem `-` e sem `_`, para a leitura por posição ser única. */
const ALFANUM = /^[A-Za-z0-9]+$/;

/**
 * Por que o token foi recusado. Motivo separado da mensagem de propósito: o cliente recebe
 * um texto genérico, e o motivo detalhado fica para o log — responder "expirado" vs.
 * "desconhecido" já é um oráculo para quem está sondando.
 */
export type MotivoRecusa =
  | "ausente" // não veio Authorization: Bearer
  | "malformado" // veio, mas não é um token nosso
  | "desconhecido" // não existe linha com este hash
  | "revogado"
  | "expirado"
  | "inativo" // usuário desligado, excluído ou não-interno
  | "indisponivel"; // não deu para verificar (banco fora do ar) → fail-CLOSED

/** Um token recém-emitido: o segredo (mostrado UMA vez) e o que vai para o banco. */
export type NovoToken = { secret: string; prefix: string; tokenHash: string };

/**
 * `cp_<prefixo8>_<segredo>`. Três partes porque o prefixo tem que ser legível na tela e
 * localizável no banco **sem** o segredo — é assim que a pessoa reconhece qual token revogar.
 */
export function formatToken(prefix: string, secret: string): string {
  return `${TOKEN_MARK}_${prefix}_${secret}`;
}

/** SHA-256 do token inteiro, em hex. Determinístico: é o que o banco guarda em `tokenHash`. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Gera um token novo para a tela de credenciais. O `secret` devolvido é a ÚNICA vez que ele
 * existe em texto — guarde apenas `prefix` e `tokenHash`.
 *
 * O prefixo é ALFANUMÉRICO de propósito: base64url usa `-` e `_`, e `_` é o nosso separador.
 * O corpo do segredo pode conter `_` livremente porque é lido como "todo o resto".
 */
export function newToken(): NovoToken {
  const prefix = randomBytes(24).toString("base64url").replace(/[-_]/g, "").slice(0, PREFIX_LEN);
  const secret = formatToken(prefix, randomBytes(SECRET_BYTES).toString("base64url"));
  return { secret, prefix, tokenHash: hashToken(secret) };
}

/**
 * Valida o token CRU (sem `Bearer `). Leitura por POSIÇÃO, não por `split("_")`: o corpo do
 * segredo é base64url e pode conter `_`, então dividir pelo separador daria número de partes
 * variável. O prefixo tem tamanho fixo e não usa `_`, o que torna a leitura única.
 */
export function parseToken(bruto: string | null | undefined): { token: string; prefix: string } | MotivoRecusa {
  if (!bruto) return "ausente";
  const token = bruto.trim();
  if (!token) return "ausente";

  const cabeca = `${TOKEN_MARK}_`;
  if (!token.startsWith(cabeca)) return "malformado";
  const prefix = token.slice(cabeca.length, cabeca.length + PREFIX_LEN);
  if (prefix.length !== PREFIX_LEN || !ALFANUM.test(prefix)) return "malformado";
  if (token[cabeca.length + PREFIX_LEN] !== "_") return "malformado";
  const segredo = token.slice(cabeca.length + PREFIX_LEN + 1);
  // Teto no segredo além do piso: sem ele, um corpo de megabytes viraria trabalho de hash
  // à toa antes de qualquer consulta.
  if (segredo.length < 32 || segredo.length > 128 || !B64URL.test(segredo)) return "malformado";
  return { token, prefix };
}

/**
 * Extrai o token do header. **Só `Authorization: Bearer`** — nunca query string.
 */
export function parseBearer(header: string | null | undefined): { token: string; prefix: string } | MotivoRecusa {
  if (!header) return "ausente";
  const prefixo = "Bearer ";
  // Comparação de prefixo insensível a caixa: alguns clientes mandam "bearer".
  if (header.length <= prefixo.length || header.slice(0, prefixo.length).toLowerCase() !== "bearer ") return "ausente";
  return parseToken(header.slice(prefixo.length));
}

/** Mensagem genérica para o cliente — não revela estado do banco a quem está sondando. */
export function mensagemRecusa(motivo: MotivoRecusa): string {
  if (motivo === "ausente") return "Autenticação necessária: envie Authorization: Bearer <token>.";
  if (motivo === "indisponivel") return "Não foi possível validar a credencial agora. Tente novamente.";
  return "Credencial inválida, expirada ou revogada.";
}

/**
 * Código HTTP do motivo. `indisponivel` é 503 e não 401 de propósito: o acesso é negado dos
 * dois jeitos, mas 401 faria um cliente jogar fora um token que está bom.
 */
export function statusRecusa(motivo: MotivoRecusa): number {
  return motivo === "indisponivel" ? 503 : 401;
}

// ───────────────────────────── resolução ─────────────────────────────

export type TokenIdentidade = {
  user: SessionUser;
  token: { id: string; name: string; prefix: string; scopes: string[] };
};

export type ResultadoAuth = { ok: true; ident: TokenIdentidade } | { ok: false; motivo: MotivoRecusa };

/**
 * Ids dos parceiros que um executivo de canal enxerga (vazio/null para admin = tudo).
 * Mesma lógica do login em `auth.ts`.
 */
async function loadExecParceiroIds(userId: string): Promise<number[]> {
  const rows = await prisma.execParceiro.findMany({ where: { userId }, select: { parceiroId: true } });
  return rows.map((r) => Number(r.parceiroId));
}

/**
 * Resolve a credencial em um `SessionUser` INTERNO, ou devolve o motivo da recusa.
 *
 * Ordem: valida o formato (sem banco) → acha a linha por `tokenHash` → julga a linha
 * (revogado/expirado) → resolve o usuário interno e recorta o escopo do executivo de canal.
 */
export async function userFromApiToken(req: Request): Promise<ResultadoAuth> {
  const parsed = parseBearer(req.headers.get("authorization"));
  if (typeof parsed === "string") return { ok: false, motivo: parsed };

  let row;
  try {
    row = await prisma.apiToken.findUnique({
      // Igualdade dentro do índice único do Postgres — sem comparação de segredo no app.
      where: { tokenHash: hashToken(parsed.token) },
      select: { id: true, name: true, prefix: true, scopes: true, userId: true, expiresAt: true, revokedAt: true },
    });
  } catch (e) {
    // Fail-CLOSED, ao contrário do navegador. Registrado no console porque um token recusado
    // por indisponibilidade é problema de infraestrutura, não de credencial.
    console.error("[tokenAuth] falha ao verificar credencial:", e);
    return { ok: false, motivo: "indisponivel" };
  }

  if (!row) return { ok: false, motivo: "desconhecido" };

  const agora = Date.now();
  if (row.revokedAt && row.revokedAt.getTime() <= agora) return { ok: false, motivo: "revogado" };
  if (row.expiresAt.getTime() <= agora) return { ok: false, motivo: "expirado" };

  // Permissões e papéis lidos do BANCO agora (não congelados no token): tirar um papel tem
  // efeito imediato. `loadSessionUser` devolve `null` se o usuário sumiu ou está inativo.
  let user: SessionUser | null;
  try {
    user = await loadSessionUser(row.userId);
  } catch (e) {
    console.error("[tokenAuth] falha ao resolver usuário do token:", e);
    return { ok: false, motivo: "indisponivel" };
  }
  if (!user) return { ok: false, motivo: "inativo" };

  // O escopo real do executivo de canal vem de `ExecParceiro`; admin vê tudo (`null`).
  // `loadSessionUser` deixa `execParceiroIds` como `null` — aqui é onde ele é recortado.
  if (!isAdmin(user)) {
    try {
      user = { ...user, execParceiroIds: await loadExecParceiroIds(user.id) };
    } catch (e) {
      console.error("[tokenAuth] falha ao carregar escopo do executivo:", e);
      return { ok: false, motivo: "indisponivel" };
    }
  }

  return {
    ok: true,
    ident: {
      user,
      token: { id: row.id, name: row.name, prefix: row.prefix, scopes: row.scopes },
    },
  };
}

// ───────────────────────────── limite de uso ─────────────────────────────

/** Janela do limite e teto de chamadas nela. Por token, não por usuário nem por IP. */
export const JANELA_MS = 60_000;
/** Teto de chamadas por minuto por credencial no MCP (um chat, cadência humana). */
export const TETO_JANELA = 120;
/**
 * Teto por minuto na API REST. Maior que o do MCP de propósito: do outro lado há um
 * PROGRAMA, que pagina e itera numa cadência que um chat nunca tem. O contador da janela é o
 * MESMO (`windowStart`/`windowCount` da linha do token) — as duas superfícies compartilham a
 * conta, só o teto comparado muda conforme quem atende.
 */
export const TETO_JANELA_API = 600;

/** Qual superfície está atendendo — decide só o TETO comparado, não a contagem. */
export type Superficie = "mcp" | "api";

function tetoDaSuperficie(superficie: Superficie): number {
  return superficie === "api" ? TETO_JANELA_API : TETO_JANELA;
}

export type UsoDoToken = {
  excedeu: boolean;
  /** Teto — vai para `RateLimit-Limit`. */
  teto: number;
  /** Quantas chamadas ainda cabem na janela — `RateLimit-Remaining`. */
  restam: number;
  /** Segundos até a janela virar — `RateLimit-Reset`. */
  resetEmS: number;
};

/**
 * Marca o uso do token e devolve se ele estourou a janela.
 *
 * Duas coisas na mesma escrita de propósito: `lastUsedAt` (que a tela mostra, e é como a
 * pessoa percebe um token vazado sendo usado) e o contador da janela. Janela FIXA (não
 * deslizante) porque cabe em duas colunas da própria linha do token — e portanto vale entre
 * instâncias serverless, onde um `Map` em memória não valeria.
 *
 * NÃO nega uma chamada legítima quando a escrita falha: o token JÁ foi validado, e o limite é
 * proteção de CUSTO, não de acesso.
 */
export async function touchToken(
  tokenId: string,
  agora = new Date(),
  superficie: Superficie = "mcp",
): Promise<UsoDoToken> {
  const teto = tetoDaSuperficie(superficie);
  const semConta: UsoDoToken = { excedeu: false, teto, restam: teto, resetEmS: 60 };
  try {
    const atual = await prisma.apiToken.findUnique({
      where: { id: tokenId },
      select: { windowStart: true, windowCount: true },
    });
    if (!atual) return semConta;

    const expirou = agora.getTime() - atual.windowStart.getTime() >= JANELA_MS;
    const windowStart = expirou ? agora : atual.windowStart;
    const windowCount = (expirou ? 0 : atual.windowCount) + 1;

    await prisma.apiToken.update({
      where: { id: tokenId },
      data: { lastUsedAt: agora, windowStart, windowCount },
    });

    return {
      excedeu: windowCount > teto,
      teto,
      restam: Math.max(0, teto - windowCount),
      resetEmS: Math.max(1, Math.ceil((windowStart.getTime() + JANELA_MS - agora.getTime()) / 1000)),
    };
  } catch (e) {
    console.error("[tokenAuth] falha ao marcar uso do token:", e);
    return semConta;
  }
}
