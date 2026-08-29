import { redirect } from "next/navigation";

// A raiz leva ao painel; a proteção de sessão acontece no grupo de rotas (app).
export default function Home() {
  redirect("/dashboard");
}
