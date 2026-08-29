import { cookies } from "next/headers";
import { requireUser, type SessionUser } from "@/lib/rbac";
import { signOut } from "@/lib/auth";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { SessionWatch } from "./SessionWatch";

type Item = { href?: string; label: string; children?: Item[]; soon?: boolean; icon?: string };

/**
 * Navegação do CultPartners, recortada por audiência. Estrutura plana; "Configurações"
 * fica na seção Admin, espelhando o agrupamento do CRM.
 *
 * PARCEIRO não enxerga "Parceiros" (é a listagem interna de parceiros) nem as
 * "Configurações" internas — só o seu próprio trabalho.
 */
function buildNav(user: SessionUser): { main: Item[]; admin: Item[] } {
  const isPartner = user.audience === "partner";

  const main: Item[] = [
    { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/opportunities", label: "Oportunidades", icon: "Briefcase" },
    { href: "/pipeline", label: "Pipeline", icon: "Kanban" },
    { href: "/reports", label: "Relatórios", icon: "BarChart3" },
    { href: "/tasks", label: "Tarefas", icon: "Calendar" },
  ];
  if (!isPartner) {
    main.push({ href: "/partners", label: "Parceiros", icon: "Building2" });
  }

  const admin: Item[] = isPartner ? [] : [{ href: "/settings", label: "Configurações", icon: "Settings" }];
  return { main, admin };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { main, admin } = buildNav(user);

  const tc = (await cookies()).get("theme")?.value;
  const theme = tc === "light" || tc === "navy" ? tc : "dark";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const userRoles =
    user.audience === "partner" ? "Parceiro" : user.roles.join(" · ") || "Equipe CultSec";

  return (
    <div className="flex min-h-screen flex-col">
      <SessionWatch email={user.email ?? null} />
      <TopBar
        userName={user.name ?? "Usuário"}
        userRoles={userRoles}
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
