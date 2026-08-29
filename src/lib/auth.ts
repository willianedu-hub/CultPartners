import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auditAuth } from "@/lib/audit";
import { loadSessionUserByEmail } from "@/lib/sessionUser";
import { TOKEN_MAX_AGE_S } from "@/lib/sessionPolicy";

// ───────────────────────── Login com a conta Microsoft ─────────────────────────
//
// A empresa usa Claude Enterprise e só autoriza conexão de MCP com autenticação da conta
// Microsoft. O CultPartners é o servidor de autorização do OAuth — a Microsoft entra aqui,
// como IdP do login humano INTERNO (admins + executivos de canal).
//
// **Nada disso é obrigatório para o portal funcionar.** Sem as variáveis o provider nem é
// registrado, e a senha continua sendo o caminho. É de propósito: o Auth.js v5 ainda é beta,
// e ninguém pode ficar trancado para fora porque o Entra caiu.
//
// Os PARCEIROS não passam pelo Entra: têm login+senha próprio (tabela `parceiros`), fora do OAuth.
const ENTRA_ID = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
const ENTRA_SECRET = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
/**
 * Issuer travado no TENANT (`https://login.microsoftonline.com/<tenant>/v2.0`), nunca
 * `common`. Com `common` o servidor aceitaria qualquer diretório do mundo e conta pessoal
 * `@outlook.com` — o portão viraria "tem conta Microsoft?" em vez de "é da CultSec?".
 */
const ENTRA_ISSUER = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
const ENTRA_LIGADO = Boolean(ENTRA_ID && ENTRA_SECRET && ENTRA_ISSUER);

/**
 * A tela de login pergunta isto para decidir se mostra o botão da Microsoft. Exportado como
 * valor e não como leitura de `process.env` na página para os dois lados concordarem: um
 * botão que aparece sem o provider registrado leva a um 404 do Auth.js.
 */
export const loginMicrosoftDisponivel = ENTRA_LIGADO;

/** O GUID do tenant, extraído do issuer — é contra ele que o claim `tid` é conferido. */
const TENANT_ESPERADO = /login\.microsoftonline\.com\/([^/]+)/.exec(ENTRA_ISSUER ?? "")?.[1] ?? null;

// Hash de referência: comparado quando o e-mail/login não existe, para que o tempo de
// resposta seja o mesmo de um usuário existente (evita enumeração por timing).
const DUMMY_HASH = bcrypt.hashSync("timing-safe-placeholder", 10);

// Limitador de tentativas de login em memória (best-effort — para múltiplas
// instâncias em produção, prefira um store compartilhado tipo Redis). Reduz
// brute-force/credential-stuffing bloqueando após N falhas por chave.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number; lockedUntil?: number }>();

function loginAllowed(key: string): boolean {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e) return true;
  if (e.lockedUntil && e.lockedUntil > now) return false;
  if (now - e.first > WINDOW_MS) {
    attempts.delete(key);
    return true;
  }
  return e.count < MAX_ATTEMPTS;
}
function recordFailure(key: string): void {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e || now - e.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return;
  }
  e.count++;
  if (e.count >= MAX_ATTEMPTS) e.lockedUntil = now + LOCK_MS;
}
function recordSuccess(key: string): void {
  attempts.delete(key);
}

