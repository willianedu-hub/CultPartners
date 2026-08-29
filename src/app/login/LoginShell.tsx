// Moldura da tela de login — "assimétrica, com o camaleão como âncora".
//
// Sem painel e sem cartão: a tela escura é a página. Marca grande no topo à esquerda,
// mascote ancorado no canto inferior esquerdo sangrando pela borda de baixo, formulário
// flutuando à direita direto sobre a arte (só borda de campo).
//
// O formulário (`LoginForm`) segue separado da moldura: quem mexer na composição não
// precisa tocar na lógica de sessão expirada, prefill e as duas audiências (parceiro/equipe).
//
// No celular a âncora não pode roubar altura do formulário: o mascote encolhe e vai para
// o canto, ao lado do rodapé.

import type { ReactNode } from "react";
import { LoginCanvas } from "./LoginCanvas";
import { BrandLockup } from "./BrandLockup";
import { Mascote } from "./Mascote";

export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main data-login className="relative isolate min-h-screen overflow-hidden bg-bg max-md:min-h-dvh">
      {/* Cobre o overscroll: o <body> segue no tema do usuário, que pode ser claro. */}
      <div aria-hidden className="fixed inset-0 -z-20 bg-bg" />
      <LoginCanvas />

      {/* Véu atrás da coluna do formulário: o canto inferior direito da foto é magenta
          claro, exatamente onde o texto do formulário cai. Escurece só ali — véu na tela
          inteira mataria a textura que dá caráter à arte. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[54%] bg-gradient-to-l from-black/70 via-black/40 to-transparent max-lg:hidden"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-black/40 lg:hidden" />

      {/* A trava de altura é o que mantém o casco do camaleão longe da frase de
          posicionamento: 15rem é a altura reservada para marca + frase (que termina em
          ~205px), então sobra folga em qualquer altura de tela — inclusive nas baixas,
          onde 82% já passava por cima do texto. */}
      <Mascote className="pointer-events-none absolute bottom-0 left-0 h-[82%] max-h-[calc(100vh-15rem)] w-[34%] max-lg:hidden" />
      {/* No celular ele é pequeno e mora ao lado do rodapé (que recua com `pl-20`) — em
          cima do texto ficava ilegível, e a 7% de opacidade virava sujeira. */}
      <Mascote className="pointer-events-none absolute bottom-0 left-1 h-24 w-16 lg:hidden" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 max-md:min-h-dvh sm:px-10 lg:px-14 lg:py-12">
        <BrandLockup />

        {/* Frase logo abaixo da marca (não centralizada) para não cair sobre a âncora
            visual do canto inferior esquerdo. */}
        <p className="mt-7 max-w-sm text-[26px] font-semibold leading-tight text-text max-lg:hidden">
          Segurança da informação como cultura.
        </p>

        <div className="flex flex-1 items-center justify-center py-10 lg:justify-end">
          <div className="reveal w-full max-w-sm lg:mr-[4%]">
            <p className="mb-5 text-[11px] uppercase tracking-[0.22em] text-faint max-lg:hidden">
              Acesso restrito
            </p>
            {children}
          </div>
        </div>

        <p className="text-[11px] text-faint max-lg:pl-20 max-lg:text-left lg:text-right">
          CultSec · Segurança da Informação como Cultura
        </p>
      </div>
    </main>
  );
}
