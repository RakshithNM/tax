import {
  AGE_BAND_LABELS,
  NEW_REGIME_SLABS,
  OLD_REGIME_SLABS,
  REGIME_LABELS,
  RESIDENTIAL_STATUS_LABELS,
  TAX_CONSTANTS,
  TAX_SOURCES,
  TAX_YEAR,
  TAXPAYER_LABELS,
  type AgeBand,
  type ResidentialStatus,
  type Slab,
  type TaxRegime,
  type TaxSource,
  type TaxpayerType,
} from "./taxRules";

export interface ApplicabilityIncomeInput {
  salaryIncome: number;
  housePropertyIncome: number;
  businessIncome: number;
  capitalGains112A: number;
  otherCapitalGains: number;
  interestIncome: number;
  dividendIncome: number;
  otherIncome: number;
  agriculturalIncome: number;
}

export interface ApplicabilityFlags {
  presumptiveIncome: boolean;
  hasForeignAssets: boolean;
  isCompanyDirector: boolean;
  holdsUnlistedEquity: boolean;
  hasCarryForwardLoss: boolean;
  auditRequired: boolean;
  internationalTransaction: boolean;
  hasSpecialRateIncome: boolean;
}

export interface TaxApplicabilityInput {
  taxpayerType: TaxpayerType;
  residentialStatus: ResidentialStatus;
  residenceCountry: string;
  ageBand: AgeBand;
  preferredRegime: TaxRegime;
  income: ApplicabilityIncomeInput;
  flags: ApplicabilityFlags;
}

export type ResultLevel = "applies" | "may-apply" | "review";

export interface ApplicabilityItem {
  level: ResultLevel;
  title: string;
  detail: string;
  sourceIds: string[];
}

export interface LikelyForm {
  form: string;
  title: string;
  detail: string;
  sourceIds: string[];
}

export interface EstimateBreakdownLine {
  label: string;
  value: number;
}

export interface TaxEstimate {
  status: "available" | "specialist-required";
  title: string;
  detail: string;
  taxableIncome: number;
  baseTax: number;
  rebate: number;
  ltcgTax: number;
  cess: number;
  totalTax: number;
  breakdown: EstimateBreakdownLine[];
}

export interface TaxApplicabilityResult {
  heading: string;
  summary: string;
  applicability: ApplicabilityItem[];
  likelyForms: LikelyForm[];
  warnings: ApplicabilityItem[];
  assumptions: string[];
  estimate: TaxEstimate;
  sourceIds: string[];
  sources: TaxSource[];
}

function clampRupees(value: unknown): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(Math.round(numericValue), 0);
}

function calculateSlabTax(income: number, slabs: readonly Slab[]): number {
  let previousLimit = 0;
  let tax = 0;

  for (const slab of slabs) {
    if (income <= previousLimit) {
      break;
    }

    const taxableInSlab = Math.min(income, slab.upTo) - previousLimit;
    tax += taxableInSlab * slab.rate;
    previousLimit = slab.upTo;
  }

  return Math.round(tax);
}

function isResidentIndividual(input: TaxApplicabilityInput): boolean {
  return input.taxpayerType === "individual" && input.residentialStatus !== "non-resident";
}

function getOldRegimeSlabs(input: TaxApplicabilityInput): readonly Slab[] {
  if (input.taxpayerType !== "individual" || input.residentialStatus === "non-resident") {
    return OLD_REGIME_SLABS.standard;
  }

  if (input.ageBand === "80-plus") {
    return OLD_REGIME_SLABS.superSenior;
  }

  if (input.ageBand === "60-79") {
    return OLD_REGIME_SLABS.senior;
  }

  return OLD_REGIME_SLABS.standard;
}

function ordinaryIncome(input: TaxApplicabilityInput): number {
  const income = input.income;
  return (
    clampRupees(income.salaryIncome) +
    clampRupees(income.housePropertyIncome) +
    clampRupees(income.businessIncome) +
    clampRupees(income.interestIncome) +
    clampRupees(income.dividendIncome) +
    clampRupees(income.otherIncome)
  );
}

