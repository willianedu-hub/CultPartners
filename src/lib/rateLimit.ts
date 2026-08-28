// Limitador de taxa simples em memória (best-effort, por processo). Suficiente para
// conter abuso/estouro de custo em ações que chamam APIs externas pagas. Para
// produção multi-instância, troque o store por Redis mantendo a mesma assinatura.
const buckets = new Map<string, { count: number; resetAt: number }>();

/** true = permitido; false = excedeu `limit` chamadas dentro de `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
