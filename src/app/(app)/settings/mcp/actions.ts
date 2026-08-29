"use server";

// Credenciais de máquina (servidor MCP) do CultPartners: criar e revogar.
//
// Espelha `settings/mcp/actions.ts` do CRM, enxugado para o domínio do CultPartners:
//
//  - **Não há permissão nova para criar token.** É deliberado: um token não pode dar mais
//    alcance do que a pessoa já tem — ele resolve para o mesmo `SessionUser` interno e passa
//    pelo mesmo escopo server-side (`oportunidadeScopeWhere`/`execParceiroIds`). Exigir uma
//    permissão extra criaria a ilusão de que o token é um privilégio.
//  - Só usuário INTERNO chega aqui (`requireInternal`). Não há token de parceiro na v1.
//  - Toda escrita é auditada; o segredo NUNCA entra no log (guardamos só o SHA-256).
//  - O segredo em texto existe UMA vez: volta na resposta de `criarToken` e nunca mais.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { baseUrl } from "@/lib/appUrl";
import { requireInternal, isAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { newToken } from "@/lib/tokenAuth";

export type McpResult = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Segredo em texto — só no retorno de `criarToken`, mostrado uma vez pela UI. */
  secret?: string;
  /** Comando pronto do Claude Code, já com o segredo embutido. */
  comando?: string;
};

/** Validade máxima. Um ano é longo; "para sempre" é dívida que ninguém revisita. */
const DIAS_MAX = 365;
const DIAS_PADRAO = 90;
/** Teto por pessoa: sem ele, um laço cria milhares de linhas que ninguém revoga. */
const TETO_ATIVOS = 10;

const esquemaCriar = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Dê um nome à credencial (onde ela vai ser usada).")
    .max(80, "Nome muito longo (máximo 80 caracteres)."),
  // Validade OBRIGATÓRIA: não existe token sem data de expiração.
  validadeDias: z
    .coerce.number()
    .int("A validade deve ser um número inteiro de dias.")
    .min(1, `A validade deve ser entre 1 e ${DIAS_MAX} dias.`)
    .max(DIAS_MAX, `A validade deve ser entre 1 e ${DIAS_MAX} dias.`),
});

/**
 * Cria um token pessoal (PAT) e devolve o segredo UMA vez.
 *
 * Grava só `prefix` + `tokenHash` (SHA-256); o segredo em texto vive apenas no valor de
 * retorno, para a UI mostrar antes de descartá-lo.
 */
export async function criarToken(nome: string, validadeDias: number): Promise<McpResult> {
  const u = await requireInternal();

  const parsed = esquemaCriar.safeParse({ nome, validadeDias });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { nome: name, validadeDias: dias } = parsed.data;

  const ativos = await prisma.apiToken.count({
    where: { userId: u.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (ativos >= TETO_ATIVOS) {
    return {
      ok: false,
      error: `Você já tem ${TETO_ATIVOS} credenciais ativas. Revogue uma antes de criar outra.`,
    };
  }

  const t = newToken();
  const expiresAt = new Date(Date.now() + dias * 86_400_000);

  const row = await prisma.apiToken.create({
    data: {
      userId: u.id,
      name,
      prefix: t.prefix,
      tokenHash: t.tokenHash,
      scopes: ["read"],
      expiresAt,
      kind: "pat",
    },
  });

  // A trilha registra que a credencial NASCEU — nunca o segredo (só o prefixo).
  await audit({
    action: "CREATE",
    entityType: "ApiToken",
    entityId: row.id,
    entityLabel: name,
    summary: `criou credencial de máquina “${name}” (validade ${dias} dias)`,
    userId: u.id,
    userName: u.name ?? null,
    userEmail: u.email ?? null,
    meta: { prefixo: t.prefix, dias, escopos: ["read"], kind: "pat", admin: isAdmin(u) },
  });
  revalidatePath("/settings/mcp");

  const base = baseUrl(await headers());
  return {
    ok: true,
    message: "Credencial criada. Copie o segredo agora — ele não aparece de novo.",
    secret: t.secret,
    comando: `claude mcp add cultpartners --transport http ${base}/api/mcp --header "Authorization: Bearer ${t.secret}"`,
  };
}

/** Revoga uma credencial do PRÓPRIO usuário. Idempotente; audita. */
export async function revogarToken(id: string): Promise<McpResult> {
  const u = await requireInternal();

  const validId = z.string().min(1).safeParse(id);
  if (!validId.success) return { ok: false, error: "Credencial não encontrada." };

  const before = await prisma.apiToken.findUnique({
    where: { id: validId.data },
    select: { id: true, name: true, userId: true, prefix: true, revokedAt: true, kind: true },
  });
  if (!before) return { ok: false, error: "Credencial não encontrada." };

  // Só a própria. Sem gestão de credenciais de terceiros nesta tela.
  if (before.userId !== u.id) {
    return { ok: false, error: "Você não tem permissão para isso." };
  }
  if (before.revokedAt) return { ok: true, message: "Essa credencial já estava revogada." };

  await prisma.apiToken.update({ where: { id: before.id }, data: { revokedAt: new Date() } });
  await audit({
    action: "UPDATE",
    entityType: "ApiToken",
    entityId: before.id,
    entityLabel: before.name,
    summary: `revogou a própria credencial “${before.name}”`,
    userId: u.id,
    userName: u.name ?? null,
    userEmail: u.email ?? null,
    meta: { prefixo: before.prefix, kind: before.kind },
  });
  revalidatePath("/settings/mcp");
  return { ok: true, message: "Credencial revogada. Ela para de funcionar na próxima chamada." };
}
