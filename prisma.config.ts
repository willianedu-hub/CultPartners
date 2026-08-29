import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7: a configuração de datasource (url) vive aqui, não no schema.
// Supabase: use a connection string do "Session pooler" (porta 5432) em DATABASE_URL
// para migrations; em produção serverless prefira o "Transaction pooler" (6543).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
