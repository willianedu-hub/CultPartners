"use client";

import { Hourglass } from "lucide-react";

/** Aging do card (dias parado). Sinaliza oportunidades/tarefas sem movimento. */
export function AgingBadge({ since, warnDays = 14, staleDays = 30, label = "no funil", className = "" }: { since: string | null | undefined; warnDays?: number; staleDays?: number; label?: string; className?: string }) {
  if (!since) return null;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  if (days < 1) return null;
  const cls = days >= staleDays ? "text-red-400" : days >= warnDays ? "text-amber-400" : "text-faint";
  return (
    <span title={`há ${days} dia(s) ${label}`} className={`inline-flex items-center gap-0.5 text-[11px] tabular-nums ${cls} ${className}`}>
      <Hourglass className="h-3 w-3" aria-hidden /> {days}d
    </span>
  );
}
