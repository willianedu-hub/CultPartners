import { requireUser, isAdmin } from "@/lib/rbac";
import { loadScopedTasks } from "./data";
import { TasksView } from "./TasksView";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  const data = await loadScopedTasks(user);

  // Quem pode ESCREVER tarefa é quem pode escrever oportunidade: admin ou parceiro (o seu).
  // Executivo de canal é somente-leitura — a tela mostra, mas não deixa mexer.
  const canWrite = isAdmin(user) || user.audience === "partner";

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Tarefas</h1>
        <p className="mt-1 text-sm text-muted">
          {data.totalAbertas > 0
            ? `${data.totalAbertas} tarefa${data.totalAbertas !== 1 ? "s" : ""} em aberto no seu alcance.`
            : "Nenhuma tarefa em aberto no seu alcance."}
          {!canWrite && " Visualização somente leitura."}
        </p>
      </header>

      <TasksView data={data} canWrite={canWrite} />
    </main>
  );
}
