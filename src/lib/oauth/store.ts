import "server-only";

// A casca fina do servidor de autorização: tudo que precisa do banco.
//
// A divisão com `rules.ts` é a mesma de `tokenAuth.ts` — as DECISÕES são puras e testadas
// lá; aqui só há ida ao banco e a ordem das escritas. Num servidor de autorização essa ordem
// é metade da segurança: marcar o código como usado ANTES de emitir o token é o que impede
// duas trocas simultâneas de virarem dois tokens.

import { prisma } from "@/lib/db";
import { hashToken, newToken } from "@/lib/tokenAuth";
import {
  ACCESS_TTL_MS,
  CODIGO_TTL_MS,
  REFRESH_TTL_MS,
  decideCodigo,
  hashOAuth,
  novoClientId,
  novoClientSecret,
  novoCodigo,
  novoRefresh,
  type ErroOAuth,
} from "./rules";

export type Falha = { erro: ErroOAuth; detalhe: string; status?: number };

// ───────────────────────────── clientes ─────────────────────────────

export type ClienteRow = {
  clientId: string;
  clientSecretHash: string | null;
  name: string;
  redirectUris: string[];
  scopes: string[];
  disabled: boolean;
};

export async function acharCliente(clientId: string | null | undefined): Promise<ClienteRow | null> {
  if (!clientId) return null;
  return prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { clientId: true, clientSecretHash: true, name: true, redirectUris: true, scopes: true, disabled: true },
  });
}

/**
 * Registro dinâmico (RFC 7591). `publico` = sem segredo: é o caso do Claude, que roda no
 * aparelho de outra pessoa e não tem onde guardar um. Para ele, o que protege é o PKCE.
 *
 * **Reaproveita registro idêntico** em vez de criar linha nova a cada POST. Sem isso, cada
 * tentativa do claude.ai deixava uma linha permanente: a primeira conexão real produziria
 * QUATRO "Claude" iguais na tela de aplicativos autorizados. Ruído numa tela de segurança tem
 * custo — é ali que se procura "de onde veio este acesso?", e quatro linhas iguais são quatro
 * coisas para conferir em vez de uma.
 *
 * Duas decisões que não são óbvias:
 *
 *  - **Só cliente PÚBLICO é reaproveitado.** O confidencial guarda só o hash do segredo; não
 *    há como devolvê-lo de novo na resposta do registro. Ele sempre gera linha nova.
 *  - **Cliente DESABILITADO também é reaproveitado** — de propósito, e é o ponto mais
 *    importante daqui. Se a dedup pulasse os desabilitados, desabilitar o Claude na tela
 *    seria inútil: ele se registraria de novo, com linha limpa, no minuto seguinte.
 *    Reaproveitar faz o "desabilitado" valer. Isso não fecha o DCR aberto — quem mudar o
 *    nome ganha linha nova —, e não é para fechar: o que segura o acesso continua sendo o
 *    consentimento de uma pessoa logada, não o registro.
 *
 * A impressão digital é nome + conjunto de retornos + escopos. Ordem de `redirectUris` não
 * conta: `["a","b"]` e `["b","a"]` são o mesmo cliente para qualquer efeito prático.
 */
