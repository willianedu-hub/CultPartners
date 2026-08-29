// Modelo de filtros genérico — compartilhado entre listas (parceiros, produtos,
// oportunidades…). Puro: sem React, sem Prisma. Cada entidade fornece a lista
// de campos (FieldDef[]) e, opcionalmente, um mapeador de valor por linha.

export type FilterType = "text" | "number" | "date" | "boolean" | "enum";
export type FilterOp =
  | "contains" | "eq" | "neq" | "startsWith" | "empty" | "notEmpty"
  | "gt" | "gte" | "lt" | "lte" | "before" | "after" | "on"
  | "isTrue" | "isFalse";
export type FilterCond = { field: string; op: FilterOp; value?: string };

export type FieldDef = { key: string; label: string; type: FilterType; enumSource?: string };

export const OPS: Record<FilterType, { op: FilterOp; label: string }[]> = {
  text: [
    { op: "contains", label: "contém" }, { op: "eq", label: "igual a" }, { op: "neq", label: "diferente de" },
    { op: "startsWith", label: "começa com" }, { op: "empty", label: "está vazio" }, { op: "notEmpty", label: "está preenchido" },
  ],
  number: [
    { op: "eq", label: "=" }, { op: "neq", label: "≠" }, { op: "gt", label: ">" },
    { op: "gte", label: "≥" }, { op: "lt", label: "<" }, { op: "lte", label: "≤" },
  ],
  date: [
    { op: "on", label: "em" }, { op: "before", label: "antes de" }, { op: "after", label: "depois de" },
    { op: "empty", label: "está vazio" }, { op: "notEmpty", label: "está preenchido" },
  ],
  boolean: [{ op: "isTrue", label: "sim" }, { op: "isFalse", label: "não" }],
  enum: [{ op: "eq", label: "é" }, { op: "neq", label: "não é" }],
};

/** Operações que não exigem valor. */
export const VALUELESS: FilterOp[] = ["empty", "notEmpty", "isTrue", "isFalse"];

export function fieldMaps<T extends FieldDef>(fields: T[]) {
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f])) as Record<string, T>;
  const type = Object.fromEntries(fields.map((f) => [f.key, f.type])) as Record<string, FilterType>;
  return { byKey, type };
}

/** Aplica uma condição a um valor bruto já resolvido. */
export function matchesOne(raw: unknown, type: FilterType, op: FilterOp, value?: string): boolean {
  const v = value ?? "";
  if (type === "text") {
    const s = (raw ?? "").toString().toLowerCase();
    const q = v.toLowerCase();
    switch (op) {
      case "contains": return s.includes(q);
      case "eq": return s === q;
      case "neq": return s !== q;
      case "startsWith": return s.startsWith(q);
      case "empty": return s === "";
      case "notEmpty": return s !== "";
      default: return true;
    }
  }
  if (type === "number") {
    const n = Number(raw); const t = Number(v);
    switch (op) {
      case "eq": return n === t; case "neq": return n !== t;
      case "gt": return n > t; case "gte": return n >= t;
      case "lt": return n < t; case "lte": return n <= t;
      default: return true;
    }
  }
  if (type === "date") {
    const d = raw ? new Date(raw as string).getTime() : null;
    if (op === "empty") return d === null;
    if (op === "notEmpty") return d !== null;
    if (d === null) return false;
    const t = new Date(v).getTime();
    if (op === "before") return d < t;
    if (op === "after") return d > t;
    if (op === "on") return d >= t && d < t + 86_400_000;
    return true;
  }
  if (type === "boolean") {
    return op === "isTrue" ? raw === true : raw === false;
  }
  // enum
  if (op === "eq") return String(raw ?? "") === v;
  if (op === "neq") return String(raw ?? "") !== v;
  return true;
}

/** Aplica todas as condições a uma linha. `getValue` permite mapear chaves para campos. */
export function matchesConditions<T extends Record<string, unknown>>(
  row: T,
  conds: FilterCond[],
  typeByField: Record<string, FilterType>,
  getValue: (row: T, key: string) => unknown = (r, k) => r[k],
): boolean {
  return conds.every((c) => matchesOne(getValue(row, c.field), typeByField[c.field] ?? "text", c.op, c.value));
}
