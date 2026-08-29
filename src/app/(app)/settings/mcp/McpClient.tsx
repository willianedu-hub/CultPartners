"use client";

// Tela de credenciais de máquina do CultPartners.
//
// A peça que justifica esta tela ser cliente é o **segredo mostrado uma vez**: ele volta na
// resposta da server action e vive só no estado do componente. Guardamos apenas o SHA-256 —
// nem nós conseguimos mostrá-lo de novo depois.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Copy, Check, Trash2, Terminal, ShieldAlert, Plug } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, THead, TH, TBody, TRow, TD } from "@/components/ui/Table";
import type { McpResult } from "./actions";

export type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  escopos: string[];
  criadoEm: string;
  expiraEm: string;
  ultimoUso: string | null;
  revogadoEm: string | null;
  expirado: boolean;
  /** Nome do aplicativo OAuth que recebeu esta credencial. `null` = criada aqui, à mão. */
  origem: string | null;
};

type CriarAct = (nome: string, validadeDias: number) => Promise<McpResult>;
type RevogarAct = (id: string) => Promise<McpResult>;

const fld =
  "rounded-lg border border-border bg-surface2 px-3 py-1.5 text-sm text-text placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/30";
const lbl = "mb-1 block text-[10px] uppercase tracking-wide text-faint";
const btn =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface2 disabled:opacity-60 max-sm:min-h-11";
const btnPrim =
  "inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-[#f0339a] to-[#d81b80] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-95 disabled:opacity-60 max-sm:min-h-11";

