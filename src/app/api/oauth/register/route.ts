// RFC 7591 — registro dinâmico de cliente.
//
// **Este endpoint é aberto por necessidade, não por escolha.** O Claude descobre o servidor
// pelos `.well-known` e se registra sozinho; não há passo humano onde colar um client id.
// Fechá-lo seria não ter conector.
//
// O que ele NÃO dá para quem se registra: nada. Um cliente registrado só ganha o direito de
// pedir a UMA pessoa que ela consinta, na tela de consentimento, logada no CultPartners.
// Registro não é acesso — acesso é o que a pessoa concede depois. Por isso o abuso possível
// aqui é de VOLUME (encher a tabela), e é contra isso que os limites abaixo são calibrados.

import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rateLimit";
import { erroOAuth, jsonOAuth, lerJson, preflight, protegido } from "@/lib/oauth/http";
import { validarRegistro } from "@/lib/oauth/pedido";
import { registrarCliente, registrosRecentes } from "@/lib/oauth/store";

export const dynamic = "force-dynamic";

/** Teto global por hora. Vive no BANCO (contagem de linhas) porque vale entre instâncias. */
const TETO_POR_HORA = 30;
/**
 * Dois tetos por origem, em memória (best-effort — cada instância tem o seu).
 *
 * A separação importa: o que custa caro é o REGISTRO, que deixa linha na tabela. Um pedido
 * malformado custa um parse de JSON. Medir os dois no mesmo balde faria um cliente que erra
 * o formato e tenta de novo gastar a cota de registro que ele ainda nem usou — e ficar
 * trancado para fora sem nunca ter registrado nada.
 */
const TETO_REGISTROS_POR_IP = 10;
const TETO_TENTATIVAS_POR_IP = 60;
const JANELA_IP_MS = 10 * 60 * 1000;

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  return protegido("register", () => registrar(req));
}

async function registrar(req: Request) {
  // Interruptor de emergência: se o DCR virar problema, a TI cadastra o cliente à mão e
  // liga isto. O resto do fluxo continua funcionando.
  if (process.env.OAUTH_DCR_DISABLED === "1") {
    return erroOAuth("temporarily_unavailable", "Registro dinâmico desabilitado neste servidor.", 403);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (!rateLimit(`oauth:register:tentativa:${ip}`, TETO_TENTATIVAS_POR_IP, JANELA_IP_MS)) {
    return erroOAuth("temporarily_unavailable", "Muitas tentativas a partir desta origem. Tente mais tarde.", 429, {
      "retry-after": "600",
    });
  }
  if ((await registrosRecentes(new Date(Date.now() - 3_600_000))) >= TETO_POR_HORA) {
    return erroOAuth("temporarily_unavailable", "Limite de registros por hora atingido neste servidor.", 429, {
      "retry-after": "600",
    });
  }

  const corpo = await lerJson(req);

  // Validação de FORMA (pura, sem banco): retornos, grants, response_types, método de auth,
  // nome e escopos. Erro de metadado tem código PRÓPRIO na RFC 7591.
  const v = validarRegistro(corpo);
  if (!v.ok) return jsonOAuth({ error: v.error, error_description: v.error_description }, 400);
  const { name, redirectUris, scopes, publico, metodo } = v.dados;

  // O teto de REGISTROS só é consumido aqui, depois de o pedido ser válido — ver o
  // comentário das constantes.
  if (!rateLimit(`oauth:register:ok:${ip}`, TETO_REGISTROS_POR_IP, JANELA_IP_MS)) {
    return erroOAuth("temporarily_unavailable", "Muitos registros a partir desta origem. Tente mais tarde.", 429, {
      "retry-after": "600",
    });
  }

  const criado = await registrarCliente({ name, redirectUris, scopes, publico });

  // Registro é evento de segurança: é a linha que responde "de onde veio este conector?".
  // Registro reaproveitado também vira evento — é ele que responde "por que a tela só tem uma
  // linha se o cliente tentou cinco vezes?". O `action` distingue: quem cria linha nova é
  // CREATE; quem recebeu de volta um registro que já existia é VIEW, porque nada nasceu.
  await audit({
    action: criado.reaproveitado ? "VIEW" : "CREATE",
    entityType: "OAuthClient",
    entityId: criado.clientId,
    entityLabel: name,
    summary: criado.reaproveitado
      ? `cliente OAuth "${name}" reapresentou-se e recebeu o registro que já existia`
      : `cliente OAuth "${name}" registrou-se dinamicamente`,
    // Ator nulo de propósito: ninguém está logado neste endpoint. É a máquina se
    // apresentando, e a trilha precisa mostrar isso como evento de sistema.
    meta: {
      canal: "oauth",
      origem: "dcr",
      clientId: criado.clientId,
      publico,
      redirectUris,
      escopos: scopes,
      ip,
      reaproveitado: criado.reaproveitado,
    },
    context: { route: "/api/oauth/register" },
  });

  return jsonOAuth(
    {
      client_id: criado.clientId,
      ...(criado.secret ? { client_secret: criado.secret } : {}),
      client_id_issued_at: Math.floor(criado.criadoEm.getTime() / 1000),
      // 0 = não expira. Se um dia expirar, o cliente precisa saber para reregistrar.
      ...(criado.secret ? { client_secret_expires_at: 0 } : {}),
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: metodo,
      scope: scopes.join(" "),
    },
    201,
  );
}