export async function registrarCliente(input: {
  name: string;
  redirectUris: string[];
  scopes: string[];
  publico: boolean;
}): Promise<{ clientId: string; secret: string | null; criadoEm: Date; reaproveitado: boolean }> {
  if (input.publico) {
    const iguais = await prisma.oAuthClient.findMany({
      where: {
        origem: "dcr",
        name: input.name,
        clientSecretHash: null,
        // `hasEvery` + a conferência de tamanho logo abaixo = mesmo CONJUNTO, sem depender
        // da ordem; o Postgres não tem igualdade de array que ignore ordem.
        redirectUris: { hasEvery: input.redirectUris },
        scopes: { hasEvery: input.scopes },
      },
      // O mais ANTIGO: é o que a pessoa já viu na tela e sobre o qual ela pode ter decidido
      // alguma coisa (desabilitar, por exemplo).
      orderBy: { createdAt: "asc" },
      select: { clientId: true, createdAt: true, redirectUris: true, scopes: true },
    });
    const igual = iguais.find(
      (c) => c.redirectUris.length === input.redirectUris.length && c.scopes.length === input.scopes.length,
    );
    if (igual) return { clientId: igual.clientId, secret: null, criadoEm: igual.createdAt, reaproveitado: true };
  }

  const clientId = novoClientId();
  const s = input.publico ? null : novoClientSecret();
  const row = await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash: s?.secretHash ?? null,
      name: input.name,
      redirectUris: input.redirectUris,
      scopes: input.scopes,
      origem: "dcr",
    },
    select: { createdAt: true },
  });
  return { clientId, secret: s?.secret ?? null, criadoEm: row.createdAt, reaproveitado: false };
}

/** Quantos clientes se registraram sozinhos na última hora — o teto do DCR. */
export async function registrosRecentes(desde: Date): Promise<number> {
  return prisma.oAuthClient.count({ where: { origem: "dcr", createdAt: { gte: desde } } });
}

/**
 * Autentica o cliente no `/token` e no `/revoke`.
 *
 * Cliente PÚBLICO não manda segredo — e exigir um seria impedir o Claude de funcionar. O
 * que não pode acontecer é o contrário: cliente registrado COM segredo ser aceito sem ele,
 * o que transformaria confidencial em público na prática.
 */
export function autenticaCliente(cliente: ClienteRow, segredo: string | null): Falha | null {
  if (cliente.disabled) return { erro: "invalid_client", detalhe: "cliente desabilitado" };
  if (!cliente.clientSecretHash) return null; // público: PKCE é a prova
  if (!segredo) return { erro: "invalid_client", detalhe: "client_secret ausente" };
  // Igualdade de hash em hex de tamanho fixo; não há sinal de timing útil aqui.
  if (hashOAuth(segredo) !== cliente.clientSecretHash) {
    return { erro: "invalid_client", detalhe: "client_secret inválido" };
  }
  return null;
}

// ───────────────────────────── código de autorização ─────────────────────────────

export async function guardarCodigo(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scopes: string[];
  resource: string | null;
  agora?: Date;
}): Promise<string> {
  const agora = input.agora ?? new Date();
  const { codigo, codeHash } = novoCodigo();
  await prisma.oAuthCode.create({
    data: {
      codeHash,
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      scopes: input.scopes,
      resource: input.resource,
      expiresAt: new Date(agora.getTime() + CODIGO_TTL_MS),
    },
  });
  return codigo;
}

export type CodigoResgatado = {
  userId: string;
  clientId: string;
  scopes: string[];
  resource: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
};

/**
 * Consome o código: confere, marca como usado e devolve o conteúdo. **Uso único de
 * verdade** — a marcação é um `updateMany` com `usedAt: null` no `where`, então duas
 * trocas simultâneas disputam a mesma linha e só uma ganha. Um `findFirst` seguido de
 * `update` deixaria as duas passarem.
 *
 * ⚠️ Código reusado dispara `revogarDoPar` no chamador. A revogação é mais larga do que a
 * letra da RFC 6749 §4.1.2 (que pede "os tokens emitidos com AQUELE código"): não guardamos
 * o vínculo token↔código, então revogamos tudo daquele cliente para aquela pessoa. É um
 * superconjunto de propósito — código interceptado põe o par inteiro sob suspeita, não só
 * uma emissão.
 */
