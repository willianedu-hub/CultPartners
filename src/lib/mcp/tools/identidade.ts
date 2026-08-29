import "server-only";

// `cp_whoami` — a primeira ferramenta que o chat deve chamar.
//
// Sem ela o modelo não sabe o próprio alcance e comete o erro clássico: lê uma lista curta
// como "a operação é pequena" em vez de "eu só vejo a minha parte". Dizer o alcance de saída
// é o que transforma um número certo numa RESPOSTA certa. Aqui o alcance é a lista de
// parceiros que a credencial enxerga (ou "todos", para admin).

import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { parceiroScopeIds } from "../dados";
import type { Contexto, Ferramenta } from "../catalog";

const entrada = z.object({});

export const FERRAMENTAS_IDENTIDADE: Ferramenta[] = [
  {
    nome: "cp_whoami",
    titulo: "Quem sou e o que alcanço",
    descricao:
      "Diz em nome de quem você fala com o CultPartners, qual o papel dessa pessoa (admin ou " +
      "executivo de canal) e QUAIS parceiros ela alcança, com os ids para usar nos filtros das " +
      "outras ferramentas. CHAME PRIMEIRO. Sem isso você não sabe se uma lista curta significa " +
      "'o canal é pequeno' ou 'eu só vejo os meus parceiros' — e um resultado vazio pode ser " +
      "'não existe' ou 'está fora do seu alcance'.",
    entrada,
    exige: () => true, // qualquer token válido pode saber o próprio alcance
    escreve: false,
    run: async (_args: z.infer<typeof entrada>, { user }: Contexto) => {
      const admin = isAdmin(user);
      const ids = parceiroScopeIds(user);

      // Para o alcance ser útil ao modelo, os parceiros vêm com NOME, não só id — mas sem
      // `senhaHash` (nunca sai deste servidor). Admin não lista: seria a base inteira.
      let parceiros: { id: number; nome: string }[] | "todos" = "todos";
      if (ids !== null) {
        const rows = ids.length
          ? await prisma.parceiro.findMany({
              where: { id: { in: ids.map((n) => BigInt(n)) } },
              select: { id: true, nome: true },
              orderBy: { nome: "asc" },
            })
          : [];
        parceiros = rows.map((p) => ({ id: Number(p.id), nome: p.nome }));
      }

      return {
        pessoa: { id: user.id, nome: user.name ?? null, email: user.email ?? null },
        audiencia: user.audience,
        papeis: user.roles,
        alcancaTodoOCanal: admin,
        escopo: parceiros,
        avisos: [
          "Este servidor é somente leitura: nenhuma ferramenta altera dado no portal.",
          admin
            ? "Você alcança TODOS os parceiros. Diga isso ao relatar números — quem lê precisa saber o escopo."
            : "Seu alcance é parcial. Números que você relatar valem só para os parceiros listados em `escopo`.",
        ],
        avisoDeEscopo: admin
          ? null
          : "IMPORTANTE: toda listagem e todo número deste servidor já vêm recortados pelos seus " +
            "parceiros. Nunca conclua que uma oportunidade, parceiro ou tarefa 'não existe' a partir " +
            "de um resultado vazio — pode existir com outro executivo de canal, fora do seu alcance.",
      };
    },
  },
];
