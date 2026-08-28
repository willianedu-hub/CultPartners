import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Rede de segurança ESTRUTURAL das superfícies de MÁQUINA do CultPartners — versão leve do
// `forbidden.test.ts` do CRM.
//
// Por que um teste de texto e não de comportamento: os módulos importam `server-only`, que só
// existe dentro do empacotador do Next — em vitest não resolve nem como módulo. Então o
// contrato é verificado por varredura.
//
// O servidor MCP do CultPartners é SOMENTE LEITURA (não há camada OAuth de escrita no escopo
// varrido aqui). O que fica proibido em `src/lib/mcp/**` e `src/app/api/mcp/**`:
//   - verbo de escrita do Prisma (create/update/delete/upsert e variantes) — a v1 não escreve;
//   - SQL cru — foge do `where` tipado que carrega o escopo do servidor;
//   - `cookies()` / `next/headers` — o caminho de máquina se identifica pelo header, não por
//     sessão de navegador;
//   - o nome `senhaHash` em código — a credencial de Parceiro nunca sai deste servidor.
// E o contrato do catálogo: toda ferramenta declara `escreve: false`.

const raiz = (...p: string[]) => join(process.cwd(), ...p);

// Ordem importa: `updateManyAndReturn` vem antes de `updateMany`, senão o `\b` casa no `A` e o
// verbo passa batido — era um furo real da varredura do CRM.
const VERBOS_ESCRITA =
  /prisma\.\w+\.(createManyAndReturn|createMany|create|updateManyAndReturn|updateMany|update|upsert|deleteMany|delete|executeRaw|executeRawUnsafe)\b/;

type Regra = { padrao: RegExp; motivo: string };

const REGRAS: Regra[] = [
  { padrao: VERBOS_ESCRITA, motivo: "esta superfície é SOMENTE LEITURA — a v1 do MCP não escreve no banco" },
  { padrao: /\$executeRaw|\$queryRaw|\$queryRawUnsafe|\$executeRawUnsafe/, motivo: "SQL cru foge do escopo tipado e do `where` que carrega o alcance no servidor" },
  { padrao: /from\s+["']next\/headers["']|\bcookies\s*\(\s*\)/, motivo: "o caminho de máquina não lê cookie — a identidade é o header (token)" },
  { padrao: /\bsenhaHash\b/, motivo: "a credencial de Parceiro (senhaHash) nunca sai deste servidor" },
];

const RAIZES = [raiz("src", "lib", "mcp"), raiz("src", "app", "api", "mcp")];

function varrer(dir: string, out: string[] = []): string[] {
  let nomes: string[];
  try {
    nomes = readdirSync(dir);
  } catch {
    return out; // diretório ainda não existe
  }
  for (const nome of nomes) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p, out);
    // O próprio teste fica de fora: ele CITA os padrões proibidos, é o trabalho dele.
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(p);
  }
  return out;
}

const ARQUIVOS = RAIZES.flatMap((r) => varrer(r));

describe("superfície de máquina — MCP CultPartners", () => {
  it("a varredura acha os arquivos (senão o teste passa por não olhar nada)", () => {
    expect(ARQUIVOS.length, `nada varrido em ${RAIZES.join(", ")}`).toBeGreaterThan(5);
  });

  for (const { padrao, motivo } of REGRAS) {
    it(`nenhum arquivo casa /${padrao.source.slice(0, 44)}…/ — ${motivo}`, () => {
      const culpados: string[] = [];
      for (const f of ARQUIVOS) {
        readFileSync(f, "utf8")
          .split("\n")
          .forEach((linha, i) => {
            // Comentário não é código: o arquivo EXPLICA o que não faz, e deve poder citar.
            const semComentario = linha.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
            if (padrao.test(semComentario)) {
              culpados.push(`${f.slice(process.cwd().length + 1)}:${i + 1} → ${linha.trim().slice(0, 90)}`);
            }
          });
      }
      expect(culpados, `Proibido na superfície MCP (${motivo}):\n- ${culpados.join("\n- ")}`).toEqual([]);
    });
  }
});

// ── Contrato do catálogo de ferramentas ──────────────────────────────────────
describe("catálogo de ferramentas MCP", () => {
  it("toda ferramenta declara `escreve: false`", () => {
    let nomes = 0;
    let escreveFalse = 0;
    let escreveTrue = 0;
    for (const f of ARQUIVOS) {
      const src = readFileSync(f, "utf8");
      nomes += (src.match(/^\s{4}nome:\s*"cp_/gm) ?? []).length;
      escreveFalse += (src.match(/^\s{4}escreve:\s*false,/gm) ?? []).length;
      escreveTrue += (src.match(/^\s{4}escreve:\s*true/gm) ?? []).length;
    }
    expect(nomes, "nenhuma ferramenta encontrada — o padrão de varredura quebrou").toBeGreaterThan(5);
    expect(escreveTrue, "há ferramenta declarando escreve: true, e a v1 é somente leitura").toBe(0);
    expect(escreveFalse, "toda ferramenta precisa declarar escreve: false").toBe(nomes);
  });

  it("nenhum nome de ferramenta repetido (tools/list não pode ter ambiguidade)", () => {
    const vistos = new Map<string, string>();
    const repetidos: string[] = [];
    for (const f of ARQUIVOS) {
      for (const m of readFileSync(f, "utf8").matchAll(/^\s{4}nome:\s*"(cp_\w+)"/gm)) {
        const anterior = vistos.get(m[1]);
        if (anterior) repetidos.push(`${m[1]} (em ${anterior} e ${f})`);
        else vistos.set(m[1], f);
      }
    }
    expect(repetidos, `nomes repetidos:\n- ${repetidos.join("\n- ")}`).toEqual([]);
    expect(vistos.size).toBeGreaterThan(5);
  });
});
