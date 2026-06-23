export type AmountKey =
  | "grossReceipts"
  | "savingsBankInterest"
  | "fixedDepositInterest"
  | "dividendIncome"
  | "realizedLtcg";

export interface FreelancerTaxInput {
  grossReceipts: number;
  savingsBankInterest: number;
  fixedDepositInterest: number;
  dividendIncome: number;
  realizedLtcg: number;
  digitalReceiptsAtLeast95: boolean;
}

export interface FreelancerTaxResult {
  deemedProfit: number;
  interestIncome: number;
  dividendIncome: number;
  regularIncome: number;
  regularIncomeTaxBeforeRelief: number;
  regularIncomeTaxRelief: number;
  regularIncomeTax: number;
  taxableRealizedLtcg: number;
  realizedLtcgTax: number;
  baseTaxBeforeCess: number;
  healthEducationCess: number;
  totalTaxLiability: number;
  ltcgUsed: number;
  unusedLtcgThreshold: number;
  boundaryBreach: boolean;
}

export const TAX_LIMITS = {
  maxReceipts: 7500000,
  maxAmountInput: 7500000,
  standardPresumptiveLimit: 5000000,
  digitalPresumptiveLimit: 7500000,
  deemedProfitRate: 0.5,
  ltcgFreeThreshold: 125000,
  ltcgRate: 0.125,
  healthEducationCessRate: 0.04,
  rebateIncomeLimit: 1200000,
} as const;

const NEW_REGIME_SLABS = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
] as const;

export function clampAmount(value: unknown, max: number = TAX_LIMITS.maxAmountInput): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(numericValue), 0), max);
}

function calculateNewRegimeTaxBeforeRelief(income: number): number {
  let previousLimit = 0;
  let tax = 0;

  for (const slab of NEW_REGIME_SLABS) {
    if (income <= previousLimit) {
      break;
    }

    const taxableInSlab = Math.min(income, slab.upTo) - previousLimit;
    tax += taxableInSlab * slab.rate;
    previousLimit = slab.upTo;
  }

  return Math.round(tax);
}

export function calculateNewRegimeTax(income: number): number {
  const taxBeforeRelief = calculateNewRegimeTaxBeforeRelief(income);

  if (income <= TAX_LIMITS.rebateIncomeLimit) {
    return 0;
  }

  const excessOverRebateLimit = income - TAX_LIMITS.rebateIncomeLimit;
  return Math.round(Math.min(taxBeforeRelief, excessOverRebateLimit));
}

export function calculateFreelancerTax(input: FreelancerTaxInput): FreelancerTaxResult {
  const grossReceipts = clampAmount(input.grossReceipts, TAX_LIMITS.maxReceipts);
  const savingsBankInterest = clampAmount(input.savingsBankInterest);
  const fixedDepositInterest = clampAmount(input.fixedDepositInterest);
  const dividendIncome = clampAmount(input.dividendIncome);
  const realizedLtcg = clampAmount(input.realizedLtcg);
  const deemedProfit = grossReceipts * TAX_LIMITS.deemedProfitRate;
  const interestIncome = savingsBankInterest + fixedDepositInterest;
  const regularIncome = deemedProfit + interestIncome + dividendIncome;
  const regularIncomeTaxBeforeRelief = calculateNewRegimeTaxBeforeRelief(regularIncome);
  const regularIncomeTax = calculateNewRegimeTax(regularIncome);
  const regularIncomeTaxRelief = regularIncomeTaxBeforeRelief - regularIncomeTax;
  const ltcgUsed = Math.min(realizedLtcg, TAX_LIMITS.ltcgFreeThreshold);
  const taxableRealizedLtcg = Math.max(realizedLtcg - TAX_LIMITS.ltcgFreeThreshold, 0);
  const realizedLtcgTax = Math.round(taxableRealizedLtcg * TAX_LIMITS.ltcgRate);
  const baseTaxBeforeCess = regularIncomeTax + realizedLtcgTax;
  const healthEducationCess = Math.round(
    baseTaxBeforeCess * TAX_LIMITS.healthEducationCessRate,
  );
  const unusedLtcgThreshold = Math.max(TAX_LIMITS.ltcgFreeThreshold - realizedLtcg, 0);

  return {
    deemedProfit,
    interestIncome,
    dividendIncome,
    regularIncome,
    regularIncomeTaxBeforeRelief,
    regularIncomeTaxRelief,
    regularIncomeTax,
    taxableRealizedLtcg,
    realizedLtcgTax,
    baseTaxBeforeCess,
    healthEducationCess,
    totalTaxLiability: baseTaxBeforeCess + healthEducationCess,
    ltcgUsed,
    unusedLtcgThreshold,
    boundaryBreach:
      grossReceipts > TAX_LIMITS.standardPresumptiveLimit &&
      !input.digitalReceiptsAtLeast95,
  };
}
