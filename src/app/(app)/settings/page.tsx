import Link from "next/link";
import { ChevronRight, Bot, Package, GitBranch, Building2, UserCircle2, type LucideIcon } from "lucide-react";
import { requireInternal, isAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Índice de Configurações. Cada card leva a uma área já portada. `adminOnly` esconde do
 * executivo de canal as áreas que só o admin usa (as próprias páginas reexigem admin de
 * qualquer forma — aqui é só não oferecer o que não dá para usar).
 *
 * "Acesso MCP" fica com `adminOnly: false` de propósito: uma credencial não dá mais alcance
 * do que quem a criou já tem, então exigir permissão só criaria a ilusão de privilégio.
 */
type Section = { href: string; title: string; desc: string; Icon: LucideIcon; adminOnly: boolean };

const SECTIONS: Section[] = [
  {
    href: "/partners",
    title: "Parceiros",
    desc: "Cadastro dos parceiros de canal: criar, editar, redefinir senha e arquivar.",
    Icon: Building2,
    adminOnly: true,
  },
  {
    href: "/settings/produtos",
    title: "Produtos e serviços",
    desc: "Catálogo oferecido pelos parceiros, com categoria e ordem.",
    Icon: Package,
    adminOnly: true,
  },
  {
    href: "/settings/funil",
    title: "Etapas do funil",
    desc: "Etapas do pipeline de oportunidades, com cor e ordem.",
    Icon: GitBranch,
    adminOnly: true,
  },
  {
    href: "/settings/perfil",
    title: "Meu perfil",
    desc: "Troca de senha (parceiro) e informações da sua conta.",
    Icon: UserCircle2,
    adminOnly: false,
  },
  {
    href: "/settings/mcp",
    title: "Acesso de outros chats (MCP)",
    desc: "Credencial para outro chat do Claude ler o CultPartners com o seu acesso.",
    Icon: Bot,
    adminOnly: false,
  },
];

export default async function SettingsPage() {
  const user = await requireInternal();
  const admin = isAdmin(user);
  const sections = SECTIONS.filter((s) => !s.adminOnly || admin);

  return (
    <main className="w-full px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Administração do portal.</p>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {sections.map((s) => (
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
      </div>
    </main>
  );
}
