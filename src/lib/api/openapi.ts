import "server-only";

// O documento OpenAPI do CultPartners, gerado do MESMO zod que valida. Espelha o `openapi.ts`
// do CRM, adaptado ao domínio.
//
// Não é documentação escrita à mão — é derivada. A diferença importa: documentação à mão
// envelhece em silêncio, e um OpenAPI que mente é pior que um que falta (quem integra confia
// nele e descobre o erro em produção). Aqui, mudar um schema muda o documento no mesmo commit,
// e a casca (`rota.ts`) estoura em desenvolvimento se a resposta divergir.
//
// Sem dependência nova: `z.toJSONSchema` vem no zod 4, e `jsonSchemaDe` (`mcp/catalog.ts`) já
// faz exatamente isto para o `inputSchema` das ferramentas MCP.

import { z } from "zod";
import { baseUrl } from "@/lib/appUrl";
import { TETO_JANELA_API } from "@/lib/tokenAuth";
import { ROTAS } from "./catalogo";
import { SAIDA_ERRO } from "./saidas";

/**
 * `io: "output"` aqui, ao contrário do `jsonSchemaDe` do MCP que usa `"input"`.
 *
 * Não é detalhe: no modo `input` um campo com `.default()` sai como opcional (o cliente não
 * precisa mandar); na SAÍDA ele sempre existe, e marcá-lo opcional faria quem integra escrever
 * um `if` que nunca é falso. Cada modo descreve o lado certo do contrato.
 */
