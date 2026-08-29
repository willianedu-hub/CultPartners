// `/token` — troca de credencial. Nenhuma pessoa do outro lado, só o cliente.
//
// A ordem das checagens é deliberada e é metade da segurança deste arquivo:
//
//   1. autentica o CLIENTE (quem está pedindo)
//   2. consome o CÓDIGO de forma atômica (marcar-se-usado no `where`)
//   3. só então confere o PKCE
//   4. só então emite
//
// Conferir o PKCE antes de consumir o código pareceria mais eficiente e seria pior: um
// atacante com o código e sem o verificador poderia tentar quantas vezes quisesse, porque o
// código continuaria vivo entre as tentativas. Consumindo primeiro, ele tem UMA tentativa —
// e ela queima o código para o dono legítimo também, que percebe.

import { audit } from "@/lib/audit";
import { credenciaisDoCliente, erroOAuth, jsonOAuth, lerCorpo, preflight, protegido } from "@/lib/oauth/http";
import { conferePkce, escoposDoRefresh } from "@/lib/oauth/rules";
import {
  acharCliente,
  acharPorRefresh,
  autenticaCliente,
  emitirTokens,
  limparCodigosVencidos,
  marcarUsoDoCliente,
  resgatarCodigo,
  revogarDoPar,
  rotacionar,
  type ParDeTokens,
} from "@/lib/oauth/store";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  return protegido("token", () => trocar(req));
}

async function trocar(req: Request) {
  const corpo = await lerCorpo(req);
  const { clientId, secret } = credenciaisDoCliente(req, corpo);

  const cliente = await acharCliente(clientId);
  // Cliente desconhecido e segredo errado dão a MESMA resposta (`invalid_client`, 401):
  // quem sonda não descobre quais client ids existem.
  if (!cliente) return erroOAuth("invalid_client", "cliente desconhecido ou credencial inválida");
  const falhaCliente = autenticaCliente(cliente, secret);
  if (falhaCliente) return erroOAuth(falhaCliente.erro, "cliente desconhecido ou credencial inválida");

  const grant = corpo.grant_type;
  if (grant === "authorization_code") return porCodigo(corpo, cliente);
  if (grant === "refresh_token") return porRefresh(corpo, cliente);
  return erroOAuth(
    "unsupported_grant_type",
    `grant_type não suportado: ${grant ?? "(ausente)"} (só authorization_code e refresh_token)`,
  );
}

type Cliente = NonNullable<Awaited<ReturnType<typeof acharCliente>>>;

async function porCodigo(corpo: Record<string, string>, cliente: Cliente): Promise<Response> {
  const codigo = corpo.code;
  const redirectUri = corpo.redirect_uri;
  if (!codigo) return erroOAuth("invalid_request", "code é obrigatório");
  if (!redirectUri) {
    // Sempre obrigatória aqui, mesmo que o `/authorize` a tenha inferido: é a segunda
    // conferência do endereço, e ela é o que impede o código de ser resgatado por quem o
    // interceptou num endereço diferente.
    return erroOAuth("invalid_request", "redirect_uri é obrigatória no resgate");
  }

  const r = await resgatarCodigo(codigo, cliente.clientId, redirectUri);
  if (!r.ok) {
    if (r.reusado && r.userId) {
      // Reuso é sinal de interceptação, não de bug do cliente. A RFC 6749 §4.1.2 manda
      // revogar o que foi emitido com aquele código; revogamos o par cliente↔pessoa
      // inteiro (ver `revogarDoPar`) e deixamos linha na trilha para alguém olhar.
      const derrubados = await revogarDoPar(cliente.clientId, r.userId);
      await audit({
        action: "DELETE",
        entityType: "ApiToken",
        entityId: cliente.clientId,
        entityLabel: cliente.name,
        summary: `código OAuth reusado — ${derrubados} credencial(is) de “${cliente.name}” revogada(s) por precaução`,
        userId: r.userId,
        meta: { canal: "oauth", motivo: "codigo_reusado", clientId: cliente.clientId, derrubados },
        context: { route: "/api/oauth/token" },
      });
    }
    return erroOAuth(r.falha.erro, r.falha.detalhe);
  }

  const pkce = conferePkce(corpo.code_verifier, r.dados.codeChallenge, r.dados.codeChallengeMethod);
  // O código já foi consumido acima — este erro custa ao atacante o código inteiro.
  if (!pkce.ok) return erroOAuth(pkce.erro, pkce.detalhe);

  const par = await emitirTokens({
    userId: r.dados.userId,
    clientId: cliente.clientId,
    clientName: cliente.name,
    scopes: r.dados.scopes,
  });

  await marcarUsoDoCliente(cliente.clientId);
  void limparCodigosVencidos();
  await auditarEmissao("CREATE", par, cliente, r.dados.userId, "authorization_code");
  return resposta(par, r.dados.resource);
}