export async function resgatarCodigo(
  codigo: string,
  clientId: string,
  redirectUri: string,
  agora = new Date(),
): Promise<{ ok: true; dados: CodigoResgatado } | { ok: false; falha: Falha; reusado?: boolean; userId?: string }> {
  const codeHash = hashOAuth(codigo);
  const row = await prisma.oAuthCode.findUnique({
    where: { codeHash },
    select: {
      userId: true, clientId: true, redirectUri: true, scopes: true, resource: true,
      codeChallenge: true, codeChallengeMethod: true, expiresAt: true, usedAt: true,
    },
  });
  // Código desconhecido e código errado dão a MESMA resposta: quem sonda não descobre se
  // acertou o formato.
  if (!row) return { ok: false, falha: { erro: "invalid_grant", detalhe: "código inválido" } };

  const veredito = decideCodigo(row, agora, clientId, redirectUri);
  if (!veredito.ok) {
    return {
      ok: false,
      falha: { erro: veredito.erro, detalhe: veredito.detalhe },
      reusado: veredito.reusado,
      userId: row.userId,
    };
  }

  const marcado = await prisma.oAuthCode.updateMany({
    where: { codeHash, usedAt: null },
    data: { usedAt: agora },
  });
  if (marcado.count === 0) {
    // Perdeu a corrida: outra troca marcou primeiro. Trata como reuso — que é o que é.
    return {
      ok: false,
      falha: { erro: "invalid_grant", detalhe: "código já resgatado" },
      reusado: true,
      userId: row.userId,
    };
  }

  return {
    ok: true,
    dados: {
      userId: row.userId,
      clientId: row.clientId,
      scopes: row.scopes,
      resource: row.resource,
      codeChallenge: row.codeChallenge,
      codeChallengeMethod: row.codeChallengeMethod,
    },
  };
}

/** Registro dinâmico que nunca virou autorização de ninguém é lixo depois disto. */
const LIXO_CLIENTE_MS = 7 * 24 * 60 * 60 * 1000;
/** Credencial OAuth revogada some da tela depois disto (a trilha de auditoria fica). */
const LIXO_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Faxina barata, de carona numa troca que já foi ao banco. Três coisas, com um critério só:
 * **apagar apenas o que não é decisão de ninguém.**
 *
 *  1. Códigos de autorização vencidos.
 *  2. Clientes que se registraram sozinhos, **nunca emitiram credencial nenhuma** e têm mais
 *     de 7 dias. Cliente sem token nunca foi autorizado por pessoa alguma — é registro puro.
 *     É isto que limpa sozinho as duplicatas que o DCR sem dedup já deixou em produção.
 *  3. Credenciais OAuth revogadas há mais de 30 dias. A revogação já está na trilha de
 *     auditoria, que é o registro que importa; a linha morta só atrapalha a leitura da tela.
 *
 * O que NÃO é apagado nunca: **PAT** (`kind: "pat"`). Aquele uma pessoa escolheu criar, e
 * apagar decisão de gente por robô é outra categoria de coisa.
 *
 * Cada passo tem o seu `try`: falha de faxina não pode derrubar a emissão de um token, que é
 * o que a pessoa está esperando do outro lado.
 */
export async function limparVencidos(agora = new Date()): Promise<void> {
  try {
    await prisma.oAuthCode.deleteMany({ where: { expiresAt: { lt: new Date(agora.getTime() - CODIGO_TTL_MS) } } });
  } catch (e) {
    console.error("[oauth] falha ao limpar códigos vencidos:", e);
  }
  try {
    await prisma.oAuthClient.deleteMany({
      where: {
        origem: "dcr",
        createdAt: { lt: new Date(agora.getTime() - LIXO_CLIENTE_MS) },
        // Nunca emitiu NADA, nem revogado: `none: {}` é a garantia de que ninguém consentiu.
        tokens: { none: {} },
      },
    });
  } catch (e) {
    console.error("[oauth] falha ao limpar clientes sem uso:", e);
  }
  try {
    await prisma.apiToken.deleteMany({
      where: { kind: "oauth", revokedAt: { lt: new Date(agora.getTime() - LIXO_TOKEN_MS) } },
    });
  } catch (e) {
    console.error("[oauth] falha ao limpar credenciais revogadas:", e);
  }
}

