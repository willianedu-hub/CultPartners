import { UserCircle2, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { changePassword } from "@/lib/domain/perfil";
import { PerfilClient } from "./PerfilClient";

export const dynamic = "force-dynamic";

/**
 * Perfil do usuário logado. Aberto a QUALQUER audiência (`requireUser`):
 *  - PARCEIRO: troca a própria senha local (bcrypt) via `changePassword`.
 *  - INTERNO (admin/executivo): não há senha local de autoatendimento — o acesso é pela
 *    Microsoft (Entra ID). Mostramos apenas a explicação, sem formulário.
 */
export default async function PerfilPage() {
  const user = await requireUser();
  const isPartner = user.audience === "partner";

  return (
    <main className="w-full px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <UserCircle2 className="h-5 w-5 text-faint" aria-hidden /> Meu perfil
      </h1>
      <p className="mt-1 text-sm text-muted">
        {user.name ?? "Usuário"}
        {user.email ? <span className="text-faint"> · {user.email}</span> : null}
      </p>

      {isPartner ? (
        <PerfilClient changePassword={changePassword} />
      ) : (
        <section className="mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2 text-ink-magenta">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text">Acesso pela Microsoft</h2>
            <p className="mt-1 text-sm text-muted">
              Sua conta entra pelo login corporativo da Microsoft (Entra ID). A senha é
              gerenciada por lá, não neste portal — para trocá-la, use os canais de identidade
              da CultSec.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
