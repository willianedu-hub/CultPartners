// RFC 7009 — revogação. O cliente devolve a credencial quando o usuário desconecta.
//
// A regra contraintuitiva da especificação, e ela está certa: **responde 200 mesmo quando o
// token não existe.** Se respondesse 404 para desconhecido e 200 para conhecido, o endpoint
// viraria um oráculo — dá para testar credenciais roubadas contra ele sem nunca usá-las.
// A única coisa que a resposta diz é "depois desta chamada, aquele valor não vale".

import { audit } from "@/lib/audit";
import { credenciaisDoCliente, erroOAuth, lerCorpo, preflight, protegido } from "@/lib/oauth/http";
import { acharCliente, autenticaCliente, revogarPorValor } from "@/lib/oauth/store";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  return protegido("revoke", () => revogar(req));
}

async function revogar(req: Request) {
  const corpo = await lerCorpo(req);
  const { clientId, secret } = credenciaisDoCliente(req, corpo);

  // O cliente ainda precisa se identificar: sem isso qualquer um revogaria o token de
  // qualquer um só por adivinhar o valor — que é justamente o que o atacante tem.
  const cliente = await acharCliente(clientId);
  if (!cliente) return erroOAuth("invalid_client", "cliente desconhecido ou credencial inválida");
  const falha = autenticaCliente(cliente, secret);
  if (falha) return erroOAuth(falha.erro, "cliente desconhecido ou credencial inválida");

  const valor = corpo.token;
  if (!valor) return erroOAuth("invalid_request", "token é obrigatório");

  const r = await revogarPorValor(valor);
  if (r.achou && r.tokenId) {
    await audit({
      action: "DELETE",
      entityType: "ApiToken",
      entityId: r.tokenId,
      entityLabel: cliente.name,
      summary: `conector “${cliente.name}” revogou a própria credencial`,
      meta: { canal: "oauth", clientId: cliente.clientId, dica: corpo.token_type_hint ?? null },
      context: { route: "/api/oauth/revoke" },
    });
  }

  // 200 com corpo vazio, ache ou não ache. Ver o comentário do topo.
  return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
}
