// `/authorize` — o único endpoint OAuth com uma PESSOA do outro lado.
//
// GET: confere o pedido e manda para a tela de consentimento (ou para o login, se não
// houver sessão). POST: é o clique no botão — emite o código e devolve pelo `redirect_uri`.
//
// Três travas que não são óbvias:
//
//  1. **Erro de `client_id`/`redirect_uri` NÃO volta pelo redirect.** O endereço em si não é
//     confiável (é a consulta ao cliente que falhou); devolver por ele viraria redirecionador
//     aberto. Esses casos caem numa página de erro própria; todo o resto volta pelo redirect.
//  2. **Exige sessão INTERNA.** O CultPartners é o próprio servidor de autorização: só um
//     admin/executivo logado (via Microsoft, na F2) consente. Sem sessão interna, manda para
//     `/login?next=<pedido>` e volta para cá depois do login.
//  3. **O POST confere a origem.** O cookie de sessão é `SameSite=Lax`, o que já bloqueia POST
//     de outro site — mas "já é seguro por um padrão do navegador" é o tipo de garantia que
//     some numa mudança de configuração. A checagem explícita fica.

import { audit } from "@/lib/audit";
import { baseUrl } from "@/lib/appUrl";
import { getRealUser } from "@/lib/rbac";
import { CAMPOS_DO_PEDIDO, analisarPedido, urlDeErro, urlDeSucesso } from "@/lib/oauth/pedido";
import { guardarCodigo, marcarUsoDoCliente } from "@/lib/oauth/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return await autorizar(req);
  } catch (e) {
    // Falha nossa não pode virar 500 aqui: quem lê é uma PESSOA no meio de um fluxo de
    // autorização, e a página branca de erro do Next não diz o que fazer. Também não pode
    // voltar pelo `redirect_uri` — se o banco caiu, nem sabemos se aquele endereço é
    // confiável (é a consulta ao cliente que falhou).
    console.error("[oauth] falha no /authorize:", e);
    return paginaDeErro(
      "Não foi possível continuar agora",
      "O CultPartners não conseguiu verificar este pedido de autorização. Tente novamente em alguns instantes; " +
        "se persistir, avise quem administra o sistema.",
    );
  }
}

async function autorizar(req: Request) {
  const url = new URL(req.url);
  const analise = await analisarPedido(url.searchParams, req);
  if (analise.tipo === "fatal") return paginaDeErro(analise.titulo, analise.detalhe);
  if (analise.tipo === "devolver") {
    return Response.redirect(urlDeErro(analise.redirectUri, analise.erro, analise.detalhe, analise.state), 302);
  }

  // Sem sessão INTERNA: manda logar e VOLTA para cá com os mesmos parâmetros. É neste desvio
  // que a conta Microsoft entra no fluxo — para o cliente OAuth isso é invisível, ele só vê o
  // `/authorize` demorar mais. Parceiro logado também cai aqui: só sessão interna consente.
  const real = await getRealUser();
  if (!real || real.audience !== "internal") {
    const volta = `${url.pathname}${url.search}`;
    return Response.redirect(`${baseUrl(req)}/login?next=${encodeURIComponent(volta)}`, 302);
  }

  // A tela é uma página de verdade (React), não HTML montado aqui: consentimento é
  // interface, e interface que só existe dentro de uma rota de API não recebe cuidado.
  const consentimento = new URL(`${baseUrl(req)}/oauth/consent`);
  for (const campo of CAMPOS_DO_PEDIDO) {
    const v = url.searchParams.get(campo);
    if (v !== null) consentimento.searchParams.set(campo, v);
  }
  return Response.redirect(consentimento.toString(), 302);
}

export async function POST(req: Request) {
  try {
    return await consentir(req);
  } catch (e) {
    console.error("[oauth] falha no consentimento:", e);
    return paginaDeErro(
      "Não foi possível registrar sua decisão",
      "O CultPartners não conseguiu concluir a autorização. Nada foi liberado. Tente novamente em alguns instantes.",
    );
  }
}