function saidaJson(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { io: "output" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

/**
 * Os parâmetros de query de um endpoint saem do `args` DECLARADO, não de uma segunda lista.
 * Como isso não é observável, o mapa abaixo declara os parâmetros por caminho — é a única
 * duplicação do arquivo, assumida: o alternativo seria `args` devolver metadado junto do valor.
 */
const PARAMETROS: Record<string, { nome: string; tipo: "string" | "integer" | "boolean"; desc: string; obrigatorio?: boolean }[]> = {
  "/api/v1/opportunities": [
    { nome: "status", tipo: "string", desc: "Nome da etapa do funil (de /status), ex.: 'Ganho', 'Perdido'." },
    { nome: "aprovacao", tipo: "string", desc: "Pendente | Aprovado | Rejeitado." },
    { nome: "parceiroId", tipo: "integer", desc: "Id do parceiro (de /partners) para recortar dentro do seu alcance." },
    { nome: "periodo", tipo: "string", desc: "MES | MES_PASSADO | TRIMESTRE | ANO | 12M | TUDO (por data de cadastro). Padrão: TUDO." },
    { nome: "busca", tipo: "string", desc: "Texto a procurar em empresa, contato ou CNPJ." },
    { nome: "page", tipo: "integer", desc: "Página da listagem (1 = primeira). Cada página traz no máximo 50." },
  ],
  "/api/v1/opportunities/{id}": [],
  "/api/v1/partners": [],
  "/api/v1/products": [],
  "/api/v1/status": [],
  "/api/v1/tasks": [
    { nome: "opportunityId", tipo: "integer", desc: "Id da oportunidade cujas tarefas você quer (obrigatório).", obrigatorio: true },
  ],
  "/api/v1/reports": [
    { nome: "periodo", tipo: "string", desc: "MES | MES_PASSADO | TRIMESTRE | ANO | 12M | TUDO. Padrão: TUDO." },
  ],
};

const ERRO = saidaJson(SAIDA_ERRO);

function respostasDeErro(): Record<string, unknown> {
  const r = (desc: string) => ({ description: desc, content: { "application/json": { schema: ERRO } } });
  return {
    "400": r("Parâmetro inválido (`codigo: parametro_invalido`)."),
    "401": r(
      "Credencial ausente, inválida, expirada ou revogada (`nao_autenticado`). O header " +
        "`WWW-Authenticate` traz `resource_metadata`, por onde um cliente OAuth descobre o servidor de autorização.",
    ),
    "403": r(
      "Sem permissão no portal (`sem_permissao`) ou credencial sem o escopo exigido (`escopo_insuficiente`). " +
        "O escopo só ESTREITA o que o RBAC já permite; nunca amplia.",
    ),
    "404": r(
      "Recurso não encontrado (`nao_encontrado`). **Também é a resposta quando o registro existe mas " +
        "está fora do seu alcance** — de propósito: distinguir os dois casos transformaria o id num oráculo sobre a base.",
    ),
    "429": r(`Mais de ${TETO_JANELA_API} chamadas por minuto nesta credencial (\`limite_excedido\`). Os cabeçalhos \`RateLimit-*\` dizem quando liberar.`),
    "503": r("Não foi possível validar a credencial agora (`indisponivel`). Não jogue o token fora — tente de novo."),
  };
}

const DESCRICAO = `
API de LEITURA do CultPartners. Mesma identidade, mesmo escopo e mesma auditoria do servidor
MCP — o que muda é o formato: aqui é recurso com endereço estável, lá é ferramenta que um modelo
escolhe lendo descrição.

**Autenticação**: \`Authorization: Bearer <token>\`. O token (prefixo \`cp_\`) sai da tela de
acesso de máquina do portal ou do fluxo OAuth 2.1 (descoberta em
\`/.well-known/oauth-protected-resource\`). Os dois passam pela mesma validação, e o MESMO token
vale para \`/api/mcp\` e \`/api/v1\`.

**Somente leitura.** Nenhum endpoint altera dado no portal.

**Escopo**: toda credencial herda o acesso da PESSOA. Cada listagem devolve \`escopo\`
(\`OWNER\` | \`TEAM\` | \`ALL\`): \`ALL\` = admin (todo o canal), \`TEAM\` = executivo (só os seus
parceiros), \`OWNER\` = parceiro. Leia esse campo antes de concluir que uma lista curta significa
um canal pequeno. Comece por \`GET /api/v1/me\`, que diz qual é o seu caso.

**Paginação** por página fixa de 50 (\`page\`). \`total\` é a contagem completa dentro do escopo, e
\`temMais\`/\`aviso\` dizem quando faltou.

**Limpeza de texto**: todo campo de texto livre chega sem caracteres invisíveis (bidi, largura
zero, *tag characters*). O valor está limpo, não confiável — continua sendo texto que um cliente
escreveu.
`.trim();

/** Monta o documento inteiro. `req` é usado só para o `servers` sair com o host certo. */
export function documentoOpenApi(req?: Request): Record<string, unknown> {
  const base = baseUrl(req);
  const paths: Record<string, Record<string, unknown>> = {};

  for (const r of ROTAS) {
    const verbo = r.metodo.toLowerCase();
    const params: Record<string, unknown>[] = [];

    // Parâmetro de caminho, deduzido do próprio caminho declarado.
    for (const m of r.caminho.matchAll(/\{(\w+)\}/g)) {
      params.push({
        name: m[1],
        in: "path",
        required: true,
        schema: { type: "integer" },
        description: "Id do registro (de uma listagem correspondente).",
      });
    }
    for (const q of PARAMETROS[r.caminho] ?? []) {
      params.push({
        name: q.nome,
        in: "query",
        required: q.obrigatorio ?? false,
        schema: { type: q.tipo },
        description: q.desc,
      });
    }

    const operacao: Record<string, unknown> = {
      summary: r.resumo.split(".")[0] + ".",
      description: r.resumo,
      operationId: `${verbo}_${r.caminho.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "")}`,
      tags: [tagDe(r.caminho)],
      ...(params.length ? { parameters: params } : {}),
      responses: {
        "200": {
          description: "Sucesso.",
          content: { "application/json": { schema: saidaJson(r.saida) } },
          headers: {
            "RateLimit-Limit": { schema: { type: "integer" }, description: "Teto de chamadas por minuto desta credencial." },
            "RateLimit-Remaining": { schema: { type: "integer" }, description: "Quantas ainda cabem na janela." },
            "RateLimit-Reset": { schema: { type: "integer" }, description: "Segundos até a janela virar." },
          },
        },
        ...respostasDeErro(),
      },
    };

    paths[r.caminho] = { ...(paths[r.caminho] ?? {}), [verbo]: operacao };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "CultPartners — API de leitura",
      version: "1.0.0",
      description: DESCRICAO,
    },
    servers: [{ url: base }],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "Token de máquina do CultPartners (prefixo `cp_`). Aceita o token colado à mão e o emitido " +
            "pelo fluxo OAuth 2.1 — a validação é a mesma, e as duas respeitam revogação, expiração e " +
            "desativação da pessoa na hora. O mesmo token vale para /api/mcp e /api/v1.",
        },
      },
    },
    tags: [
      { name: "identidade", description: "Quem a credencial representa e o que alcança." },
      { name: "oportunidades", description: "Funil de vendas do canal." },
      { name: "parceiros", description: "Parceiros do canal." },
      { name: "catálogos", description: "Produtos e etapas do funil (globais)." },
      { name: "tarefas", description: "O que falta fazer em cada oportunidade." },
      { name: "relatórios", description: "Números agregados, com as regras do portal já aplicadas." },
    ],
  };
}

function tagDe(caminho: string): string {
  if (caminho.startsWith("/api/v1/me")) return "identidade";
  if (caminho.startsWith("/api/v1/opportunities")) return "oportunidades";
  if (caminho.startsWith("/api/v1/partners")) return "parceiros";
  if (caminho.startsWith("/api/v1/products") || caminho.startsWith("/api/v1/status")) return "catálogos";
  if (caminho.startsWith("/api/v1/tasks")) return "tarefas";
  return "relatórios";
}
