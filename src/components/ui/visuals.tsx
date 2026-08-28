"use client";

import {
  Stethoscope, Landmark, ShoppingCart, GraduationCap, Factory, Cpu, Truck, Zap,
  Wheat, Radio, HardHat, Hotel, Utensils, Shield, Gavel, Building2, Layers, Fuel, Plane,
  type LucideIcon,
} from "lucide-react";

// Remove acentos para casar palavras-chave da vertical.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const RULES: { icon: LucideIcon; keys: string[] }[] = [
  { icon: Stethoscope, keys: ["saude", "hospital", "clinica", "farma", "medic", "pharma", "health"] },
  { icon: Landmark, keys: ["financ", "banc", "fintech", "seguro", "invest", "credito", "governo", "publico", "setor publico"] },
  { icon: Gavel, keys: ["juridic", "advocac", "legal", "direito"] },
  { icon: ShoppingCart, keys: ["varejo", "retail", "comercio", "loja", "ecommerce", "e-commerce", "consumo"] },
  { icon: GraduationCap, keys: ["educac", "ensino", "escola", "universidad", "edtech"] },
  { icon: Factory, keys: ["industr", "manufatur", "fabrica", "producao"] },
  { icon: Cpu, keys: ["tecnolog", "software", "saas", "startup", "ti", "tech", "cyber"] },
  { icon: Truck, keys: ["logistic", "transport", "frota", "supply", "entrega"] },
  { icon: Zap, keys: ["energia", "eletric", "utilit", "utilities"] },
  { icon: Fuel, keys: ["petrol", "oleo", "gas", "combust"] },
  { icon: Wheat, keys: ["agro", "agricult", "agroneg", "fazenda"] },
  { icon: Radio, keys: ["telecom", "midia", "media", "comunicac"] },
  { icon: HardHat, keys: ["construc", "engenharia", "imobiliar", "obras"] },
  { icon: Hotel, keys: ["hotel", "turismo", "hospitalidade", "hospedagem"] },
  { icon: Plane, keys: ["viagens", "aereo", "aviacao", "aerea"] },
  { icon: Utensils, keys: ["aliment", "food", "restaurante", "bebida", "gastro"] },
  { icon: Shield, keys: ["seguranca", "defesa", "protec"] },
  { icon: Building2, keys: ["servic", "consultoria", "corporativo", "b2b"] },
];

/** Ícone que reflete a vertical de negócio (por palavra-chave), com fallback. */
export function verticalIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Layers;
  const n = norm(name);
  for (const r of RULES) if (r.keys.some((k) => n.includes(k))) return r.icon;
  return Layers;
}

/** Escala de cor do score (não-roxa): vermelho → âmbar → lima → esmeralda. */
export function scoreColor(score: number): string {
  if (score >= 75) return "#10b981"; // esmeralda
  if (score >= 50) return "#84cc16"; // lima
  if (score >= 25) return "#f59e0b"; // âmbar
  return "#ef4444"; // vermelho
}
