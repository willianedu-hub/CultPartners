// Tela de consentimento — a única parte do OAuth que uma PESSOA lê.
//
// Ela é uma página de verdade (e não HTML montado dentro da rota de API) porque é aqui que
// alguém decide dar a um programa de fora o alcance inteiro que tem no CultPartners. Uma tela
// dessas precisa dizer três coisas sem rodeio: **quem** está pedindo, **em nome de quem** o
// acesso vai valer, e **o que exatamente** ele alcança. As duas primeiras são fáceis de
// esquecer, e são justamente as que o phishing explora: sem o nome de quem está logado, a
// pessoa autoriza achando que é outra conta.
//
// A revalidação aqui é a MESMA de `analisarPedido` usada pelo POST. Não é redundância: se a
// tela validasse menos, o botão apareceria para um pedido que o POST recusa; se validasse
// mais, dava para pular a tela montando o formulário à mão.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { getRealUser } from "@/lib/rbac";
import { CAMPOS_DO_PEDIDO, analisarPedido } from "@/lib/oauth/pedido";

export const dynamic = "force-dynamic";

/** O que cada escopo significa em português — a pessoa não vai entender `read`. */
const EXPLICA: Record<string, { titulo: string; detalhe: string }> = {
  read: {
    titulo: "Ler o CultPartners no seu lugar",
    detalhe:
      "Parceiros, oportunidades, metas e relatórios — exatamente o que você vê ao entrar, " +
      "nem um registro a mais.",
  },
};

type Busca = Record<string, string | string[] | undefined>;

export default async function ConsentPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const busca = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(busca)) {
    if (typeof v === "string") p.set(k, v);
    else if (Array.isArray(v) && v[0]) p.set(k, v[0]);
  }

  // Sem sessão INTERNA: volta pelo `/authorize`, e não direto para o login. Assim o pedido
  // passa pela validação de novo depois do login — inclusive se o cliente foi desativado no
  // meio. Parceiro logado também é mandado a reautenticar: só sessão interna consente.
  const eu = await getRealUser();
  if (!eu || eu.audience !== "internal") {
    redirect(`/login?next=${encodeURIComponent(`/api/oauth/authorize?${p.toString()}`)}`);
  }

  // `analisarPedido` precisa de um `Request` só para descobrir a URL canônica; a página não
  // tem um. A base vem do ambiente em produção, e o único efeito de passar uma URL fictícia
  // é na checagem de `resource` — que o `/authorize` já fez antes de mandar para cá, e que
  // o POST vai fazer de novo com o pedido real.
  const analise = await analisarPedido(p, new Request("http://localhost/oauth/consent"));

  if (analise.tipo !== "ok") {
    const titulo = analise.tipo === "fatal" ? analise.titulo : "Pedido de autorização inválido";
    const detalhe = analise.detalhe;
    return (
      <Moldura>
        <h1 className="text-lg font-semibold text-text">{titulo}</h1>
        <p className="mt-2 text-sm text-muted">{detalhe}</p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-accent-blue hover:underline">
          Voltar ao CultPartners
        </Link>
      </Moldura>
    );
  }

  const { cliente, pedido } = analise;
  const host = hostDe(pedido.redirectUri);

  return (
    <Moldura>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Autorizar aplicativo</p>
      <h1 className="mt-2 text-xl font-semibold leading-snug text-text">
        <strong className="font-semibold">{cliente.name}</strong> quer acessar o CultPartners em seu nome
      </h1>

      <div className="mt-5 rounded-lg border border-border bg-sunken px-4 py-3 text-sm">
        <span className="text-muted">Conectando como </span>
        <strong className="text-text">{eu.name ?? eu.email}</strong>
        {eu.email && eu.name ? <span className="text-faint"> · {eu.email}</span> : null}
        <p className="mt-1.5 text-[13px] leading-snug text-muted">
          O aplicativo alcança exatamente o que <em>você</em> alcança — nada além. Se você vê só os parceiros
          da sua carteira, ele também vê só os da sua carteira.
        </p>
      </div>

      <ul className="mt-5 space-y-3">
        {pedido.scopes.map((e) => {
          const x = EXPLICA[e] ?? { titulo: e, detalhe: "Escopo sem descrição." };
          return (
            <li key={e} className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />
              <span>
                <span className="block text-sm font-medium text-text">{x.titulo}</span>
                <span className="block text-[13px] leading-snug text-muted">{x.detalhe}</span>
              </span>
            </li>
          );
        })}
        <li className="flex gap-3">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
          <span>
            <span className="block text-sm font-medium text-text">Não pode alterar nada</span>
            <span className="block text-[13px] leading-snug text-muted">
              O CultPartners não concede escopo de escrita a aplicativos. Criar, editar e apagar continua só pela tela.
            </span>
          </span>
        </li>
      </ul>

      <p className="mt-5 text-[13px] leading-snug text-muted">
        Depois de autorizar, o CultPartners devolve o acesso para <strong className="text-text">{host}</strong>. Cada
        leitura feita pelo aplicativo entra na sua trilha de auditoria, e você pode revogar quando quiser em{" "}
        <Link href="/settings/mcp" className="text-accent-blue hover:underline">
          Configurações › Acesso de máquina
        </Link>
        .
      </p>

      {/* Sem JavaScript: dois botões `submit` no mesmo formulário, distinguidos pelo `value`.
          Uma tela de consentimento tem que funcionar mesmo quando o resto do app não carrega. */}
      <form method="post" action="/api/oauth/authorize" className="mt-7 flex gap-3 max-sm:flex-col-reverse">
        {CAMPOS_DO_PEDIDO.map((campo) => {
          const v = p.get(campo);
          return v === null ? null : <input key={campo} type="hidden" name={campo} value={v} />;
        })}
        <button
          type="submit"
          name="decisao"
          value="negar"
          className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface2 hover:text-text max-sm:min-h-11"
        >
          Recusar
        </button>
        <button
          type="submit"
          name="decisao"
          value="permitir"
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 max-sm:min-h-11"
        >
          Autorizar
        </button>
      </form>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-10 max-md:min-h-dvh">
      <div className="w-full max-w-md">
        <Logo className="mb-6 justify-center" markClassName="h-7 w-auto" wordmarkClassName="text-base text-text" />
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-7">{children}</div>
      </div>
    </main>
  );
}

/** Só o host, porque é o que a pessoa consegue reconhecer — a URL inteira ela não lê. */
function hostDe(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}
