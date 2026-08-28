// O camaleão glitch da CultSec, âncora visual da tela de login.
//
// Duas decisões que evitam armadilha:
// • O `<Image fill>` mora num wrapper interno com `relative h-full w-full`, e NÃO no
//   elemento externo: o externo recebe o `className` de quem chama, que é `absolute`, e
//   `relative`+`absolute` na mesma classe brigam por ordem de folha de estilo.
// • `object-left-bottom`: o camaleão é retrato (826×1351) dentro de uma caixa mais larga;
//   ancorado embaixo à esquerda ele encosta na borda da tela em vez de flutuar centralizado.
//
// Sem `MASCOTE_SRC` (estado previsto em `brandAssets.ts`) cai no escudo em marca-d'água,
// para a composição não ficar com um vazio à espera de imagem.

import Image from "next/image";
import { LogoMark } from "@/components/ui/Logo";
import { MASCOTE_SRC } from "./brandAssets";

export function Mascote({ className = "" }: { className?: string }) {
  if (!MASCOTE_SRC) {
    return (
      <div aria-hidden className={`grid place-items-end opacity-[0.13] ${className}`}>
        <LogoMark className="h-full w-full" />
      </div>
    );
  }
  return (
    <div aria-hidden className={className}>
      <div className="relative h-full w-full">
        <Image
          src={MASCOTE_SRC}
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 25vw, 40vw"
          className="object-contain object-left-bottom"
        />
      </div>
    </div>
  );
}
