import { CostBreakdown, CostEntry, ModelTier, SessionTotals } from '../types';

const entries: CostEntry[] = [];

function parseUSD(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function logSessionCost(modelTier: ModelTier, usage: CostBreakdown): void {
  entries.push({
    timestamp: new Date().toISOString(),
    modelTier,
    usage
  });
}

export function getSessionEntries(): CostEntry[] {
  return [...entries].reverse();
}

export function getSessionTotals(): SessionTotals {
  const totalUSD = entries.reduce((sum, item) => sum + parseUSD(item.usage.totalUSD), 0);
  const totalTHB = entries.reduce((sum, item) => sum + parseUSD(item.usage.totalTHB), 0);

  return {
    calls: entries.length,
    totalUSD: totalUSD.toFixed(6),
    totalTHB: totalTHB.toFixed(4)
  };
}

export function resetSession(): void {
  entries.length = 0;
}