async function consentir(req: Request) {
  const origem = req.headers.get("origin");
  const nossa = baseUrl(req);
  if (origem && origem !== nossa) {
    return paginaDeErro(
      "Pedido de outra origem",
      "Este formulário só pode ser enviado pela tela de consentimento do CultPartners.",
    );
  }

  const form = await req.formData();
  const p = new URLSearchParams();
  for (const campo of CAMPOS_DO_PEDIDO) {
    const v = form.get(campo);
    if (typeof v === "string" && v !== "") p.set(campo, v);
  }

  const analise = await analisarPedido(p, req);
  if (analise.tipo === "fatal") return paginaDeErro(analise.titulo, analise.detalhe);
  if (analise.tipo === "devolver") {
    return redirecionar(urlDeErro(analise.redirectUri, analise.erro, analise.detalhe, analise.state));
  }
  const { pedido, cliente } = analise;

  const real = await getRealUser();
  if (!real) {
    // A sessão venceu entre abrir a tela e clicar. Devolver `access_denied` é honesto: o
    // cliente reautoriza, e desta vez o login acontece antes.
    return redirecionar(
      urlDeErro(pedido.redirectUri, "access_denied", "sessão expirada antes do consentimento", pedido.state),
    );
  }
  if (real.audience !== "internal") {
    // Parceiro não consente conector: o token nasceria com o alcance dele e a trilha
    // registraria o consentimento no nome dele. Recusa em página própria.
    return paginaDeErro(
      "Somente contas internas autorizam conectores",
      "Você está conectado como parceiro. Um conector autorizado precisa nascer no nome de um administrador " +
        "ou executivo de canal. Entre com uma conta interna e tente de novo.",
    );
  }

  if (form.get("decisao") !== "permitir") {
    await audit({
      action: "UPDATE",
      entityType: "OAuthClient",
      entityId: cliente.clientId,
      entityLabel: cliente.name,
      summary: `recusou o acesso do conector “${cliente.name}”`,
      userId: real.id,
      userName: real.name ?? null,
      userEmail: real.email ?? null,
      meta: { canal: "oauth", decisao: "negado", clientId: cliente.clientId },
      context: { route: "/api/oauth/authorize" },
    });
    return redirecionar(urlDeErro(pedido.redirectUri, "access_denied", "acesso recusado pelo usuário", pedido.state));
  }

  const codigo = await guardarCodigo({
    clientId: cliente.clientId,
    userId: real.id,
    redirectUri: pedido.redirectUri,
    codeChallenge: pedido.codeChallenge,
    codeChallengeMethod: pedido.codeChallengeMethod,
    scopes: pedido.scopes,
    resource: pedido.resource,
  });
  await marcarUsoDoCliente(cliente.clientId);

  // O consentimento é o evento que importa na trilha — o token que nasce dele é
  // consequência. Quem auditar depois pergunta "quem deixou este conector entrar?", e a
  // resposta é esta linha.
  await audit({
    action: "CREATE",
    entityType: "OAuthClient",
    entityId: cliente.clientId,
    entityLabel: cliente.name,
    summary: `autorizou o conector “${cliente.name}” a ler o CultPartners em seu nome`,
    userId: real.id,
    userName: real.name ?? null,
    userEmail: real.email ?? null,
    meta: {
      canal: "oauth",
      decisao: "permitido",
      clientId: cliente.clientId,
      escopos: pedido.scopes,
      recurso: pedido.resource,
      redirectUri: pedido.redirectUri,
    },
    context: { route: "/api/oauth/authorize" },
  });

  return redirecionar(urlDeSucesso(pedido.redirectUri, codigo, pedido.state));
}

/**
 * 303 e não 302: depois de um POST, 303 obriga o navegador a fazer GET no destino. Com 302
 * alguns clientes repetem o POST no `redirect_uri` — e o código de autorização iria no
 * corpo para um servidor que espera query string.
 */
function redirecionar(destino: string): Response {
  return new Response(null, { status: 303, headers: { location: destino, "cache-control": "no-store" } });
}

/**
 * Página de erro do fluxo. HTML mínimo e autocontido de propósito: é o caminho em que NÃO
 * podemos confiar no `redirect_uri`, então quem lê é uma pessoa, na nossa tela, e a página
 * precisa funcionar mesmo que o resto do app não carregue.
 */
function paginaDeErro(titulo: string, detalhe: string): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} — CultPartners</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         background:#0b1020; color:#e8ecf6;
         font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif }
  main { max-width:34rem; background:#141a2e; border:1px solid #263054; border-radius:14px; padding:28px }
  h1 { margin:0 0 10px; font-size:1.15rem }
  p { margin:0; color:#a9b4cf }
  .tag { display:inline-block; margin-bottom:14px; font-size:11px; letter-spacing:.08em;
         text-transform:uppercase; color:#7f8db3 }
</style></head><body><main>
<span class="tag">CultPartners · autorização</span>
<h1>${esc(titulo)}</h1><p>${esc(detalhe)}</p>
</main></body></html>`;
  return new Response(html, {
    status: 400,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
