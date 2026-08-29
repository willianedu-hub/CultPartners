import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config mínima, espelhando a do CRM. O alias `@/` existe para o teste importar um módulo do
// app do mesmo jeito que o app importa. A disciplina continua: teste unitário importa módulo
// PURO — se um import arrastar Prisma ou `next/*`, o problema é o módulo, não o alias.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
