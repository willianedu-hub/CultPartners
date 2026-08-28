"use client";

import {
  LayoutDashboard, Calendar, Megaphone, PieChart, UserPlus, UserSearch, Kanban, Mail, Briefcase,
  Filter, Building2, LineChart, ClipboardList, FileText, Package, Settings, Users, Target, BarChart3,
  type LucideIcon,
} from "lucide-react";

// Mapa nome→componente para itens de menu (o nav é montado no server e só pode
// passar strings pela fronteira RSC; a resolução acontece aqui, no client).
const MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Calendar, Megaphone, PieChart, UserPlus, UserSearch, Kanban, Mail, Briefcase,
  Filter, Building2, LineChart, ClipboardList, FileText, Package, Settings, Users, Target, BarChart3,
};

export function NavIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Icon = MAP[name];
  return Icon ? <Icon className={className} aria-hidden /> : null;
}
