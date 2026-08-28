// Lockup da marca no login: escudo oficial (`LogoMark`, o mesmo SVG do resto do app)
// + nome + linha de categoria. Vive num arquivo próprio porque a moldura o posiciona e o
// formulário não deve saber nada de marca.

import { LogoMark } from "@/components/ui/Logo";

export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark className="h-14 w-auto sm:h-16" />
      <div className="leading-tight">
        <p className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">CultPartners</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-faint sm:text-[11px]">
          Portal de Parceiros
        </p>
      </div>
    </div>
  );
}
