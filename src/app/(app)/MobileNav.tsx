"use client";

// Navegação mobile (<768px): bottom tab bar fixa (zona do polegar) + drawer "Menu"
// com a árvore completa de navegação. No desktop nada disso renderiza (a sidebar cuida).
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { NavIcon } from "@/components/ui/nav-icon";

type Item = { href?: string; label: string; children?: Item[]; soon?: boolean; icon?: string };

function isActive(href: string | undefined, path: string) {
  if (!href) return false;
  return href === "/" ? path === "/" : path.startsWith(href);
}

// Abas candidatas, por prioridade — entram as 4 primeiras presentes na árvore.
const TAB_PRIORITY: { href: string; label: string; icon: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/pipeline", label: "Pipeline", icon: "Kanban" },
  { href: "/opportunities", label: "Oportun.", icon: "Briefcase" },
  { href: "/tasks", label: "Tarefas", icon: "Calendar" },
  { href: "/partners", label: "Parceiros", icon: "Building2" },
];

/** Linha de item no drawer (h-11 → alvo de toque de 44px, o mínimo). */
function DrawerRow({ item, path }: { item: Item; path: string }) {
  const active = isActive(item.href, path);
  const icon = (
    <NavIcon name={item.icon} className={`h-5 w-5 shrink-0 ${active ? "text-ink-magenta" : "text-faint"}`} />
  );

  if (item.soon) {
    return (
      <div className="flex h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm text-faint">
        <span className="flex items-center gap-3">{icon}{item.label}</span>
        <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-faint">em breve</span>
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${active ? "bg-surface2 font-medium text-text" : "text-muted"}`}
    >
      {icon}{item.label}
    </Link>
  );
}

/** Título de seção do drawer (grupos com children e bloco Admin). */
function DrawerSection({ label }: { label: string }) {
  return (
    <div className="px-3 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</div>
  );
}

export function MobileNav({ main, admin }: { main: Item[]; admin: Item[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  // Hrefs presentes na árvore (main + filhos) p/ decidir quais abas exibir.
  const hrefs = new Set(main.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]).filter(Boolean));
  const tabs = TAB_PRIORITY.filter((t) => hrefs.has(t.href)).slice(0, 4);

  // Fecha o drawer ao navegar.
  useEffect(() => { setOpen(false); }, [path]);

  // Trava o scroll do body enquanto o drawer está aberto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      {/* Tab bar inferior (só mobile) */}
      <nav aria-label="Navegação principal" className="glass-strong pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border md:hidden">
        <div className="flex h-15 items-stretch">
          {tabs.map((t) => {
            const active = isActive(t.href, path);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${active ? "text-ink-magenta" : "text-muted"}`}
              >
                <NavIcon name={t.icon} className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{t.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${open ? "text-ink-magenta" : "text-muted"}`}
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span className="text-[10px] font-medium leading-none">Menu</span>
          </button>
        </div>
      </nav>

      {/* Drawer "Menu": bottom-sheet com a navegação completa */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div className="modal-pop pb-safe relative flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-border bg-surface">
            {/* Alça do sheet */}
            <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border" />
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-1.5">
              <span className="text-sm font-semibold text-text">Menu</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-text"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-3 pb-3">
              {/* Busca (input falso → página de busca) */}
              <Link
                href="/search"
                className="mt-2 flex h-11 items-center gap-2.5 rounded-lg border border-border bg-surface2/50 px-3 text-sm text-muted"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                Buscar…
              </Link>

              {/* Navegação completa */}
              <div className="mt-1">
                {main.map((i) =>
                  i.children ? (
                    <div key={i.label}>
                      <DrawerSection label={i.label} />
                      {i.children.map((c) => <DrawerRow key={c.label} item={c} path={path} />)}
                    </div>
                  ) : (
                    <DrawerRow key={i.label} item={i} path={path} />
                  )
                )}
                {admin.length > 0 && (
                  <>
                    <DrawerSection label="Admin" />
                    {admin.map((i) => <DrawerRow key={i.label} item={i} path={path} />)}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
