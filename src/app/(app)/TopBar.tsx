"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Moon, Droplet, Search, LogOut, ChevronDown, Check, type LucideIcon } from "lucide-react";

/** Marca CultSec — escudo (magenta + azul royal) inline, para o shell não depender de
 *  um componente de @/components/ui (território de outro agente). Wordmark: CultPartners. */
function Brand() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 100 112" fill="none" className="h-6 w-auto transition-transform group-hover:scale-105" role="img" aria-label="CultPartners">
        <path
          d="M12 18 L50 30 L88 18 C92 46 90 72 78 88 C68 101 56 106 50 108 C44 106 32 101 22 88 C10 72 8 46 12 18 Z"
          stroke="#e91e8c" strokeWidth="7.5" strokeLinejoin="round" strokeLinecap="round"
        />
        <path
          d="M26 30 L50 38 L74 30 C77 50 76 68 67 81 C60 91 53 95 50 96 C47 95 40 91 33 81 C24 68 23 50 26 30 Z"
          stroke="#3f5cab" strokeWidth="6.5" strokeLinejoin="round" strokeLinecap="round"
        />
      </svg>
      <span className="text-sm font-bold leading-none tracking-tight text-text">CultPartners</span>
    </span>
  );
}

type ThemeId = "dark" | "navy" | "light";
const THEMES: { id: ThemeId; label: string; icon: LucideIcon; swatch: string; ink: string }[] = [
  { id: "dark", label: "Escuro", icon: Moon, swatch: "#14161d", ink: "#e9f0ff" },
  { id: "navy", label: "Azul", icon: Droplet, swatch: "#dbe6fb", ink: "#2f56c7" },
  { id: "light", label: "Claro", icon: Sun, swatch: "#ffffff", ink: "#14161d" },
];

/** Seletor de tema (3 opções): escuro, azul-marinho e claro. Persiste em cookie. */
function ThemeMenu({ initial }: { initial: ThemeId }) {
  const [theme, setTheme] = useState<ThemeId>(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(id: ThemeId) {
    setTheme(id);
    setOpen(false);
    const root = document.documentElement;
    root.classList.remove("dark", "navy");
    if (id === "dark") root.classList.add("dark");
    else if (id === "navy") root.classList.add("navy");
    document.cookie = `theme=${id}; path=/; max-age=31536000`;
  }

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const CurIcon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Tema"
        aria-label="Tema"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface2 hover:text-text max-md:h-10 max-md:w-10"
      >
        <CurIcon className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full pt-1.5">
          <div className="reveal w-52 rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-lg)]">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Tema</div>
            {THEMES.map((t) => {
              const on = t.id === theme;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => choose(t.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface2 max-md:py-2.5 ${on ? "text-text" : "text-muted"}`}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border" style={{ background: t.swatch }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: t.ink }} aria-hidden />
                  </span>
                  <span className="flex-1 text-left">{t.label}</span>
                  {on && <Check className="h-3.5 w-3.5 shrink-0 text-ink-magenta" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  userName,
  userRoles,
  theme,
  logout,
}: {
  userName: string;
  userRoles: string;
  theme: ThemeId;
  logout: () => Promise<void>;
}) {
  const [userOpen, setUserOpen] = useState(false);
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    setUserOpen(false);
  }, [path]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <header
      ref={ref}
      className="glass sticky top-0 z-40 flex h-12 items-center gap-1 border-b border-border px-4"
    >
      <Link href="/dashboard" className="group flex items-center pr-1">
        <Brand />
      </Link>

      {/* Busca (desktop; no mobile vira ícone no cluster da direita) */}
      <form action="/search" className="relative ml-2 hidden w-56 md:block lg:w-80 xl:w-96">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
        <input
          name="q"
          placeholder="Buscar parceiros, oportunidades…"
          className="w-full rounded-lg border border-border bg-surface2/50 py-1.5 pl-8 pr-3 text-sm text-text outline-none transition-colors placeholder:text-faint focus:border-[#e91e8c] focus:bg-surface"
        />
      </form>

      {/* Cluster da direita (fixo no canto) */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* Busca (só mobile) */}
        <Link href="/search" aria-label="Buscar" className="grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-surface2 md:hidden">
          <Search className="h-4 w-4" aria-hidden />
        </Link>
        <ThemeMenu initial={theme} />

        <div className="relative">
          <button
            onClick={() => setUserOpen((v) => !v)}
            aria-label={`Conta de ${userName}`}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm text-muted transition-colors hover:bg-surface2 max-md:h-10 max-md:gap-0.5 max-md:py-0 max-md:pr-1.5"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white shadow-[var(--shadow-sm)]"
              style={{ background: "linear-gradient(135deg, #e91e8c, #3f5cab)" }}
            >
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-muted sm:inline">{userName.split(" ")[0]}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-faint transition-transform duration-200 ${userOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {userOpen && (
            <div className="absolute right-0 top-full pt-1.5">
              <div className="reveal w-56 rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-lg)]">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #e91e8c, #3f5cab)" }}
                  >
                    {userName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text">{userName}</div>
                    <div className="truncate text-xs text-faint">{userRoles}</div>
                  </div>
                </div>
                <div className="my-1 border-t border-border" />
                <form action={logout}>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface2 hover:text-text max-md:py-2.5">
                    <LogOut className="h-4 w-4 text-faint" aria-hidden /> Sair
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
