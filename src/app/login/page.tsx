// Server Component só para ler o motivo (e o destino) da URL. O `useSearchParams` no cliente
// obrigaria a envolver o formulário em <Suspense> e tirar a página do pré-render;
// `searchParams` aqui resolve sem esse custo.
import { parseLoginReason } from "@/lib/sessionPolicy";
import { loginMicrosoftDisponivel } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { LoginShell } from "./LoginShell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sessao?: string; next?: string; error?: string }>;
}) {
  const { sessao, next, error } = await searchParams;
  return (
    <LoginShell>
      <LoginForm
        reason={parseLoginReason(sessao)}
        next={next}
        microsoft={loginMicrosoftDisponivel}
        erroExterno={mensagemDoErro(error)}
      />
    </LoginShell>
  );
}

/**
 * Traduz o `?error=` que o Auth.js devolve quando o login federado é recusado.
 *
 * `AccessDenied` é o código do nosso próprio `signIn` devolvendo `false` — quase sempre
 * "autenticou na Microsoft, mas não tem cadastro no portal". O texto tem que dizer isso, senão
 * a pessoa fica tentando de novo achando que errou a senha, que ela nem digitou.
 */
function mensagemDoErro(codigo: string | undefined): string | null {
  if (!codigo) return null;
  if (codigo === "AccessDenied") {
    return "Sua conta Microsoft foi reconhecida, mas ela não tem acesso a este portal. Peça a um administrador para liberar.";
  }
  if (codigo === "OAuthAccountNotLinked") {
    return "Este e-mail já entra por outro caminho. Use e-mail e senha, ou fale com um administrador.";
  }
  return "Não foi possível concluir o login com a conta Microsoft. Tente de novo ou entre com e-mail e senha.";
}
