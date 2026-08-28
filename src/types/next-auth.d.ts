import type { DefaultSession } from "next-auth";

// Augment do NextAuth para o CONTRATO DE SESSÃO do CultPartners (ver src/lib/rbac.ts).
// Duas audiências no mesmo formato: interno (RBAC) e parceiro.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      audience: "internal" | "partner";
      permissions: string[];
      roles: string[];
      /** só parceiro (BigInt do banco → number) */
      parceiroId?: number | null;
      /** executivo de canal: ids em escopo. admin/null = todos */
      execParceiroIds?: number[] | null;
      /** epoch (ms) do login que originou o token — sobrevive às renovações */
      loginAt?: number | null;
    } & DefaultSession["user"];
  }

  // Objeto devolvido pelos providers `authorize`.
  interface User {
    audience?: "internal" | "partner";
    permissions?: string[];
    roles?: string[];
    parceiroId?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    audience?: "internal" | "partner";
    permissions?: string[];
    roles?: string[];
    parceiroId?: number | null;
    execParceiroIds?: number[] | null;
    loginAt?: number;
  }
}
