import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { urlDoMcp } from "@/lib/appUrl";
import { requireInternal, isAdmin } from "@/lib/rbac";
import { McpClient, type TokenRow } from "./McpClient";
import { criarToken, revogarToken } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Teto de linhas da lista. As credenciais OAuth se renovam sozinhas (uma linha nova por
 * ciclo), então sem teto esta tela — justamente a de procurar credencial esquecida —
 * acumularia centenas de "Revogada". A ordenação abaixo garante que o que cabe é o que
 * interessa: vivas primeiro, encerradas recentes depois.
 */
const TETO_LINHAS = 200;

export default async function McpSettingsPage() {
  const user = await requireInternal();

  const rows = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    take: TETO_LINHAS,
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      kind: true,
      client: { select: { name: true } },
    },
  });

  // Quantas ficaram de fora do teto. A tela precisa DIZER que cortou, senão a pessoa lê uma
  // lista incompleta achando que é a lista inteira.
  const total = await prisma.apiToken.count({ where: { userId: user.id } });

  // `expirado` é decidido pelo BANCO e não por `Date.now()` no render: o eslint do Next 16
  // trata relógio dentro de componente como função impura (`react-hooks/purity`). Uma
  // consulta a mais e a resposta fica com um instante só, o do banco.
  const [{ agora }] = await prisma.$queryRaw<{ agora: Date }[]>`select now() as agora`;
  const limite = agora.getTime();

  const tokens: TokenRow[] = rows.map((t) => ({
    id: t.id,
    name: t.name,
    prefix: t.prefix,
    escopos: t.scopes ?? [],
    criadoEm: t.createdAt.toISOString(),
    expiraEm: t.expiresAt.toISOString(),
    ultimoUso: t.lastUsedAt?.toISOString() ?? null,
    revogadoEm: t.revokedAt?.toISOString() ?? null,
    expirado: t.expiresAt.getTime() <= limite,
    // `kind` na tela porque revogar significa coisas diferentes: um PAT a pessoa criou e
    // guarda; um token OAuth ela apenas consentiu, e quem o guarda é o aplicativo — revogá-lo
    // faz o aplicativo pedir autorização de novo.
    origem: t.kind === "oauth" ? (t.client?.name ?? "aplicativo OAuth") : null,
  }));

  return (
    <main className="w-full px-4 py-6 sm:px-6">
      <McpClient
        tokens={tokens}
        // A URL do conector, SEM credencial — é o caminho do OAuth. Vem de `urlDoMcp` (a
        // mesma função que os documentos de descoberta usam), então o que a tela manda copiar
        // é exatamente o que o cliente vai descobrir.
        urlMcp={urlDoMcp(await headers())}
        ocultas={Math.max(0, total - rows.length)}
        // O aviso de admin é a decisão explícita de PERMITIR emitir para conta com acesso
        // total: a tela não bloqueia, ela diz em letras claras o que o token alcança.
        souAdmin={isAdmin(user)}
        actions={{ criarToken, revogarToken }}
      />
    </main>
  );
}
