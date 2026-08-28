import Link from "next/link";
import { ChevronRight, Bot, Plus, type LucideIcon } from "lucide-react";
import { requireInternal } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Índice de Configurações. Por enquanto só o "Acesso MCP" existe de fato; as demais áreas
 * do CRM (usuários, funil, catálogo…) ainda não foram portadas — quando forem, entram aqui.
 *
 * `perm: null` = área aberta a qualquer usuário interno: uma credencial não dá mais alcance
 * do que quem a criou já tem, então exigir permissão só criaria a ilusão de privilégio.
 */
const SECTIONS: { href: string; title: string; desc: string; Icon: LucideIcon }[] = [
  {
    href: "/settings/mcp",
    title: "Acesso de outros chats (MCP)",
    desc: "Credencial para outro chat do Claude ler o CultPartners com o seu acesso.",
    Icon: Bot,
  },
];

export default async function SettingsPage() {
  await requireInternal();

  return (
    <main className="w-full px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Administração do portal. Em breve, mais áreas aqui.</p>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 transition-colors hover:border-[#E91E8C] sm:px-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface2 text-muted transition-colors group-hover:text-[#E91E8C]">
              <s.Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text">{s.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{s.desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-[#E91E8C]" aria-hidden />
          </Link>
        ))}
        {/* Áreas futuras */}
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 px-3 py-3 sm:px-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface2/60 text-faint">
            <Plus className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-faint">Mais em breve</span>
            <span className="mt-0.5 block text-xs leading-snug text-faint">Usuários, funil, catálogo e integrações.</span>
          </span>
        </div>
      </div>
    </main>
  );
}
