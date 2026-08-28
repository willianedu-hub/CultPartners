// Tela escura de marca do login.
//
// Com `FUNDO_SRC` (o caso normal hoje) a base é a foto do banner do site — uma colagem
// escura com brilho azul à esquerda e magenta no canto inferior direito. As camadas de CSS
// que sobram existem para **serviço**, não decoração: halos discretos costurando a foto com
// a paleta, grão para matar banding e uma vinheta que segura o contraste do texto. A grade
// fina só entra quando NÃO há foto (a foto já tem textura própria; somar as duas suja).

import Image from "next/image";
import { FUNDO_SRC } from "./brandAssets";

// Grão em SVG inline (mesma técnica do `body::after` do tema escuro em globals.css).
const GRAO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function LoginCanvas({ className = "" }: { className?: string }) {
  const temFoto = Boolean(FUNDO_SRC);
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(125% 95% at 12% 6%, #1c202c 0%, #0e1017 46%, #07080c 100%)" }}
      />

      {FUNDO_SRC && (
        <Image
          src={FUNDO_SRC}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      )}

      <div
        className={`absolute -left-32 -top-40 h-[42rem] w-[42rem] rounded-full blur-[120px] ${temFoto ? "opacity-50" : ""}`}
        style={{ background: "radial-gradient(circle, rgba(233,30,140,0.24), transparent 66%)" }}
      />
      <div
        className={`absolute -bottom-56 -right-40 h-[46rem] w-[46rem] rounded-full blur-[130px] ${temFoto ? "opacity-40" : ""}`}
        style={{ background: "radial-gradient(circle, rgba(63,92,171,0.28), transparent 66%)" }}
      />

      {!temFoto && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(115% 95% at 18% 0%, #000 10%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(115% 95% at 18% 0%, #000 10%, transparent 72%)",
          }}
        />
      )}

      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: GRAO }} />

      <div
        className="absolute inset-0"
        style={{
          background: temFoto
            ? "radial-gradient(115% 80% at 45% 40%, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.5) 62%, rgba(0,0,0,0.8) 100%)"
            : "radial-gradient(120% 85% at 50% 45%, transparent 38%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </div>
  );
}