function totalKnownIncome(input: TaxApplicabilityInput): number {
  return (
    ordinaryIncome(input) +
    clampRupees(input.income.capitalGains112A) +
    clampRupees(input.income.otherCapitalGains) +
    clampRupees(input.income.agriculturalIncome)
  );
}

function hasBusinessIncome(input: TaxApplicabilityInput): boolean {
  return clampRupees(input.income.businessIncome) > 0;
}

function hasCapitalGains(input: TaxApplicabilityInput): boolean {
  return (
    clampRupees(input.income.capitalGains112A) > 0 ||
    clampRupees(input.income.otherCapitalGains) > 0
  );
}

function calculateSupportedEstimate(input: TaxApplicabilityInput): TaxEstimate {
  const supportedTaxpayer =
    input.taxpayerType === "individual" || input.taxpayerType === "huf";
  const unsupportedSpecialIncome =
    clampRupees(input.income.otherCapitalGains) > 0 ||
    input.flags.hasSpecialRateIncome ||
    input.flags.auditRequired ||
    input.flags.internationalTransaction;

  if (!supportedTaxpayer || unsupportedSpecialIncome) {
    return {
      status: "specialist-required",
      title: "Specialist estimate required",
      detail:
        "This case has entity-level, audit, transfer-pricing, special-rate, or capital-gain complexity. The checker identifies applicable rules but does not calculate final liability.",
      taxableIncome: totalKnownIncome(input),
      baseTax: 0,
      rebate: 0,
      ltcgTax: 0,
      cess: 0,
      totalTax: 0,
      breakdown: [],
    };
  }

  const taxableIncome = ordinaryIncome(input);
  const slabs = input.preferredRegime === "new" ? NEW_REGIME_SLABS : getOldRegimeSlabs(input);
  const taxBeforeRebate = calculateSlabTax(taxableIncome, slabs);
  let rebate = 0;

  if (
    input.preferredRegime === "new" &&
    isResidentIndividual(input) &&
    taxableIncome <= TAX_CONSTANTS.newRegimeResidentRebateLimit
  ) {
    rebate = Math.min(taxBeforeRebate, TAX_CONSTANTS.newRegimeResidentRebateAmount);
  }

  if (
    input.preferredRegime === "old" &&
    isResidentIndividual(input) &&
    taxableIncome <= TAX_CONSTANTS.oldRegimeResidentRebateLimit
  ) {
    rebate = Math.min(taxBeforeRebate, TAX_CONSTANTS.oldRegimeResidentRebateAmount);
  }

  const capitalGains112A = clampRupees(input.income.capitalGains112A);
  const taxable112A = Math.max(capitalGains112A - TAX_CONSTANTS.ltcg112aThreshold, 0);
  const ltcgTax = Math.round(taxable112A * TAX_CONSTANTS.ltcg112aRate);
  const baseTax = Math.max(taxBeforeRebate - rebate, 0) + ltcgTax;
  const cess = Math.round(baseTax * TAX_CONSTANTS.cessRate);

  return {
    status: "available",
    title: "Approximate estimate available",
    detail:
      "Estimate uses ordinary slab income, Section 112A equity LTCG threshold, resident-individual rebate where eligible, and 4% health and education cess. It excludes deductions, surcharge, MAT/AMT, DTAA, TDS, advance-tax interest, and special-rate income.",
    taxableIncome,
    baseTax,
    rebate,
    ltcgTax,
    cess,
    totalTax: baseTax + cess,
    breakdown: [
      { label: "Ordinary taxable income", value: taxableIncome },
      { label: `${REGIME_LABELS[input.preferredRegime]} slab tax before rebate`, value: taxBeforeRebate },
      { label: "Resident-individual rebate applied", value: -rebate },
      { label: "Section 112A LTCG tax", value: ltcgTax },
      { label: "Health and education cess", value: cess },
    ],
  };
}

