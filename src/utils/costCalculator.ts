import { CostBreakdown, ModelTier, PricingRate, UsageMetadataLike } from '../types';

const THB_EXCHANGE_RATE = 36;

const PRICING: Record<ModelTier, PricingRate> = {
  flash: { input: 0.5, output: 10 },
  pro: { input: 1, output: 20 }
};

function toFixed(num: number, digits: number): string {
  return num.toFixed(digits);
}

export function calculateCost(usageMeta: UsageMetadataLike, model: ModelTier = 'flash'): CostBreakdown {
  const inputTokens = usageMeta.promptTokenCount ?? 0;
  const outputTokens = usageMeta.candidatesTokenCount ?? 0;

  const rate = PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * rate.input;
  const outputCost = (outputTokens / 1_000_000) * rate.output;
  const totalUSD = inputCost + outputCost;
  const totalTHB = totalUSD * THB_EXCHANGE_RATE;

  return {
    inputTokens,
    outputTokens,
    audioDurationSec: Math.round(outputTokens / 25),
    inputCostUSD: toFixed(inputCost, 6),
    outputCostUSD: toFixed(outputCost, 6),
    totalUSD: toFixed(totalUSD, 6),
    totalTHB: toFixed(totalTHB, 4)
  };
}
