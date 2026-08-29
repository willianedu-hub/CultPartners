"use client";

// Sidebar persistente (desktop, ≥md): navegação principal fixa à esquerda, abaixo da
// TopBar. No mobile nada disso renderiza — a navegação vive no MobileNav.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/ui/nav-icon";

type Item = { href?: string; label: string; children?: Item[]; soon?: boolean; icon?: string };

function isActive(href: string | undefined, path: string) {
  if (!href) return false;
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** Linha de navegação da sidebar. Ativo: fundo surface2 + glifo magenta (mesma
 *  linguagem visual do menu do CRM). */
function SideRow({ item, path }: { item: Item; path: string }) {
  const active = isActive(item.href, path);
  const base = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors";
  const lead = (
    <NavIcon name={item.icon} className={`h-4 w-4 shrink-0 ${active ? "text-ink-magenta" : "text-faint"}`} />
  );

  if (item.soon) {
    return (
      <div className={`${base} cursor-default justify-between text-faint`}>
        <span className="flex items-center gap-2.5">{lead}{item.label}</span>
        <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-faint">em breve</span>
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={`${base} ${active ? "bg-surface2 font-medium text-text" : "text-muted hover:bg-surface2 hover:text-text"}`}
    >
      {lead}{item.label}
    </Link>
  );
}

/** Título de seção (bloco Admin). */
function SideSection({ label }: { label: string }) {
  return (
    <div className="mx-2 mb-1 mt-3 border-t border-border pt-3 text-[10px] font-semibold uppercase tracking-wider text-faint">
      {label}
    </div>
  );
}

export function Sidebar({ main, admin }: { main: Item[]; admin: Item[] }) {
  const path = usePathname();
  return (
    // sticky abaixo da TopBar (h-12); ocupa a altura restante da viewport.
    <aside className="glass sticky top-12 hidden h-[calc(100dvh-3rem)] w-60 shrink-0 flex-col border-r border-border md:flex">
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {main.map((i) => <SideRow key={i.label} item={i} path={path} />)}
        {admin.length > 0 && (
          <>
            <SideSection label="Admin" />
            {admin.map((i) => <SideRow key={i.label} item={i} path={path} />)}
          </>
        )}
      </nav>
    </aside>
  );
}