function likelyForms(input: TaxApplicabilityInput): LikelyForm[] {
  const totalIncome = totalKnownIncome(input);

  if (input.taxpayerType === "domestic-company" || input.taxpayerType === "foreign-company") {
    return [
      {
        form: "ITR-6",
        title: "Company return path",
        detail:
          "Companies generally use ITR-6 unless they are required to file ITR-7. Company computation is not estimated in this checker.",
        sourceIds: [input.taxpayerType === "foreign-company" ? "foreign-company" : "company"],
      },
    ];
  }

  if (input.taxpayerType === "firm-llp") {
    return [
      {
        form: "ITR-5",
        title: "Firm / LLP return path",
        detail: "Firms and LLPs generally use ITR-5. Presumptive firm cases still need eligibility review.",
        sourceIds: ["firm-llp"],
      },
    ];
  }

  if (input.taxpayerType === "aop-boi-trust-ajp") {
    return [
      {
        form: "ITR-5 / ITR-7",
        title: "Non-company return path",
        detail:
          "AOP, BOI and AJP cases generally point to ITR-5, while many trust and institution cases require ITR-7.",
        sourceIds: ["non-company"],
      },
    ];
  }

  if (input.taxpayerType === "local-authority") {
    return [
      {
        form: "ITR-5 / ITR-7",
        title: "Local authority return path",
        detail:
          "Local authorities generally use ITR-5 unless a specific ITR-7 category applies.",
        sourceIds: ["local-authority"],
      },
    ];
  }

  if (input.taxpayerType === "huf") {
    if (hasBusinessIncome(input)) {
      return [
        {
          form: input.flags.presumptiveIncome ? "ITR-4 or ITR-3" : "ITR-3",
          title: "HUF with business/profession income",
          detail:
            "A HUF with business/profession income generally uses ITR-3; presumptive cases may be eligible for ITR-4 if all simplified-return conditions are met.",
          sourceIds: ["huf", "individual-business"],
        },
      ];
    }

    return [
      {
        form: "ITR-2",
        title: "HUF without business/profession income",
        detail:
          "HUFs not eligible for ITR-1 generally use ITR-2 when there is no business/profession income.",
        sourceIds: ["huf"],
      },
    ];
  }

  if (hasBusinessIncome(input)) {
    const presumptiveEligible =
      input.flags.presumptiveIncome &&
      input.residentialStatus === "resident" &&
      totalIncome <= TAX_CONSTANTS.itrSimpleIncomeLimit &&
      !input.flags.hasForeignAssets &&
      !input.flags.hasCarryForwardLoss &&
      !input.flags.isCompanyDirector &&
      !input.flags.holdsUnlistedEquity &&
      clampRupees(input.income.otherCapitalGains) === 0 &&
      clampRupees(input.income.capitalGains112A) <= TAX_CONSTANTS.ltcg112aThreshold;

    return [
      {
        form: presumptiveEligible ? "ITR-4" : "ITR-3",
        title: presumptiveEligible
          ? "Presumptive business/profession path"
          : "Business/profession path",
        detail: presumptiveEligible
          ? "Resident individuals with eligible presumptive income and simplified-return limits may use ITR-4."
          : "Individuals with business/profession income who are not eligible for ITR-4 generally use ITR-3.",
        sourceIds: ["individual-business", "individual"],
      },
    ];
  }

  const itr1Eligible =
    input.residentialStatus === "resident" &&
    totalIncome <= TAX_CONSTANTS.itrSimpleIncomeLimit &&
    clampRupees(input.income.agriculturalIncome) <= TAX_CONSTANTS.agriculturalItrSimpleLimit &&
    clampRupees(input.income.otherCapitalGains) === 0 &&
    clampRupees(input.income.capitalGains112A) <= TAX_CONSTANTS.ltcg112aThreshold &&
    !input.flags.hasForeignAssets &&
    !input.flags.hasCarryForwardLoss &&
    !input.flags.isCompanyDirector &&
    !input.flags.holdsUnlistedEquity;

  return [
    {
      form: itr1Eligible ? "ITR-1" : "ITR-2",
      title: itr1Eligible ? "Simplified individual return path" : "Individual non-business path",
      detail: itr1Eligible
        ? "Resident ordinary individuals within the simplified limits may be eligible for ITR-1."
        : "Non-business individual cases outside ITR-1 limits generally move to ITR-2.",
      sourceIds: [input.residentialStatus === "non-resident" ? "non-resident" : "individual"],
    },
  ];
}

