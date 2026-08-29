import "server-only";

// Trilha de auditoria do CultPartners — ponto ÚNICO de escrita (versão enxuta).
//
// Princípios (herdados do CRM):
//  1. **Nunca quebrar a operação auditada.** Tudo aqui é try/catch: se o log falhar,
//     a ação do usuário segue.
//  2. **Nunca atrasar a resposta.** A gravação vai para `after()`; fora de request
//     (cron/script) grava direto.
//
// Esta versão NÃO porta diff/revert — só o essencial: `audit(entry)` e o atalho
// `auditAuth` usado pelo `auth.ts`.

import { after } from "next/server";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Espelha o enum `AuditAction` do schema (cultpartners.auditoria). */
export type AuditAction =
  | "LOGIN" | "LOGIN_FAILED" | "LOGOUT"
  | "VIEW" | "EXPORT"
  | "CREATE" | "UPDATE" | "DELETE"
  | "REVERT" | "PURGE";

type ReqContext = { ip: string | null; userAgent: string | null; route: string | null };

/**
 * IP/user-agent/rota do request via `next/headers`. O Next não expõe IP: vem do
 * `x-forwarded-for` (confiável atrás da borda). Fora de request devolve tudo nulo
 * em vez de lançar.
 */
async function requestContext(): Promise<ReqContext> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const referer = h.get("referer");
    let route: string | null = null;
    if (referer) {
      try {
        route = new URL(referer).pathname;
      } catch {
        route = null;
      }
    }
    return { ip, userAgent: h.get("user-agent"), route };
  } catch {
    return { ip: null, userAgent: null, route: null };
  }
}

export type AuditInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  summary?: string | null;
  fields?: Record<string, unknown> | null;
  snapshot?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  /** contexto já capturado (quando o chamador é um Server Component) */
  context?: Partial<ReqContext>;
};

/** Grava um evento em `auditoria`. Nunca lança e nunca bloqueia a resposta. */
export async function audit(input: AuditInput): Promise<void> {
  // O contexto precisa ser lido AGORA (dentro de `after` o Next proíbe `headers()`);
  // a gravação é que vai para depois.
  const ctx = { ...(await requestContext()), ...(input.context ?? {}) };
  const write = async () => {
    try {
      await prisma.auditoria.create({
        data: {
          action: input.action as never,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          entityLabel: input.entityLabel ?? null,
          summary: input.summary ?? null,
          userId: input.userId ?? null,
          userName: input.userName ?? null,
          userEmail: input.userEmail ?? null,
          fields: (input.fields as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
          snapshot: (input.snapshot as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
          meta: (input.meta as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          route: ctx.route ?? null,
        },
      });
    } catch (e) {
      // Auditoria nunca derruba a operação auditada.
      console.error("[audit] falha ao gravar evento:", e);
    }
  };

  try {
    after(write); // fora do caminho crítico da resposta
  } catch {
    await write(); // fora de request (cron, script, teste): grava direto
  }
}

/** Eventos de sessão. Não há sessão resolvida no login — o ator vem explícito. */
export async function auditAuth(
  action: Extract<AuditAction, "LOGIN" | "LOGIN_FAILED" | "LOGOUT">,
  info: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    summary?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await audit({
    action,
    entityType: "Session",
    entityId: info.userId ?? null,
    entityLabel: info.name ?? info.email ?? null,
    summary: info.summary ?? null,
    userId: info.userId ?? null,
    userName: info.name ?? null,
    userEmail: info.email ?? null,
    meta: info.meta ?? null,
  });
}
