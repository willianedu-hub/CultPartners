// Política de sessão — módulo PURO (sem Prisma, sem next/server): é importado
// tanto pelo servidor (auth.ts, rbac.ts) quanto pelo vigia no navegador.
//
// Regra do negócio: **30 minutos de inatividade encerram a sessão.** Não é um
// prazo absoluto — quem está trabalhando não é interrompido; quem largou a tela
// aberta é deslogado.
//
// Como isso funciona na prática (o "porquê" dos três números abaixo):
//  - O JWT do Auth.js carrega o próprio vencimento. Só o endpoint
//    `/api/auth/session` reemite o cookie (o `auth()` de Server Component
//    descarta o Set-Cookie — ver node_modules/next-auth/lib/index.js).
//  - Por isso o vigia no navegador dá um "ping" nesse endpoint **quando houve
//    atividade de verdade**, empurrando o vencimento para frente. Sem atividade,
//    sem ping: o token morre sozinho.
//  - O `GRACE_MS` existe para o vigia conseguir registrar a saída na auditoria:
//    quando ele dispara aos 30 min, o token precisa estar vivo por mais alguns
//    segundos, senão não há sessão para identificar quem saiu.

/** Inatividade que encerra a sessão. */
export const IDLE_MS = 30 * 60 * 1000;

/**
 * Folga do token além do limite de inatividade. Curta de propósito: é o único
 * intervalo em que um cookie roubado ainda valeria depois dos 30 min.
 */
export const GRACE_MS = 60 * 1000;

/** Vencimento do JWT, em segundos (formato que o Auth.js espera). */
export const TOKEN_MAX_AGE_S = Math.floor((IDLE_MS + GRACE_MS) / 1000);

/** De quanto em quanto tempo o vigia reavalia a inatividade. */
export const CHECK_MS = 30 * 1000;

/**
 * Intervalo mínimo entre dois pings de renovação. Menor que `IDLE_MS` com folga
 * larga: mesmo que um ping falhe (rede instável), ainda sobram vários antes de
 * o token vencer.
 */
export const PING_MS = 5 * 60 * 1000;

/** Chaves do localStorage (compartilhadas entre abas). */
export const LAST_ACTIVITY_KEY = "cp:lastActivity";
export const LAST_EMAIL_KEY = "cp:lastEmail";

/** Motivos pelos quais a tela de login pode ter sido alcançada. */
export const LOGIN_REASONS = ["expirada", "encerrada", "inativa"] as const;
export type LoginReason = (typeof LOGIN_REASONS)[number];

export function parseLoginReason(v: unknown): LoginReason | null {
  return typeof v === "string" && (LOGIN_REASONS as readonly string[]).includes(v) ? (v as LoginReason) : null;
}

/**
 * A sessão foi revogada? Compara o instante do login (gravado no token e mantido
 * através das renovações) com o corte gravado no usuário.
 *
 * Tolerância de 1s: `loginAt` vem do relógio do processo que autenticou e
 * `sessionsValidFrom` do relógio do Postgres; sem ela, um login exatamente
 * simultâneo à revogação poderia ser derrubado por milissegundos de diferença.
 */
export function isSessionRevoked(loginAt: number | null | undefined, validFrom: Date | null | undefined): boolean {
  if (!validFrom) return false;
  if (!loginAt) return true; // token antigo, sem carimbo de login → não dá para provar que é posterior
  return loginAt + 1000 < validFrom.getTime();
}

/**
 * Para onde ir depois de entrar (`?next=` do login). `"/"` quando não dá para confiar.
 *
 * Existe por causa do OAuth: o `/authorize` manda quem não tem sessão para o login e quer
 * voltar para o mesmo pedido depois. Só que "volte para onde a URL mandar" é, literalmente,
 * um redirecionador aberto — um link de phishing levaria ao login **de verdade** do CultPartners
 * e, assim que a pessoa entrasse, ao site do atacante, com a credibilidade toda do domínio
 * certo emprestada.
 *
 * A trava é forma, não lista: caminho relativo, começando com UMA barra. `//host` é URL
 * absoluta disfarçada (o navegador completa o esquema), e `/\host` alguns navegadores
 * normalizam para o mesmo — por isso os dois caem fora.
 */
export function destinoSeguro(next: string | null | undefined): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
