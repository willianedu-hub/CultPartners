"use server";

// Server Actions de PERFIL do usuário logado — troca da própria senha.
//
// Só o PARCEIRO tem senha local neste portal (tabela `parceiros.senha_hash`, bcrypt).
// Ele troca a própria senha validando a senha atual.
//
// Usuário INTERNO (admin/executivo) entra por Microsoft (Entra ID) — a credencial vive
// no provedor de identidade, não aqui. Portanto NÃO há troca de senha de interno nesta
// action: mesmo o admin que mantém senha local de emergência (`User.passwordHash`) a
// gerencia por outro caminho administrativo, fora do fluxo de autoatendimento de perfil.
// Chamada de interno é recusada de propósito.

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const BCRYPT_ROUNDS = 10;

const schema = z.object({
  atual: z.string().min(1, "Informe a senha atual."),
  nova: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres.").max(200),
});

/**
 * Parceiro troca a própria senha:
 *  1. valida a senha atual contra o `senhaHash` (bcrypt);
 *  2. grava o novo hash.
 * Interno é recusado (senha gerida no Entra). Nunca retorna/loga hashes.
 */
export async function changePassword(atual: string, nova: string): Promise<ActionResult> {
  const u = await requireUser();

  if (u.audience !== "partner") {
    return {
      ok: false,
      error: "Sua conta entra pela Microsoft — a senha é gerenciada por lá, não aqui.",
    };
  }
  if (u.parceiroId == null) return { ok: false, error: "Sessão sem parceiro associado." };

  const parsed = schema.safeParse({ atual, nova });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.atual === parsed.data.nova) {
    return { ok: false, error: "A nova senha deve ser diferente da atual." };
  }

  const parceiro = await prisma.parceiro.findFirst({
    where: { id: BigInt(u.parceiroId), deletedAt: null, ativo: true },
    select: { id: true, nome: true, senhaHash: true },
  });
  if (!parceiro) return { ok: false, error: "Parceiro não encontrado." };

  const confere = await bcrypt.compare(parsed.data.atual, parceiro.senhaHash);
  if (!confere) return { ok: false, error: "Senha atual incorreta." };

  const senhaHash = await bcrypt.hash(parsed.data.nova, BCRYPT_ROUNDS);
  await prisma.parceiro.update({ where: { id: parceiro.id }, data: { senhaHash } });

  await audit({
    action: "UPDATE",
    entityType: "Parceiro",
    entityId: String(parceiro.id),
    entityLabel: parceiro.nome,
    summary: "trocou a própria senha",
    userId: u.id,
    userName: u.name ?? null,
    userEmail: u.email ?? null,
  });

  return { ok: true, message: "Senha alterada com sucesso." };
}