function buildApplicability(input: TaxApplicabilityInput): ApplicabilityItem[] {
  const sourceId =
    input.taxpayerType === "individual"
      ? input.residentialStatus === "non-resident"
        ? "non-resident"
        : "individual"
      : input.taxpayerType === "huf"
        ? "huf"
        : input.taxpayerType === "domestic-company"
          ? "company"
          : input.taxpayerType === "foreign-company"
            ? "foreign-company"
            : input.taxpayerType === "firm-llp"
              ? "firm-llp"
              : input.taxpayerType === "local-authority"
                ? "local-authority"
                : "non-company";

  const items: ApplicabilityItem[] = [
    {
      level: "applies",
      title: `${TAXPAYER_LABELS[input.taxpayerType]} rules selected`,
      detail: `${TAX_YEAR.assessmentYear} guidance is pinned for ${TAXPAYER_LABELS[input.taxpayerType].toLowerCase()} taxpayers.`,
      sourceIds: [sourceId],
    },
  ];

  if (
    input.taxpayerType === "individual" ||
    input.taxpayerType === "huf" ||
    input.taxpayerType === "aop-boi-trust-ajp"
  ) {
    items.push({
      level: "applies",
      title: `${REGIME_LABELS[input.preferredRegime]} considered`,
      detail:
        input.preferredRegime === "new"
          ? "The new tax regime is the default for Individual, HUF, AOP, BOI and AJP-style taxpayers under the pinned source guidance."
          : "The old regime is treated as an opt-out choice and must be elected correctly wherever the law requires it.",
      sourceIds: ["individual", "non-company"],
    });
  } else {
    items.push({
      level: "review",
      title: "Entity tax computation needs category-specific review",
      detail:
        "Company, firm, LLP and local-authority cases use entity-specific rates, surcharge, MAT/AMT and reporting rules that v1 identifies but does not calculate.",
      sourceIds: [sourceId],
    });
  }

  if (input.taxpayerType === "individual" || input.taxpayerType === "huf") {
    items.push({
      level: "applies",
      title: "Income heads screened",
      detail:
        "The checker reviews salary/pension, house property, business/profession, capital gains, interest/dividend, other sources and agricultural income.",
      sourceIds: [input.taxpayerType === "huf" ? "huf" : "individual"],
    });
  }

  if (hasCapitalGains(input)) {
    items.push({
      level: "may-apply",
      title: "Capital gains reporting applies",
      detail:
        "Section 112A gains up to the pinned threshold can remain in simplified-return screening, but other capital gains or higher gains require fuller return review.",
      sourceIds: ["individual"],
    });
  }

  return items;
}

