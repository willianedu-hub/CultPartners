import "server-only";

// Registro das ferramentas. Um arquivo por área, um array só no fim — o mesmo formato do CRM:
// acrescentar ferramenta é escrever a função e citá-la aqui, sem tocar no despacho nem no
// protocolo.

import type { Ferramenta } from "../catalog";
import { FERRAMENTAS_IDENTIDADE } from "./identidade";
import { FERRAMENTAS_COMERCIAL } from "./comercial";
import { FERRAMENTAS_CATALOGOS } from "./catalogos";
import { FERRAMENTAS_TAREFAS } from "./tarefas";
import { FERRAMENTAS_RELATORIOS } from "./relatorios";

export const FERRAMENTAS: Ferramenta[] = [
  ...FERRAMENTAS_IDENTIDADE,
  ...FERRAMENTAS_COMERCIAL,
  ...FERRAMENTAS_CATALOGOS,
  ...FERRAMENTAS_TAREFAS,
  ...FERRAMENTAS_RELATORIOS,
];

// O handler (`../handler.ts`) importa `tools`. Mantemos os dois nomes: `FERRAMENTAS` para
// espelhar o CRM e `tools` para o contrato que o despacho já espera.
export const tools = FERRAMENTAS;