// Nome antigo, mantido como apelido para o `/token` do CRM que chamava `limparCodigosVencidos`.
export { limparVencidos as limparCodigosVencidos };

// ───────────────────────────── emissão ─────────────────────────────

export type ParDeTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInS: number;
  scopes: string[];
  tokenId: string;
};

/**
 * Emite o par access+refresh como uma linha de `ApiToken` com `kind: "oauth"`.
 *
 * É a mesma tabela do token colado à mão de propósito: `userFromApiToken` continua sendo a
 * ÚNICA porta de credencial de máquina. Duas tabelas seriam duas validações, e um dia elas
 * divergiriam — a segunda esqueceria o `sessionsValidFrom`, ou o `active`.
 */
export async function emitirTokens(input: {
  userId: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  agora?: Date;
}): Promise<ParDeTokens> {
  const agora = input.agora ?? new Date();
  const acesso = newToken();
  const r = novoRefresh();
  const row = await prisma.apiToken.create({
    data: {
      userId: input.userId,
      name: input.clientName.slice(0, 80),
      prefix: acesso.prefix,
      tokenHash: acesso.tokenHash,
      scopes: input.scopes,
      expiresAt: new Date(agora.getTime() + ACCESS_TTL_MS),
      kind: "oauth",
      clientId: input.clientId,
      refreshTokenHash: r.refreshHash,
      refreshExpiresAt: new Date(agora.getTime() + REFRESH_TTL_MS),
    },
    select: { id: true },
  });
  return {
    accessToken: acesso.secret,
    refreshToken: r.refresh,
    expiresInS: Math.floor(ACCESS_TTL_MS / 1000),
    scopes: input.scopes,
    tokenId: row.id,
  };
}

export type RefreshRow = {
  id: string;
  userId: string;
  clientId: string | null;
  name: string;
  scopes: string[];
  revokedAt: Date | null;
  refreshExpiresAt: Date | null;
  user: { active: boolean };
};

export async function acharPorRefresh(refresh: string): Promise<RefreshRow | null> {
  return prisma.apiToken.findUnique({
    where: { refreshTokenHash: hashOAuth(refresh) },
    select: {
      id: true, userId: true, clientId: true, name: true, scopes: true,
      revokedAt: true, refreshExpiresAt: true,
      user: { select: { active: true } },
    },
  });
}

/**
 * Rotação: o refresh usado morre e um novo nasce — **na mesma linha**.
 *
 * É o que dá detecção de roubo de graça. Se alguém copiou o refresh e usou antes do dono, o
 * do dono para de funcionar na próxima renovação — e ele descobre, em vez de os dois
 * conviverem em silêncio.
 *
 * POR QUE ATUALIZAR NO LUGAR, e não criar linha nova:
 *
 *  1. **A tela.** Uma renovação por hora criaria uma `ApiToken` por hora, para sempre, e nada
 *     limparia. Em um mês seriam centenas de linhas "Claude — Revogada" na tela que existe
 *     justamente para alguém achar credencial esquecida. Agora é uma autorização, uma linha:
 *     `createdAt` é quando a pessoa consentiu, `lastUsedAt` é a última leitura.
 *  2. **A corrida.** Duas renovações simultâneas com o mesmo refresh criariam DOIS tokens
 *     vivos. O `updateMany` abaixo leva `refreshTokenHash: <o antigo>` no `where`, então as
 *     duas disputam a MESMA linha no Postgres: uma escreve, a outra recebe 0 e vira
 *     `invalid_grant`. É o mesmo truque de `resgatarCodigo`.
 *  3. **O teto de uso.** `windowStart`/`windowCount` vivem na linha. Com linha nova por hora,
 *     o contador de chamadas por janela zeraria sozinho a cada renovação — o teto seria
 *     contornável só esperando a hora virar. Aqui eles são preservados de propósito.
 *
 * O que NÃO muda: um refresh antigo reapresentado não acha nada (o hash foi substituído) e
 * recebe `invalid_grant`, igual a antes.
 *
 * Devolve `null` quando outra renovação chegou primeiro; quem chama traduz em `invalid_grant`.
 */