function data(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Situação em uma palavra + o tom. Revogado e expirado são estados diferentes de propósito. */
function situacao(t: TokenRow): { texto: string; cor: string } {
  if (t.revogadoEm) return { texto: "Revogada", cor: "var(--tom-critico)" };
  if (t.expirado) return { texto: "Expirada", cor: "var(--tom-atencao)" };
  return { texto: "Ativa", cor: "var(--tom-bom)" };
}

export function McpClient({
  tokens,
  urlMcp,
  ocultas,
  souAdmin,
  actions,
}: {
  tokens: TokenRow[];
  /** Endereço do servidor MCP, sem credencial. É o que se cola no conector do claude.ai. */
  urlMcp: string;
  /** Quantas credenciais ficaram fora do teto da consulta. 0 = a lista está inteira. */
  ocultas: number;
  souAdmin: boolean;
  actions: { criarToken: CriarAct; revogarToken: RevogarAct };
}) {
  // Vivas x encerradas. "Expirada e não revogada" conta como viva: ela ainda é uma linha
  // sobre a qual há o que decidir — revogar, ou entender por que ninguém a renovou.
  const vivas = tokens.filter((t) => !t.revogadoEm);
  const encerradas = tokens.filter((t) => t.revogadoEm);

  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [dias, setDias] = useState("90");
  const [novo, setNovo] = useState<{ secret: string; comando: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(texto: string, qual: string, rotulo: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      window.setTimeout(() => setCopiado(null), 2000);
      toast.success(`${rotulo} copiado.`);
    } catch {
      // Área de transferência bloqueada (http sem TLS, permissão negada): o texto está
      // selecionável na tela, então não vale interromper — só avisar.
      toast.error("Não foi possível copiar — selecione o texto e copie à mão.");
    }
  }

  function criar() {
    start(async () => {
      const r = await actions.criarToken(nome, Number(dias));
      if (!r.ok) {
        toast.error(r.error ?? "Não foi possível criar a credencial.");
        return;
      }
      if (r.secret && r.comando) {
        setNovo({ secret: r.secret, comando: r.comando });
        toast.success(r.message ?? "Credencial criada.");
      }
    });
  }

  function revogar(id: string) {
    start(async () => {
      const r = await actions.revogarToken(id);
      if (!r.ok) {
        toast.error(r.error ?? "Não foi possível revogar.");
        return;
      }
      toast.success(r.message ?? "Credencial revogada.");
    });
  }

  // Fecha o diálogo e zera o formulário/segredo. O segredo é descartado do estado aqui — é a
  // última vez que ele existe em qualquer lugar.
  function fechar() {
    setAberto(false);
    setNovo(null);
    setNome("");
    setDias("90");
  }

  function tabela(lista: TokenRow[]) {
    return (
      <Table>
        <THead>
          <TH>Nome</TH>
          <TH>Prefixo</TH>
          <TH>Situação</TH>
          <TH>Último uso</TH>
          <TH>Expira</TH>
          <TH right> </TH>
        </THead>
        <TBody>
          {lista.map((t) => {
            const s = situacao(t);
            return (
              <TRow key={t.id}>
                <TD strong>
                  {t.name}
                  {/* Distinção que muda o que "revogar" significa: um token OAuth a pessoa
                      não criou, ela consentiu — e quem o guarda é o aplicativo. */}
                  {t.origem && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-px align-middle text-[10px] font-normal text-faint"
                      title={`Emitida pelo fluxo OAuth para “${t.origem}”. Quem guarda o segredo é o aplicativo.`}
                    >
                      <Plug className="h-2.5 w-2.5" aria-hidden /> aplicativo
                    </span>
                  )}
                </TD>
                <TD>
                  <span className="font-mono text-xs text-muted">cp_{t.prefix}…</span>
                </TD>
                <TD>
                  <span className="text-xs font-semibold" style={{ color: s.cor }}>
                    {s.texto}
                  </span>
                </TD>
                {/* "Nunca usada" é informação, não ausência: é como se percebe uma credencial
                    criada e esquecida. */}
                <TD>
                  <span className="text-xs">{t.ultimoUso ? data(t.ultimoUso) : "Nunca usada"}</span>
                </TD>
                <TD>
                  <span className="text-xs">{data(t.expiraEm)}</span>
                </TD>
                <TD right>
                  {!t.revogadoEm && (
                    <button
                      type="button"
                      onClick={() => revogar(t.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs transition-colors hover:bg-surface2 disabled:opacity-60 max-sm:min-h-11"
                      style={{ color: "var(--tom-critico)" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Revogar
                    </button>
                  )}
                </TD>
              </TRow>
            );
          })}
        </TBody>
      </Table>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Acesso de outros chats (MCP)</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Cria uma credencial para que outro chat do Claude (ou o Cowork) <strong>leia</strong> o
        CultPartners. A credencial herda <em>o seu</em> acesso: o chat vê exatamente o que você vê
        nas suas telas, nada mais. <strong>Nenhuma ferramenta altera dado</strong> — esta versão é
        só leitura.
      </p>

      {/* ── o conector do claude.ai (OAuth) ───────────────────────────────
          Primeiro e sem credencial nenhuma. Vem antes da criação de token de propósito: para
          o claude.ai da organização, este endereço é a resposta inteira, e o token colado à
          mão é o caminho de quem usa Claude Code ou Desktop. */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          <Plug className="h-4 w-4 text-faint" aria-hidden /> Conector do claude.ai (OAuth)
        </h2>
        <p className="mt-1.5 max-w-3xl text-xs text-muted">
          Para adicionar o CultPartners como conector personalizado no claude.ai da organização,
          cole <strong className="text-text">apenas este endereço</strong>. Cada pessoa entra com a
          própria conta e autoriza uma vez — não existe credencial compartilhada, e o conector{" "}
          <strong className="text-text">não usa cabeçalho</strong>.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            data-campo="url-mcp"
            readOnly
            value={urlMcp}
            onFocus={(e) => e.currentTarget.select()}
            className={`${fld} min-w-0 flex-1 font-mono text-xs`}
          />
          <button
            type="button"
            onClick={() => copiar(urlMcp, "mcp", "Endereço")}
            className={btn}
            aria-label="Copiar endereço do conector"
          >
            {copiado === "mcp" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <p className="mt-2 max-w-3xl text-[11px] text-faint">
          <strong className="text-text">Não preencha client id nem secret.</strong> O CultPartners é
          o próprio servidor de autorização: o claude.ai descobre tudo sozinho pelos documentos em{" "}
          <code className="font-mono">/.well-known/</code>, e o login que aparece para cada pessoa é
          o do CultPartners.
        </p>
      </section>

      {souAdmin && (
        /* Decisão explícita: emitir token para conta de admin é PERMITIDO. A tela não bloqueia —
           avisa em letras claras, porque quem decide é quem assume. */
        <div
          className="mt-4 flex max-w-3xl items-start gap-2.5 rounded-xl border p-3 text-xs"
          style={{
            borderColor: "color-mix(in srgb, var(--tom-atencao) 40%, transparent)",
            background: "color-mix(in srgb, var(--tom-atencao) 8%, transparent)",
          }}
        >
          <ShieldAlert className="mt-px h-4 w-4 shrink-0" style={{ color: "var(--tom-atencao)" }} aria-hidden />
          <p className="text-muted">
            Sua conta tem <strong className="text-text">acesso total (admin)</strong>. Uma credencial
            criada aqui vai enxergar <strong className="text-text">o portal inteiro</strong> — todos
            os parceiros e todas as oportunidades. Se o objetivo é um chat de trabalho do dia a dia,
            considere criar a credencial numa conta com o acesso do papel de canal, não nesta.
          </p>
        </div>
      )}

      {/* ── criar (diálogo) ─────────────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
              <KeyRound className="h-4 w-4 text-faint" aria-hidden /> Nova credencial
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] text-faint">
              O segredo aparece <strong>uma única vez</strong>. Guardamos apenas um resumo
              criptográfico (SHA-256) dele — nem nós conseguimos mostrá-lo de novo depois.
            </p>
          </div>

          <Dialog
            open={aberto}
            onOpenChange={(o) => {
              if (!o) fechar();
              else setAberto(true);
            }}
          >
            <DialogTrigger asChild>
              <button type="button" className={btnPrim}>
                <KeyRound className="h-3.5 w-3.5" aria-hidden /> Criar credencial
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <div className="flex flex-col gap-4 p-5 pt-4">
                <div>
                  <DialogTitle>{novo ? "Copie agora — esta é a única vez" : "Nova credencial"}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {novo
                      ? "O segredo não aparece de novo. Guarde-o ou cole o comando pronto."
                      : "Uma credencial de leitura, com o seu acesso, para outro chat do Claude."}
                  </DialogDescription>
                </div>

                {!novo ? (
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      criar();
                    }}
                  >
                    <div>
                      <label className={lbl} htmlFor="mcp-name">
                        Onde vai ser usada
                      </label>
                      <input
                        id="mcp-name"
                        required
                        maxLength={80}
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Claude Code do notebook"
                        className={`${fld} w-full`}
                      />
                    </div>
                    <div>
                      <label className={lbl} htmlFor="mcp-dias">
                        Validade
                      </label>
                      <select
                        id="mcp-dias"
                        value={dias}
                        onChange={(e) => setDias(e.target.value)}
                        className={`${fld} w-full`}
                      >
                        <option value="30">30 dias</option>
                        <option value="90">90 dias</option>
                        <option value="180">180 dias</option>
                        <option value="365">1 ano</option>
                      </select>
                    </div>
                    <div className="mt-1 flex justify-end gap-2">
                      <button type="button" onClick={fechar} className={btn}>
                        Cancelar
                      </button>
                      <button type="submit" disabled={pending || !nome.trim()} className={btnPrim}>
                        {pending ? "Criando…" : "Criar credencial"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className={lbl}>Credencial</label>
                      <div className="flex items-center gap-2">
                        {/* `readOnly` num input, e não um <code>: num campo, um toque
                            seleciona tudo — no celular selecionar texto longo é sofrível. */}
                        <input
                          data-campo="segredo"
                          readOnly
                          value={novo.secret}
                          onFocus={(e) => e.currentTarget.select()}
                          className={`${fld} min-w-0 flex-1 font-mono text-xs`}
                        />
                        <button
                          type="button"
                          onClick={() => copiar(novo.secret, "secret", "Credencial")}
                          className={btn}
                          aria-label="Copiar credencial"
                        >
                          {copiado === "secret" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`${lbl} inline-flex items-center gap-1`}>
                        <Terminal className="h-3 w-3" aria-hidden /> Comando pronto (Claude Code)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          data-campo="comando"
                          readOnly
                          value={novo.comando}
                          onFocus={(e) => e.currentTarget.select()}
                          className={`${fld} min-w-0 flex-1 font-mono text-xs`}
                        />
                        <button
                          type="button"
                          onClick={() => copiar(novo.comando, "cmd", "Comando")}
                          className={btn}
                          aria-label="Copiar comando"
                        >
                          {copiado === "cmd" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-faint">
                        Cole no terminal onde o Claude Code roda. Para o Cowork, use o mesmo endereço
                        e o mesmo cabeçalho de autorização. No claude.ai, use o conector OAuth acima —
                        lá não vai cabeçalho nenhum.
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button type="button" onClick={fechar} className={btnPrim}>
                        <Check className="h-3.5 w-3.5" aria-hidden /> Guardei o segredo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* ── lista ────────────────────────────────────────────────────────── */}
      <h2 className="mt-8 text-sm font-semibold text-text">Suas credenciais</h2>
      <p className="mt-1 max-w-3xl text-xs text-muted">
        Credencial com o selo <strong className="text-text">aplicativo</strong> ninguém digitou
        aqui: ela nasceu quando você autorizou o conector na tela de consentimento, e{" "}
        <strong className="text-text">se renova sozinha</strong> enquanto a autorização durar — por
        isso a data de expiração é sempre próxima. Revogá-la faz o aplicativo pedir autorização de
        novo.
      </p>

      <div className="mt-3">
        {vivas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-faint">
            {encerradas.length > 0 ? "Nenhuma credencial em uso." : "Nenhuma credencial criada ainda."}
          </p>
        ) : (
          tabela(vivas)
        )}
      </div>

      {/* Encerradas ficam FECHADAS por padrão. Não é esconder: a pergunta desta tela é "o que
          está aberto agora?", e uma lista onde o morto se mistura ao vivo não responde. Para
          conferência histórica existe a trilha de auditoria. */}
      {encerradas.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted hover:text-text">
            Encerradas ({encerradas.length})
          </summary>
          <p className="mt-1 max-w-3xl text-xs text-faint">
            Revogadas. As de aplicativo somem daqui sozinhas depois de um tempo — o registro que
            permanece é o da trilha de auditoria.
          </p>
          <div className="mt-2">{tabela(encerradas)}</div>
        </details>
      )}

      {ocultas > 0 && (
        <p className="mt-2 text-xs text-faint">
          Mostrando as mais recentes; {ocultas} credencial(is) mais antiga(s) não cabe(m) nesta lista.
        </p>
      )}

      <p className="mt-6 max-w-3xl text-xs text-faint">
        Revogar tem efeito na chamada seguinte. Encerrar as suas sessões também derruba as suas
        credenciais — as duas coisas são o mesmo botão de emergência.
      </p>
    </>
  );
}
