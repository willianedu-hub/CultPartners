// Marca CultPartners — brasão (escudo externo magenta + interno azul royal) e lockup.
// O escudo carrega a cor da marca; o wordmark acompanha o tema (text-text),
// espelhando o logotipo oficial (texto monocromático + escudo colorido).

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 112"
      fill="none"
      className={className}
      role="img"
      aria-label="CultPartners"
    >
      <path
        d="M12 18 L50 30 L88 18 C92 46 90 72 78 88 C68 101 56 106 50 108 C44 106 32 101 22 88 C10 72 8 46 12 18 Z"
        stroke="#e91e8c"
        strokeWidth="7.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M26 30 L50 38 L74 30 C77 50 76 68 67 81 C60 91 53 95 50 96 C47 95 40 91 33 81 C24 68 23 50 26 30 Z"
        stroke="#3f5cab"
        strokeWidth="6.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className = "",
  markClassName = "h-6 w-auto",
  showWordmark = true,
  wordmarkClassName = "text-sm text-text",
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
      {showWordmark && (
        <span className={`font-bold leading-none tracking-tight ${wordmarkClassName}`}>
          CultPartners
        </span>
      )}
    </span>
  );
}
