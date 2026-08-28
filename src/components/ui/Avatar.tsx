"use client";

import { useEffect, useState } from "react";

// Avatar: círculo com iniciais (cor da marca) e, se houver e-mail, tenta a foto
// do Gravatar por cima (cai nas iniciais se a pessoa não tiver Gravatar).

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

async function gravatarUrl(email: string, sizePx: number): Promise<string> {
  const norm = email.trim().toLowerCase();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  const hash = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // d=404: sem Gravatar → 404 → onError cai nas iniciais.
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=${sizePx}`;
}

export function Avatar({
  name,
  email,
  size = 36,
  className = "",
}: {
  name: string;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    const e = (email ?? "").trim();
    if (!e || typeof crypto === "undefined" || !crypto.subtle) return;
    gravatarUrl(e, Math.round(size * 2))
      .then((u) => { if (alive) setSrc(u); })
      .catch(() => {});
    return () => { alive = false; };
  }, [email, size]);

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full text-white ${className}`}
      style={{ width: size, height: size, background: "linear-gradient(135deg, #e91e8c, #3f5cab)" }}
      aria-hidden
    >
      <span className="font-semibold leading-none" style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}>
        {initialsOf(name)}
      </span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setSrc(null)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