async function porRefresh(corpo: Record<string, string>, cliente: Cliente): Promise<Response> {
  const refresh = corpo.refresh_token;
  if (!refresh) return erroOAuth("invalid_request", "refresh_token é obrigatório");

  const row = await acharPorRefresh(refresh);
  // Todas as recusas abaixo dão a mesma mensagem: um refresh que não serve não precisa
  // explicar por quê, e explicar diria a quem roubou se ele foi revogado ou só venceu.
  const generico = "refresh_token inválido, expirado ou revogado";
  if (!row) return erroOAuth("invalid_grant", generico);
  if (row.clientId !== cliente.clientId) return erroOAuth("invalid_grant", generico);
  if (row.revokedAt) return erroOAuth("invalid_grant", generico);
  if (!row.refreshExpiresAt || row.refreshExpiresAt.getTime() <= Date.now()) return erroOAuth("invalid_grant", generico);
  // Desligar a pessoa no CultPartners tem que derrubar o conector dela na próxima renovação —
  // senão um token OAuth sobreviveria ao desligamento por até uma hora.
  if (!row.user.active) return erroOAuth("invalid_grant", generico);

  const escopos = escoposDoRefresh(corpo.scope, row.scopes);
  if (!escopos.ok) return erroOAuth(escopos.erro, escopos.detalhe);

  const par = await rotacionar({
    anteriorId: row.id,
    // O refresh apresentado vai junto porque ele é a CONDIÇÃO da escrita: se outra renovação
    // simultânea já trocou o hash da linha, esta volta `null`. Antes, cada uma criava a sua
    // linha e as duas saíam com token vivo.
    refreshAnterior: refresh,
    clientName: cliente.name,
    scopes: escopos.escopos,
  });
  if (!par) return erroOAuth("invalid_grant", generico);

  await marcarUsoDoCliente(cliente.clientId);
  await auditarEmissao("UPDATE", par, cliente, row.userId, "refresh_token");
  return resposta(par, null);
}

async function auditarEmissao(
  action: "CREATE" | "UPDATE",
  par: ParDeTokens,
  cliente: Cliente,
  userId: string,
  grant: string,
) {
  await audit({
    action,
    entityType: "ApiToken",
    entityId: par.tokenId,
    entityLabel: cliente.name,
    summary:
      grant === "refresh_token"
        ? `renovou o acesso do conector “${cliente.name}”`
        : `emitiu credencial para o conector “${cliente.name}”`,
    // Ator é a PESSOA que consentiu, ainda que quem chamou tenha sido a máquina: é o nome
    // dela que aparece em toda leitura feita com este token.
    userId,
    meta: { canal: "oauth", grant, clientId: cliente.clientId, escopos: par.scopes },
    context: { route: "/api/oauth/token" },
  });
}

function resposta(par: ParDeTokens, resource: string | null): Response {
  return jsonOAuth({
    access_token: par.accessToken,
    token_type: "Bearer",
    expires_in: par.expiresInS,
    refresh_token: par.refreshToken,
    scope: par.scopes.join(" "),
    // Eco do recurso: o cliente confere que o token que recebeu vale para onde ele pediu.
    ...(resource ? { resource } : {}),
  });
}