function buildWarnings(input: TaxApplicabilityInput): ApplicabilityItem[] {
  const warnings: ApplicabilityItem[] = [
    {
      level: "review",
      title: "Educational guidance only",
      detail:
        "This tool is not tax, legal or investment advice. It is a sourced screening aid and cannot confirm final filing positions.",
      sourceIds: [],
    },
  ];

  if (input.residenceCountry.trim().toLowerCase() !== "india" || input.residentialStatus !== "resident") {
    warnings.push({
      level: "review",
      title: "Cross-border review required",
      detail:
        "Country of residence and India stay can affect residential status, DTAA relief, foreign tax credit and disclosure obligations. Treaty relief is not calculated here.",
      sourceIds: ["non-resident"],
    });
  }

  if (input.preferredRegime === "old" && hasBusinessIncome(input)) {
    warnings.push({
      level: "review",
      title: "Old-regime opt-out compliance",
      detail:
        "Business/profession taxpayers opting out of the default new regime generally need correct election compliance, including Form 10-IEA where applicable.",
      sourceIds: ["individual-business"],
    });
  }

  if (
    input.flags.hasForeignAssets ||
    input.flags.isCompanyDirector ||
    input.flags.holdsUnlistedEquity ||
    input.flags.hasCarryForwardLoss
  ) {
    warnings.push({
      level: "review",
      title: "Simplified return exclusions",
      detail:
        "Foreign assets/signing authority, company directorship, unlisted equity or carried-forward losses can move a taxpayer out of simplified return forms.",
      sourceIds: ["individual"],
    });
  }

  if (input.flags.auditRequired || input.flags.internationalTransaction) {
    warnings.push({
      level: "review",
      title: "Audit or international transaction case",
      detail:
        "Audit, transfer-pricing or international-transaction cases can change due dates, forms, disclosures and computations.",
      sourceIds: ["individual-business", "company", "firm-llp"],
    });
  }

  if (totalKnownIncome(input) > TAX_CONSTANTS.surchargeThresholds[0]) {
    warnings.push({
      level: "may-apply",
      title: "Surcharge may apply",
      detail:
        "The official guidance includes surcharge bands and marginal relief. The v1 estimate flags surcharge but does not compute it.",
      sourceIds: ["individual"],
    });
  }

  return warnings;
}

function buildAssumptions(input: TaxApplicabilityInput): string[] {
  return [
    `Pinned tax year: ${TAX_YEAR.assessmentYear} for ${TAX_YEAR.financialYear}.`,
    `Rules last reviewed: ${TAX_YEAR.lastReviewed}.`,
    `Residential status selected: ${RESIDENTIAL_STATUS_LABELS[input.residentialStatus]}.`,
    `Age band selected: ${AGE_BAND_LABELS[input.ageBand]}.`,
    "Amounts are rounded to whole rupees and treated as non-negative.",
    "The estimate excludes deductions/exemptions unless already reflected in the income entered.",
    "DTAA relief, foreign tax credit, TDS/TCS, advance-tax interest, audit reports, MAT/AMT and special-rate income are not calculated.",
  ];
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function evaluateTaxApplicability(
  rawInput: TaxApplicabilityInput,
): TaxApplicabilityResult {
  const input: TaxApplicabilityInput = {
    ...rawInput,
    residenceCountry: rawInput.residenceCountry.trim() || "India",
    income: {
      salaryIncome: clampRupees(rawInput.income.salaryIncome),
      housePropertyIncome: clampRupees(rawInput.income.housePropertyIncome),
      businessIncome: clampRupees(rawInput.income.businessIncome),
      capitalGains112A: clampRupees(rawInput.income.capitalGains112A),
      otherCapitalGains: clampRupees(rawInput.income.otherCapitalGains),
      interestIncome: clampRupees(rawInput.income.interestIncome),
      dividendIncome: clampRupees(rawInput.income.dividendIncome),
      otherIncome: clampRupees(rawInput.income.otherIncome),
      agriculturalIncome: clampRupees(rawInput.income.agriculturalIncome),
    },
  };
  const applicability = buildApplicability(input);
  const forms = likelyForms(input);
  const warnings = buildWarnings(input);
  const estimate = calculateSupportedEstimate(input);
  const sourceIds = unique([
    ...applicability.flatMap((item) => item.sourceIds),
    ...forms.flatMap((form) => form.sourceIds),
    ...warnings.flatMap((warning) => warning.sourceIds),
  ]).filter(Boolean);

  return {
    heading: `${TAXPAYER_LABELS[input.taxpayerType]} tax applicability`,
    summary: `${RESIDENTIAL_STATUS_LABELS[input.residentialStatus]} taxpayer, ${REGIME_LABELS[input.preferredRegime].toLowerCase()}, ${TAX_YEAR.assessmentYear}.`,
    applicability,
    likelyForms: forms,
    warnings,
    assumptions: buildAssumptions(input),
    estimate,
    sourceIds,
    sources: TAX_SOURCES.filter((source) => sourceIds.includes(source.id)),
  };
}

export { TAX_SOURCES, TAX_YEAR, TAXPAYER_LABELS };
