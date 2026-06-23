import { describe, expect, it } from "vitest";
import {
  evaluateTaxApplicability,
  type ApplicabilityFlags,
  type ApplicabilityIncomeInput,
  type TaxApplicabilityInput,
} from "./taxApplicability";

type InputOverrides = Partial<Omit<TaxApplicabilityInput, "income" | "flags">> & {
  income?: Partial<ApplicabilityIncomeInput>;
  flags?: Partial<ApplicabilityFlags>;
};

function input(overrides: InputOverrides = {}): TaxApplicabilityInput {
  const { income: incomeOverrides, flags: flagOverrides, ...topLevelOverrides } = overrides;
  const income: ApplicabilityIncomeInput = {
    salaryIncome: 0,
    housePropertyIncome: 0,
    businessIncome: 0,
    capitalGains112A: 0,
    otherCapitalGains: 0,
    interestIncome: 0,
    dividendIncome: 0,
    otherIncome: 0,
    agriculturalIncome: 0,
    ...incomeOverrides,
  };
  const flags: ApplicabilityFlags = {
    presumptiveIncome: false,
    hasForeignAssets: false,
    isCompanyDirector: false,
    holdsUnlistedEquity: false,
    hasCarryForwardLoss: false,
    auditRequired: false,
    internationalTransaction: false,
    hasSpecialRateIncome: false,
    ...flagOverrides,
  };

  return {
    taxpayerType: "individual",
    residentialStatus: "resident",
    residenceCountry: "India",
    ageBand: "below-60",
    preferredRegime: "new",
    ...topLevelOverrides,
    income,
    flags,
  };
}

describe("evaluateTaxApplicability", () => {
  it("applies new-regime resident individual rebate for supported estimates", () => {
    const result = evaluateTaxApplicability(
      input({ income: { salaryIncome: 1200000 } }),
    );

    expect(result.estimate.status).toBe("available");
    expect(result.estimate.rebate).toBe(60000);
    expect(result.estimate.totalTax).toBe(0);
    expect(result.likelyForms[0]?.form).toBe("ITR-1");
  });

  it("uses old-regime senior and super-senior slab selection", () => {
    const senior = evaluateTaxApplicability(
      input({
        ageBand: "60-79",
        preferredRegime: "old",
        income: { salaryIncome: 400000 },
      }),
    );
    const superSenior = evaluateTaxApplicability(
      input({
        ageBand: "80-plus",
        preferredRegime: "old",
        income: { salaryIncome: 400000 },
      }),
    );

    expect(senior.estimate.breakdown[1]?.value).toBe(5000);
    expect(superSenior.estimate.breakdown[1]?.value).toBe(0);
  });

  it("does not apply resident-individual rebate to non-residents", () => {
    const result = evaluateTaxApplicability(
      input({
        residentialStatus: "non-resident",
        residenceCountry: "United Arab Emirates",
        income: { salaryIncome: 1200000 },
      }),
    );

    expect(result.estimate.rebate).toBe(0);
    expect(result.estimate.totalTax).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.title === "Cross-border review required")).toBe(true);
  });

  it("warns business/profession old-regime users about opt-out compliance", () => {
    const result = evaluateTaxApplicability(
      input({
        preferredRegime: "old",
        income: { businessIncome: 900000 },
      }),
    );

    expect(result.warnings.some((warning) => warning.title === "Old-regime opt-out compliance")).toBe(true);
    expect(result.likelyForms[0]?.form).toBe("ITR-3");
  });

  it("moves simplified individual exclusions out of ITR-1", () => {
    const result = evaluateTaxApplicability(
      input({
        income: { salaryIncome: 900000 },
        flags: {
          hasForeignAssets: true,
          isCompanyDirector: true,
          holdsUnlistedEquity: true,
          hasCarryForwardLoss: true,
        },
      }),
    );

    expect(result.likelyForms[0]?.form).toBe("ITR-2");
    expect(result.warnings.some((warning) => warning.title === "Simplified return exclusions")).toBe(true);
  });

  it("requires specialist estimates for entity cases", () => {
    const result = evaluateTaxApplicability(
      input({
        taxpayerType: "domestic-company",
        income: { businessIncome: 3000000 },
      }),
    );

    expect(result.estimate.status).toBe("specialist-required");
    expect(result.likelyForms[0]?.form).toBe("ITR-6");
  });

  it("keeps presumptive individual business cases eligible for ITR-4 screening", () => {
    const result = evaluateTaxApplicability(
      input({
        income: { businessIncome: 2000000, interestIncome: 50000 },
        flags: { presumptiveIncome: true },
      }),
    );

    expect(result.likelyForms[0]?.form).toBe("ITR-4");
  });
});
