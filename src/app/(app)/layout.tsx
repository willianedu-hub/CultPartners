import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

type Item = { href?: string; label: string; children?: Item[]; soon?: boolean; icon?: string };

// Usuário placeholder da F1. A proteção de sessão (auth real, RBAC, permissões)
// entra na F2 — aqui montamos apenas o shell visual.
// TODO(F2): trocar por requireUser()/sessão real e recortar a navegação por permissão.
type PlaceholderUser = { name: string; role: string };

/** Navegação do CultPartners (ordem fixa). Estrutura plana; "Configurações" fica
 *  na seção Admin, espelhando o agrupamento do CRM. */
function buildNav(_user: PlaceholderUser): { main: Item[]; admin: Item[] } {
  const main: Item[] = [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/opportunities", label: "Oportunidades", icon: "Briefcase" },
    { href: "/pipeline", label: "Pipeline", icon: "Kanban" },
    { href: "/reports", label: "Relatórios", icon: "BarChart3" },
    { href: "/tasks", label: "Tarefas", icon: "Calendar" },
    { href: "/partners", label: "Parceiros", icon: "Building2" },
  ];
  const admin: Item[] = [{ href: "/settings", label: "Configurações", icon: "Settings" }];
  return { main, admin };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // TODO(F2): substituir pelo usuário autenticado da sessão.
  const user: PlaceholderUser = { name: "Admin", role: "admin" };
  const { main, admin } = buildNav(user);

  const tc = (await cookies()).get("theme")?.value;
  const theme = tc === "light" || tc === "navy" ? tc : "dark";

  async function logout() {
    "use server";
    // TODO(F2): encerrar a sessão real e redirecionar para /login.
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        userName={user.name}
        userRoles="Administrador"
        theme={theme}
        logout={logout}
      />
      {/* Corpo: sidebar persistente (desktop) + área de conteúdo */}
      <div className="flex flex-1">
        <Sidebar main={main} admin={admin} />
        {/* --bnav desconta a tab bar mobile (0 no desktop) */}
        <main className="min-w-0 flex-1 pb-[var(--bnav)]">{children}</main>
      </div>
      <MobileNav main={main} admin={admin} />
    </div>
  );
}