export async function rotacionarRefresh(input: {
  anteriorId: string;
  refreshAnterior: string;
  clientName: string;
  scopes: string[];
  agora?: Date;
}): Promise<ParDeTokens | null> {
  const agora = input.agora ?? new Date();
  const acesso = newToken();
  const r = novoRefresh();
  const { count } = await prisma.apiToken.updateMany({
    // O `refreshTokenHash` no `where` é o que serializa duas renovações simultâneas.
    where: { id: input.anteriorId, refreshTokenHash: hashOAuth(input.refreshAnterior) },
    data: {
      prefix: acesso.prefix,
      tokenHash: acesso.tokenHash,
      name: input.clientName.slice(0, 80),
      scopes: input.scopes,
      expiresAt: new Date(agora.getTime() + ACCESS_TTL_MS),
      refreshTokenHash: r.refreshHash,
      refreshExpiresAt: new Date(agora.getTime() + REFRESH_TTL_MS),
    },
  });
  if (count === 0) return null;
  return {
    accessToken: acesso.secret,
    refreshToken: r.refresh,
    expiresInS: Math.floor(ACCESS_TTL_MS / 1000),
    scopes: input.scopes,
    tokenId: input.anteriorId,
  };
}

// Nome antigo, mantido como apelido para o `/token` do CRM que chamava `rotacionar`.
export { rotacionarRefresh as rotacionar };

// ───────────────────────────── revogação ─────────────────────────────

/**
 * RFC 7009: o cliente manda um token e não precisa dizer qual é o tipo. Tentamos os dois.
 * Devolve se achou — mas o endpoint responde 200 de qualquer jeito (é o que a RFC manda,
 * e é o que impede o `/revoke` de virar oráculo de "este token existe?").
 */
export async function revogarPorValor(valor: string, agora = new Date()): Promise<{ achou: boolean; tokenId?: string }> {
  const porAcesso = await prisma.apiToken.updateManyAndReturn({
    where: { tokenHash: hashToken(valor), revokedAt: null },
    data: { revokedAt: agora, refreshTokenHash: null, refreshExpiresAt: null },
    select: { id: true },
  });
  if (porAcesso.length > 0) return { achou: true, tokenId: porAcesso[0].id };

  const porRefresh = await prisma.apiToken.updateManyAndReturn({
    where: { refreshTokenHash: hashOAuth(valor), revokedAt: null },
    data: { revokedAt: agora, refreshTokenHash: null, refreshExpiresAt: null },
    select: { id: true },
  });
  if (porRefresh.length > 0) return { achou: true, tokenId: porRefresh[0].id };

  return { achou: false };
}

// Nome curto pedido na tarefa, apelido do canônico acima.
export { revogarPorValor as revogar };

/** Reação ao código reusado: derruba tudo que aquele cliente tem daquela pessoa. */
export async function revogarDoPar(clientId: string, userId: string, agora = new Date()): Promise<number> {
  const r = await prisma.apiToken.updateMany({
    where: { clientId, userId, kind: "oauth", revokedAt: null },
    data: { revokedAt: agora, refreshTokenHash: null, refreshExpiresAt: null },
  });
  return r.count;
}

/** Carimba o uso do cliente — a tela mostra, e conector morto fica visível. */
export async function marcarUsoDoCliente(clientId: string, agora = new Date()): Promise<void> {
  try {
    await prisma.oAuthClient.update({ where: { clientId }, data: { lastUsedAt: agora } });
  } catch (e) {
    console.error("[oauth] falha ao marcar uso do cliente:", e);
  }
}