/** Ids dos parceiros que um executivo de canal enxerga (vazio para admin — ver escopo). */
async function loadExecParceiroIds(userId: string): Promise<number[]> {
  const rows = await prisma.execParceiro.findMany({ where: { userId }, select: { parceiroId: true } });
  return rows.map((r) => Number(r.parceiroId));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // O vencimento do token É o relógio de inatividade: quem trabalha renova pelo
  // `/api/auth/session`; quem para, vence. Sem isso o padrão do Auth.js seria 30 DIAS.
  session: { strategy: "jwt", maxAge: TOKEN_MAX_AGE_S },
  jwt: { maxAge: TOKEN_MAX_AGE_S },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    // ── Credencial INTERNA (id padrão "credentials"): e-mail + senha contra `User`. ──
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = (creds?.email as string | undefined)?.trim().toLowerCase();
        const password = creds?.password as string | undefined;
        if (!email || !password) return null;
        if (!loginAllowed(email)) {
          await auditAuth("LOGIN_FAILED", {
            email,
            summary: `bloqueado por excesso de tentativas (≥${MAX_ATTEMPTS} falhas em ${WINDOW_MS / 60000} min)`,
            meta: { reason: "rate_limited", maxAttempts: MAX_ATTEMPTS, lockMinutes: LOCK_MS / 60000 },
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            roles: {
              include: {
                role: { include: { permissions: { include: { permission: true } } } },
              },
            },
          },
        });

        // Sempre executa o bcrypt (com hash real ou de referência) → tempo constante.
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.active || !ok) {
          recordFailure(email);
          const reason = !user ? "unknown_email" : !user.active ? "inactive_user" : "bad_password";
          const summary = !user
            ? "e-mail não cadastrado"
            : !user.active
              ? "usuário inativo"
              : "senha incorreta";
          await auditAuth("LOGIN_FAILED", { userId: user?.id ?? null, name: user?.name ?? null, email, summary, meta: { reason } });
          return null;
        }
        recordSuccess(email);
        await auditAuth("LOGIN", { userId: user.id, name: user.name, email: user.email });

        const permissions = [
          ...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key))),
        ];
        const roles = user.roles.map((ur) => ur.role.name);

        return { id: user.id, name: user.name, email: user.email, audience: "internal", permissions, roles };
      },
    }),
    // ── Credencial de PARCEIRO (id "partner"): login + senha contra `Parceiro`. ──
    Credentials({
      id: "partner",
      name: "partner",
      credentials: { login: {}, password: {} },
      authorize: async (creds) => {
        const login = (creds?.login as string | undefined)?.trim();
        const password = creds?.password as string | undefined;
        if (!login || !password) return null;
        const key = `partner:${login}`;
        if (!loginAllowed(key)) {
          await auditAuth("LOGIN_FAILED", {
            summary: `parceiro bloqueado por excesso de tentativas (≥${MAX_ATTEMPTS} falhas em ${WINDOW_MS / 60000} min)`,
            meta: { reason: "rate_limited", provider: "partner", login, maxAttempts: MAX_ATTEMPTS },
          });
          return null;
        }

        const parceiro = await prisma.parceiro.findUnique({ where: { login } });
        // Sempre executa o bcrypt → tempo constante (evita enumeração de logins).
        const ok = await bcrypt.compare(password, parceiro?.senhaHash ?? DUMMY_HASH);
        const inativo = parceiro ? !parceiro.ativo || parceiro.deletedAt != null : false;
        if (!parceiro || inativo || !ok) {
          recordFailure(key);
          const reason = !parceiro ? "unknown_login" : inativo ? "inactive_partner" : "bad_password";
          const summary = !parceiro
            ? "login de parceiro não cadastrado"
            : inativo
              ? "parceiro inativo"
              : "senha incorreta";
          await auditAuth("LOGIN_FAILED", {
            userId: parceiro ? `parceiro:${parceiro.id}` : null,
            name: parceiro?.nome ?? null,
            email: parceiro?.email ?? null,
            summary,
            meta: { reason, provider: "partner", login },
          });
          return null;
        }
        recordSuccess(key);
        await auditAuth("LOGIN", {
          userId: `parceiro:${parceiro.id}`,
          name: parceiro.nome,
          email: parceiro.email,
          summary: "parceiro entrou com login e senha",
          meta: { provider: "partner" },
        });

        return {
          id: `parceiro:${parceiro.id}`,
          name: parceiro.nome,
          email: parceiro.email,
          audience: "partner",
          parceiroId: Number(parceiro.id),
        };
      },
    }),
    ...(ENTRA_LIGADO
      ? [
          MicrosoftEntraID({
            clientId: ENTRA_ID,
            clientSecret: ENTRA_SECRET,
            issuer: ENTRA_ISSUER,
            // ── Duas coisas SOBRESCRITAS do padrão do provider, e as duas importam ──
            //
            // 1. O escopo padrão inclui `User.Read` (Microsoft Graph). Pedimos só
            //    `openid profile email` porque o portal não lê Graph — deixar o padrão faria
            //    o consentimento pedir mais do que foi concedido, e o login falharia.
            authorization: { params: { scope: "openid profile email" } },
            // 2. O `profile()` padrão busca a foto no Graph a cada login. Sem escopo de Graph
            //    ela nunca vem: é uma chamada externa no caminho crítico que só pode dar errado.
            profile: (perfil) => ({
              id: perfil.sub,
              // `email` é opcional no id_token do Entra; `preferred_username` sempre vem em
              // conta corporativa. Sem esta reserva, um tenant sem o claim `email` derrubaria todos.
              email: (perfil.email ?? perfil.preferred_username ?? "").toLowerCase(),
              name: perfil.name ?? null,
              image: null,
            }),
          }),
        ]
      : []),
  ],
  events: {
    // O payload do signOut é `{ token }` na estratégia JWT — o ator sai do token.
    signOut: async (message) => {
      if (!("token" in message) || !message.token) return;
      const t = message.token;
      const uid = typeof t.uid === "string" ? t.uid : null;
      await auditAuth("LOGOUT", { userId: uid, name: t.name ?? null, email: t.email ?? null });
    },
  },
  callbacks: {
    /**
     * O PORTÃO do login federado. **Nega por padrão.**
     *
     * Estar no diretório da empresa não é ser do portal interno: o Entra autentica estagiário,
     * prestador, conta de serviço e convidado externo. Sem `User` correspondente, `false` — e
     * nenhum registro é criado. Provisionamento automático foi decidido contra de propósito.
     *
     * Devolve `true` direto para os provedores de credencial: eles já decidiram no `authorize`.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "microsoft-entra-id") return true;

      const email = (user?.email ?? "").trim().toLowerCase();
      const nome = user?.name ?? null;

      // Segunda trava, além do issuer travado no tenant: o claim `tid` diz de qual diretório
      // a pessoa veio. Duas travas para a mesma coisa porque uma delas é configuração.
      const tid =
        typeof (profile as { tid?: unknown } | undefined)?.tid === "string"
          ? (profile as { tid: string }).tid
          : null;
      if (TENANT_ESPERADO && tid && tid !== TENANT_ESPERADO) {
        await auditAuth("LOGIN_FAILED", {
          email,
          name: nome,
          summary: "conta de outro diretório Microsoft",
          meta: { reason: "tenant_errado", provider: "microsoft-entra-id", tid },
        });
        return false;
      }

      if (!email) {
        await auditAuth("LOGIN_FAILED", {
          name: nome,
          summary: "a Microsoft não devolveu e-mail para esta conta",
          meta: { reason: "sem_email", provider: "microsoft-entra-id" },
        });
        return false;
      }

      const interno = await loadSessionUserByEmail(email);
      if (!interno) {
        await auditAuth("LOGIN_FAILED", {
          email,
          name: nome,
          summary: "conta Microsoft válida, mas sem usuário ativo no portal",
          meta: { reason: "sem_usuario_interno", provider: "microsoft-entra-id" },
        });
        return false;
      }

      await auditAuth("LOGIN", {
        userId: interno.id,
        name: interno.name,
        email: interno.email,
        summary: "entrou com a conta Microsoft",
        meta: { provider: "microsoft-entra-id" },
      });
      return true;
    },

    async jwt({ token, user, account }) {
      // Ramo do login FEDERADO (Microsoft): o `user` é o perfil do Entra e não traz
      // permissions/roles nem o `id` interno. Sem esta tradução a pessoa entraria com sessão
      // válida e zero permissões — um portal vazio.
      if (user && account?.provider === "microsoft-entra-id") {
        const interno = user.email ? await loadSessionUserByEmail(user.email) : null;
        if (interno) {
          token.uid = interno.id;
          token.audience = "internal";
          token.permissions = interno.permissions;
          token.roles = interno.roles;
          token.name = interno.name;
          token.email = interno.email;
          const admin = interno.roles.includes("admin") || interno.permissions.includes("admin.full");
          token.execParceiroIds = admin ? null : await loadExecParceiroIds(interno.id);
          token.parceiroId = null;
          token.loginAt = Date.now();
        }
        return token;
      }

      if (user) {
        const u = user as {
          id: string;
          audience?: "internal" | "partner";
          permissions?: string[];
          roles?: string[];
          parceiroId?: number | null;
        };
        if (u.audience === "partner") {
          token.uid = u.id; // "parceiro:<id>"
          token.audience = "partner";
          token.parceiroId = u.parceiroId ?? null;
          token.permissions = [];
          token.roles = ["partner"];
          token.execParceiroIds = null;
        } else {
          token.uid = u.id;
          token.audience = "internal";
          token.permissions = u.permissions ?? [];
          token.roles = u.roles ?? [];
          const admin = (u.roles ?? []).includes("admin") || (u.permissions ?? []).includes("admin.full");
          token.execParceiroIds = admin ? null : await loadExecParceiroIds(u.id);
          token.parceiroId = null;
        }
        // Carimbo do login de verdade. NÃO é reescrito nas renovações: é ele que permite
        // invalidar tudo que foi autenticado antes de um instante.
        token.loginAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.audience = (token.audience as "internal" | "partner") ?? "internal";
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.roles = (token.roles as string[]) ?? [];
        session.user.parceiroId = (token.parceiroId as number | null | undefined) ?? null;
        session.user.execParceiroIds = (token.execParceiroIds as number[] | null | undefined) ?? null;
        session.user.loginAt = typeof token.loginAt === "number" ? token.loginAt : null;
      }
      return session;
    },
  },
});
