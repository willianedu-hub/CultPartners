// Cliente Prisma singleton + pool pg enxuto (serverless/Vercel + pooler Supabase).
//
// Na Vercel cada instância serverless abre o SEU próprio pool pg. Mantemos o pool
// pequeno por instância e liberamos conexões ociosas rápido. Em produção prefira o
// **Transaction Pooler** do Supabase (porta 6543) na DATABASE_URL.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX) || 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

globalForPrisma.prisma = prisma;
