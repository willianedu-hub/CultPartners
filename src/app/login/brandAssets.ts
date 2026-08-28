// Assets rasterizados da marca usados só na tela de login. Ficam num módulo próprio
// para que ligar/desligar cada um seja uma linha: `null` faz a tela cair na arte gerada
// em CSS (`LoginCanvas`) e no escudo em marca-d'água (`Mascote`), sem buraco na composição.
//
// Os arquivos vieram do site da CultSec (webp, já otimizados pela origem):
//   camaleao-glitch.webp  826×1351, com transparência  (210 KB)
//   fundo-login.webp      1920×918, sem transparência  (446 KB)
// `next/image` serve derivados AVIF/WebP dimensionados; estes são os originais.
export const MASCOTE_SRC: string | null = "/brand/camaleao-glitch.webp";
export const FUNDO_SRC: string | null = "/brand/fundo-login.webp";
