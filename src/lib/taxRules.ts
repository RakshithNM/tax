export type TaxpayerType =
  | "individual"
  | "huf"
  | "domestic-company"
  | "foreign-company"
  | "firm-llp"
  | "aop-boi-trust-ajp"
  | "local-authority";

export type ResidentialStatus = "resident" | "rnor" | "non-resident";
export type AgeBand = "below-60" | "60-79" | "80-plus";
export type TaxRegime = "new" | "old";

export interface TaxSource {
  id: string;
  label: string;
  url: string;
}

export interface Slab {
  upTo: number;
  rate: number;
}

export const TAX_YEAR = {
  assessmentYear: "AY 2026-27",
  financialYear: "FY 2025-26",
  lastReviewed: "2026-06-23",
} as const;

export const TAX_SOURCES = [
  {
    id: "individual",
    label: "Income Tax Department: Individual return, slabs and deductions",
    url: "https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1",
  },
  {
    id: "individual-business",
    label: "Income Tax Department: Individual business/profession guidance",
    url: "https://www.incometax.gov.in/iec/foportal/help/individual-business-profession",
  },
  {
    id: "non-resident",
    label: "Income Tax Department: Non-resident individual guidance",
    url: "https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-0",
  },
  {
    id: "huf",
    label: "Income Tax Department: HUF guidance",
    url: "https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable",
  },
  {
    id: "company",
    label: "Income Tax Department: Domestic company guidance",
    url: "https://www.incometax.gov.in/iec/foportal/help/company/return-applicable",
  },
  {
    id: "foreign-company",
    label: "Income Tax Department: Foreign company guidance",
    url: "https://www.incometax.gov.in/iec/foportal/help/company/return-applicable-0",
  },
  {
    id: "firm-llp",
    label: "Income Tax Department: Firm and LLP guidance",
    url: "https://www.incometax.gov.in/iec/foportal/help/partnership-firm-llp",
  },
  {
    id: "non-company",
    label: "Income Tax Department: AOP, BOI, trust and AJP guidance",
    url: "https://www.incometax.gov.in/iec/foportal/help/non-company/return-applicable-0",
  },
  {
    id: "local-authority",
    label: "Income Tax Department: Local authority guidance",
    url: "https://www.incometax.gov.in/iec/foportal/help/non-company/return-applicable",
  },
] as const satisfies TaxSource[];

export const TAXPAYER_LABELS: Record<TaxpayerType, string> = {
  individual: "Individual",
  huf: "Hindu Undivided Family",
  "domestic-company": "Domestic company",
  "foreign-company": "Foreign company",
  "firm-llp": "Firm / LLP",
  "aop-boi-trust-ajp": "AOP / BOI / Trust / AJP",
  "local-authority": "Local authority",
};

export const RESIDENTIAL_STATUS_LABELS: Record<ResidentialStatus, string> = {
  resident: "Resident",
  rnor: "Resident but not ordinarily resident",
  "non-resident": "Non-resident",
};

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  "below-60": "Below 60",
  "60-79": "Senior citizen",
  "80-plus": "Super senior citizen",
};

export const REGIME_LABELS: Record<TaxRegime, string> = {
  new: "New tax regime",
  old: "Old tax regime",
};

export const TAX_CONSTANTS = {
  cessRate: 0.04,
  oldRegimeResidentRebateLimit: 500000,
  oldRegimeResidentRebateAmount: 12500,
  newRegimeResidentRebateLimit: 1200000,
  newRegimeResidentRebateAmount: 60000,
  ltcg112aThreshold: 125000,
  ltcg112aRate: 0.125,
  itrSimpleIncomeLimit: 5000000,
  agriculturalItrSimpleLimit: 5000,
  surchargeThresholds: [5000000, 10000000, 20000000, 50000000],
} as const;

export const NEW_REGIME_SLABS: readonly Slab[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
] as const;

export const OLD_REGIME_SLABS = {
  standard: [
    { upTo: 250000, rate: 0 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
  ],
  senior: [
    { upTo: 300000, rate: 0 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
  ],
  superSenior: [
    { upTo: 500000, rate: 0 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.3 },
  ],
} as const satisfies Record<string, readonly Slab[]>;
