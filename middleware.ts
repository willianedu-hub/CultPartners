import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Vigia de borda (Edge) do grupo (app): sem sessão → /login.
//
// De propósito NÃO importa `@/lib/auth`: aquele módulo puxa Prisma/bcrypt, que não rodam no
// runtime Edge do middleware. Aqui a checagem é só a PRESENÇA do cookie de sessão do Auth.js —
// a validação de verdade (usuário ativo, sessão revogada, audiência) é feita no servidor por
// `requireUser`/`requireInternal`/`requirePartner`. O middleware é a primeira peneira, não a trava.
//
// Rotas liberadas: /login, /api/auth (fluxo do próprio Auth.js), /api/oauth (servidor OAuth),
// /.well-known e os assets estáticos (excluídos pelo matcher abaixo).

const LIBERADAS = [/^\/login(?:\/|$)/, /^\/api\/auth(?:\/|$)/, /^\/api\/oauth(?:\/|$)/, /^\/\.well-known(?:\/|$)/];

// Nome do cookie de sessão do Auth.js v5: `authjs.session-token` em dev,
// `__Secure-authjs.session-token` atrás de HTTPS.
const COOKIES_SESSAO = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LIBERADAS.some((r) => r.test(pathname))) return NextResponse.next();

  const temSessao = COOKIES_SESSAO.some((c) => req.cookies.get(c)?.value);
  if (!temSessao) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // ?next= preserva o destino para voltar depois do login (validado por destinoSeguro).
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Tudo, menos os internos do Next e arquivos com extensão (assets).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
