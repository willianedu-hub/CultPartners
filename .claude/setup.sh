#!/usr/bin/env bash
# Setup script para sessões do Claude Code na nuvem (e para bootstrap local).
# Roda ANTES do agente começar; o resultado fica em cache entre sessões.
# Configure este arquivo como "setup script" do Cloud Environment em claude.ai/code.
set -euo pipefail

# O prisma.config.ts resolve env("DATABASE_URL") ao CARREGAR (mesmo em `prisma generate`,
# que NÃO conecta no banco). Se o ambiente ainda não tiver DATABASE_URL, usa um placeholder
# só para o generate/typecheck — as env vars reais (Vercel/Cloud Environment) mandam quando existem.
export DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost:5432/postgres?schema=cultpartners}"

echo "==> npm install"
npm install

echo "==> prisma generate"
npx prisma generate

echo "Setup concluído. Comandos úteis:"
echo "  npm run dev            # dev server (localhost:3000)"
echo "  npm run build          # build de produção (typecheck)"
echo "  npx vitest run         # testes (inclui src/lib/mcp/forbidden.test.ts)"
echo "  npx prisma db push     # sincroniza o schema (após o SQL manual do Supabase)"
