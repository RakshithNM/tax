<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import {
  type AmountKey,
  calculateFreelancerTax,
  clampAmount,
  TAX_LIMITS,
} from "./lib/tax";
import {
  evaluateTaxApplicability,
  type ApplicabilityFlags,
  type ApplicabilityIncomeInput,
  type TaxApplicabilityInput,
} from "./lib/taxApplicability";
import {
  AGE_BAND_LABELS,
  REGIME_LABELS,
  RESIDENTIAL_STATUS_LABELS,
  TAX_YEAR,
  TAXPAYER_LABELS,
  type AgeBand,
  type ResidentialStatus,
  type TaxRegime,
  type TaxpayerType,
} from "./lib/taxRules";

const GUMROAD_PRODUCT_LINK = "https://bellare.gumroad.com/l/tiffp";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const model = reactive({
  grossReceipts: 4500000,
  digitalReceiptsAtLeast95: true,
  savingsBankInterest: 0,
  fixedDepositInterest: 0,
  dividendIncome: 0,
  realizedLtcg: 0,
});

const checker = reactive<TaxApplicabilityInput>({
  taxpayerType: "individual",
  residentialStatus: "resident",
  residenceCountry: "India",
  ageBand: "below-60",
  preferredRegime: "new",
  income: {
    salaryIncome: 1200000,
    housePropertyIncome: 0,
    businessIncome: 0,
    capitalGains112A: 0,
    otherCapitalGains: 0,
    interestIncome: 25000,
    dividendIncome: 0,
    otherIncome: 0,
    agriculturalIncome: 0,
  },
  flags: {
    presumptiveIncome: false,
    hasForeignAssets: false,
    isCompanyDirector: false,
    holdsUnlistedEquity: false,
    hasCarryForwardLoss: false,
    auditRequired: false,
    internationalTransaction: false,
    hasSpecialRateIncome: false,
  },
});

const amountFields = [
  {
    key: "grossReceipts",
    label: "Annual Gross Freelance Receipts",
    max: TAX_LIMITS.maxReceipts,
    step: 1000,
    rangeStep: 10000,
    hint: "Accepted range: ₹0 to ₹75,00,000",
  },
  {
    key: "savingsBankInterest",
    label: "Savings Bank Interest",
    max: TAX_LIMITS.maxAmountInput,
    step: 100,
    rangeStep: 1000,
    hint: "Ordinary interest income included in new-regime slab calculation",
  },
  {
    key: "fixedDepositInterest",
    label: "Fixed Deposit Interest",
    max: TAX_LIMITS.maxAmountInput,
    step: 100,
    rangeStep: 1000,
    hint: "FD interest is treated as ordinary income in this planner",
  },
  {
    key: "dividendIncome",
    label: "Dividend Income",
    max: TAX_LIMITS.maxAmountInput,
    step: 100,
    rangeStep: 1000,
    hint: "Dividend income is included in ordinary slab income for this planner",
  },
  {
    key: "realizedLtcg",
    label: "Current Realized Mutual Fund LTCG",
    max: TAX_LIMITS.maxAmountInput,
    step: 1000,
    rangeStep: 5000,
    hint: "Locked-in gains already realized this year",
  },
] satisfies Array<{
  key: AmountKey;
  label: string;
  max: number;
  step: number;
  rangeStep: number;
  hint: string;
}>;

const taxpayerOptions = [
  { value: "individual", label: TAXPAYER_LABELS.individual },
  { value: "huf", label: TAXPAYER_LABELS.huf },
  { value: "domestic-company", label: TAXPAYER_LABELS["domestic-company"] },
  { value: "foreign-company", label: TAXPAYER_LABELS["foreign-company"] },
  { value: "firm-llp", label: TAXPAYER_LABELS["firm-llp"] },
  { value: "aop-boi-trust-ajp", label: TAXPAYER_LABELS["aop-boi-trust-ajp"] },
  { value: "local-authority", label: TAXPAYER_LABELS["local-authority"] },
] satisfies Array<{ value: TaxpayerType; label: string }>;

const residentialStatusOptions = [
  { value: "resident", label: RESIDENTIAL_STATUS_LABELS.resident },
  { value: "rnor", label: RESIDENTIAL_STATUS_LABELS.rnor },
  { value: "non-resident", label: RESIDENTIAL_STATUS_LABELS["non-resident"] },
] satisfies Array<{ value: ResidentialStatus; label: string }>;

const ageBandOptions = [
  { value: "below-60", label: AGE_BAND_LABELS["below-60"] },
  { value: "60-79", label: AGE_BAND_LABELS["60-79"] },
  { value: "80-plus", label: AGE_BAND_LABELS["80-plus"] },
] satisfies Array<{ value: AgeBand; label: string }>;

const regimeOptions = [
  { value: "new", label: REGIME_LABELS.new },
  { value: "old", label: REGIME_LABELS.old },
] satisfies Array<{ value: TaxRegime; label: string }>;

const residenceCountries = [
  "India",
  "United Arab Emirates",
  "United States",
  "United Kingdom",
  "Singapore",
  "Canada",
  "Australia",
  "Other",
];

const checkerAmountFields = [
  {
    key: "salaryIncome",
    label: "Salary / Pension",
    hint: "Ordinary income from employer, pension or similar receipts",
  },
  {
    key: "housePropertyIncome",
    label: "House Property Income",
    hint: "Net taxable house-property income after any self-computed adjustment",
  },
  {
    key: "businessIncome",
    label: "Business / Profession Income",
    hint: "Profit or presumptive income from business, freelance or profession",
  },
  {
    key: "capitalGains112A",
    label: "Equity LTCG u/s 112A",
    hint: "Listed-equity or equity mutual fund LTCG screened against ₹1.25L",
  },
  {
    key: "otherCapitalGains",
    label: "Other Capital Gains",
    hint: "Property, debt fund, STCG or other gains requiring fuller review",
  },
  {
    key: "interestIncome",
    label: "Interest Income",
    hint: "Savings, fixed deposit or bond interest",
  },
  {
    key: "dividendIncome",
    label: "Dividend Income",
    hint: "Domestic or foreign dividends entered before withholding credits",
  },
  {
    key: "otherIncome",
    label: "Other Sources",
    hint: "Other taxable income not captured above",
  },
  {
    key: "agriculturalIncome",
    label: "Agricultural Income",
    hint: "Used for return-form screening; partial integration is not calculated",
  },
] satisfies Array<{ key: keyof ApplicabilityIncomeInput; label: string; hint: string }>;

const checkerFlags = [
  {
    key: "presumptiveIncome",
    label: "Presumptive income case",
  },
  {
    key: "hasForeignAssets",
    label: "Foreign assets / signing authority",
  },
  {
    key: "isCompanyDirector",
    label: "Company director",
  },
  {
    key: "holdsUnlistedEquity",
    label: "Unlisted equity holding",
  },
  {
    key: "hasCarryForwardLoss",
    label: "Carried-forward loss",
  },
  {
    key: "auditRequired",
    label: "Tax audit may apply",
  },
  {
    key: "internationalTransaction",
    label: "International transaction",
  },
  {
    key: "hasSpecialRateIncome",
    label: "Special-rate income",
  },
] satisfies Array<{ key: keyof ApplicabilityFlags; label: string }>;

const result = computed(() => calculateFreelancerTax(model));
const checkerResult = computed(() => evaluateTaxApplicability(checker));
const hasScrolled = ref(false);

const ltcgProgress = computed(() =>
  Math.min((result.value.ltcgUsed / TAX_LIMITS.ltcgFreeThreshold) * 100, 100),
);

const receiptProgress = computed(() =>
  Math.min((model.grossReceipts / TAX_LIMITS.maxReceipts) * 100, 100),
);

const profitProgress = computed(() =>
  Math.min((result.value.deemedProfit / (TAX_LIMITS.maxReceipts / 2)) * 100, 100),
);

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(value));
}

function updateAmount(key: AmountKey, value: unknown): void {
  const max = key === "grossReceipts" ? TAX_LIMITS.maxReceipts : TAX_LIMITS.maxAmountInput;
  model[key] = clampAmount(value, max);
}

function handleAmountInput(key: AmountKey, event: Event): void {
  updateAmount(key, (event.target as HTMLInputElement).value);
}

function updateCheckerAmount(key: keyof ApplicabilityIncomeInput, value: unknown): void {
  checker.income[key] = clampAmount(value, 1000000000);
}

function handleCheckerAmountInput(
  key: keyof ApplicabilityIncomeInput,
  event: Event,
): void {
  updateCheckerAmount(key, (event.target as HTMLInputElement).value);
}

function handleKitDownload(event: MouseEvent): void {
  if (GUMROAD_PRODUCT_LINK.includes("your-product-link")) {
    event.preventDefault();
  }
}

function updateScrollState(): void {
  hasScrolled.value = window.scrollY > 24;
}

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(() => {
  updateScrollState();
  window.addEventListener("scroll", updateScrollState, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", updateScrollState);
});
</script>

<template>
  <main class="tax-app">
    <nav class="top-nav" :class="{ 'is-scrolled': hasScrolled }" aria-label="Primary">
      <a href="#calculator">CALCULATE</a>
      <a href="#applicability">CHECK</a>
      <button
        class="wordmark wordmark-button"
        type="button"
        aria-label="Freelancer Tax Optimizer"
        @click="scrollToTop"
      >
        TAX OPTIMIZER
      </button>
      <a href="#kit">KIT</a>
    </nav>

    <section class="hero-band" aria-label="Freelancer tax optimization">
      <div class="hero-copy">
        <p class="caption-overlay">FY 2026-27 / FREELANCE RECEIPTS / EQUITY LTCG</p>
        <h1>FREELANCER TAX OPTIMIZATION</h1>
        <p>
          A precise planning surface for presumptive income, realized capital gains,
          and the annual harvesting threshold.
        </p>
        <a class="button-primary" href="#calculator">CALCULATE POSITION</a>
      </div>
    </section>

    <section class="intro-band" aria-label="Planning summary">
      <p>
        Enter receipts and portfolio gains. The calculator separates business slab tax,
        bank interest, dividend income, and realized equity LTCG tax without leaving
        the page.
      </p>
      <dl>
        <div>
          <dt>DEEMED PROFIT</dt>
          <dd>50%</dd>
        </div>
        <div>
          <dt>REBATE BAND</dt>
          <dd>₹12L</dd>
        </div>
        <div>
          <dt>LTCG THRESHOLD</dt>
          <dd>₹1.25L</dd>
        </div>
      </dl>
    </section>

    <section
      class="applicability-section"
      id="applicability"
      aria-label="Income tax applicability checker"
    >
      <form class="checker-panel" aria-describedby="checker-disclaimer">
        <div class="section-heading">
          <p class="caption-overlay">{{ TAX_YEAR.assessmentYear }} / ALL TAXPAYER CHECKER</p>
          <h2>Which tax rules apply?</h2>
        </div>

        <p class="strict-disclaimer" id="checker-disclaimer">
          Strict compliance note: this is educational screening only, not tax, legal
          or investment advice. It does not replace a CA, tax counsel, DTAA review,
          audit review or final return-form validation.
        </p>

        <div class="checker-grid">
          <label class="select-control">
            <span>Taxpayer category</span>
            <select v-model="checker.taxpayerType">
              <option
                v-for="option in taxpayerOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="select-control">
            <span>Residential status</span>
            <select v-model="checker.residentialStatus">
              <option
                v-for="option in residentialStatusOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="select-control">
            <span>Country of residence</span>
            <select v-model="checker.residenceCountry">
              <option
                v-for="country in residenceCountries"
                :key="country"
                :value="country"
              >
                {{ country }}
              </option>
            </select>
          </label>

          <label class="select-control">
            <span>Age band</span>
            <select v-model="checker.ageBand">
              <option
                v-for="option in ageBandOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="select-control">
            <span>Tax regime to estimate</span>
            <select v-model="checker.preferredRegime">
              <option
                v-for="option in regimeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <div class="checker-income-grid">
          <div
            v-for="field in checkerAmountFields"
            :key="field.key"
            class="amount-control checker-amount"
          >
            <div class="amount-label">
              <label :for="`checker-${field.key}`">{{ field.label }} (₹)</label>
              <output :for="`checker-${field.key}`">
                {{ formatCurrency(checker.income[field.key]) }}
              </output>
            </div>
            <input
              :id="`checker-${field.key}`"
              :name="field.key"
              :value="checker.income[field.key]"
              min="0"
              step="1000"
              type="number"
              inputmode="numeric"
              @input="handleCheckerAmountInput(field.key, $event)"
            />
            <p>{{ field.hint }}</p>
          </div>
        </div>

        <fieldset class="checker-flags">
          <legend>Special facts</legend>
          <label v-for="flag in checkerFlags" :key="flag.key">
            <input v-model="checker.flags[flag.key]" type="checkbox" />
            <span>{{ flag.label }}</span>
          </label>
        </fieldset>
      </form>

      <section class="checker-results" aria-label="Tax applicability result">
        <div class="result-lede">
          <p class="caption-overlay">SCREENING RESULT</p>
          <h2>{{ checkerResult.heading }}</h2>
          <p>{{ checkerResult.summary }}</p>
        </div>

        <div class="estimate-card" :class="`is-${checkerResult.estimate.status}`">
          <span>{{ checkerResult.estimate.title }}</span>
          <strong>
            {{
              checkerResult.estimate.status === "available"
                ? formatCurrency(checkerResult.estimate.totalTax)
                : "Review required"
            }}
          </strong>
          <p>{{ checkerResult.estimate.detail }}</p>
          <dl
            v-if="checkerResult.estimate.breakdown.length"
            class="tax-breakdown"
          >
            <div
              v-for="line in checkerResult.estimate.breakdown"
              :key="line.label"
            >
              <dt>{{ line.label }}</dt>
              <dd>{{ formatCurrency(line.value) }}</dd>
            </div>
          </dl>
        </div>

        <div class="checker-result-group">
          <h3>What applies</h3>
          <article
            v-for="item in checkerResult.applicability"
            :key="item.title"
            class="rule-item"
            :class="`level-${item.level}`"
          >
            <span>{{ item.level }}</span>
            <h4>{{ item.title }}</h4>
            <p>{{ item.detail }}</p>
          </article>
        </div>

        <div class="checker-result-group">
          <h3>Likely return path</h3>
          <article
            v-for="form in checkerResult.likelyForms"
            :key="form.form"
            class="rule-item"
          >
            <span>{{ form.form }}</span>
            <h4>{{ form.title }}</h4>
            <p>{{ form.detail }}</p>
          </article>
        </div>

        <div class="checker-result-group">
          <h3>Needs review</h3>
          <article
            v-for="warning in checkerResult.warnings"
            :key="warning.title"
            class="rule-item level-review"
          >
            <span>{{ warning.level }}</span>
            <h4>{{ warning.title }}</h4>
            <p>{{ warning.detail }}</p>
          </article>
        </div>

        <details class="assumption-box">
          <summary>Review assumptions and official sources</summary>
          <ul>
            <li v-for="assumption in checkerResult.assumptions" :key="assumption">
              {{ assumption }}
            </li>
          </ul>
          <div class="source-list">
            <a
              v-for="source in checkerResult.sources"
              :key="source.id"
              :href="source.url"
              target="_blank"
              rel="noreferrer"
            >
              {{ source.label }}
            </a>
          </div>
        </details>
      </section>
    </section>

    <section class="calculator-section" id="calculator" aria-label="Freelancer tax calculator">
      <form class="input-studio" id="input-matrix">
        <div class="section-heading">
          <p class="caption-overlay">INPUT MATRIX</p>
          <h2>Receipts and portfolio gains</h2>
        </div>

          <div
            v-for="field in amountFields"
            :key="field.key"
            class="amount-control"
          >
            <div class="amount-label">
              <label :for="field.key">{{ field.label }} (₹)</label>
              <output :for="`${field.key} ${field.key}Range`">
                {{ formatCurrency(model[field.key]) }}
              </output>
            </div>
            <input
              :id="field.key"
              :name="field.key"
              :value="model[field.key]"
              :max="field.max"
              :step="field.step"
              min="0"
              type="number"
              inputmode="numeric"
              @input="handleAmountInput(field.key, $event)"
            />
            <input
              :id="`${field.key}Range`"
              :value="model[field.key]"
              :max="field.max"
              :step="field.rangeStep"
              min="0"
              type="range"
              :aria-label="`${field.label} slider`"
              @input="handleAmountInput(field.key, $event)"
            />
            <p>{{ field.hint }}</p>
          </div>

          <fieldset class="receipt-mode">
            <legend>Mode of Receipts</legend>
            <div class="segmented-control">
              <label>
                <input
                  v-model="model.digitalReceiptsAtLeast95"
                  type="radio"
                  name="digitalReceipts"
                  :value="true"
                />
                <span>Digital ≥ 95%</span>
              </label>
              <label>
                <input
                  v-model="model.digitalReceiptsAtLeast95"
                  type="radio"
                  name="digitalReceipts"
                  :value="false"
                />
                <span>Digital &lt; 95%</span>
              </label>
            </div>
          </fieldset>
      </form>

      <section class="result-studio" id="output-engine" aria-label="Instant calculation output">
        <div class="result-lede">
          <p class="caption-overlay">REAL-TIME OUTPUT</p>
          <h2>{{ formatCurrency(result.deemedProfit) }}</h2>
          <p>Deemed taxable business profit. Exactly 50% of gross receipts.</p>
        </div>

        <div class="spec-grid" aria-label="Receipt and profit meter">
          <div class="spec-cell">
            <span>Gross receipts</span>
            <strong>{{ formatCurrency(model.grossReceipts) }}</strong>
            <div class="track">
              <i :style="{ width: `${receiptProgress}%` }"></i>
            </div>
          </div>
          <div class="spec-cell">
            <span>Taxable profit</span>
            <strong>{{ formatCurrency(result.deemedProfit) }}</strong>
            <div class="track">
              <i :style="{ width: `${profitProgress}%` }"></i>
            </div>
          </div>
          <div class="spec-cell">
            <span>Bank interest</span>
            <strong>{{ formatCurrency(result.interestIncome) }}</strong>
          </div>
          <div class="spec-cell">
            <span>Dividend income</span>
            <strong>{{ formatCurrency(result.dividendIncome) }}</strong>
          </div>
          <div class="spec-cell">
            <span>Regular slab income</span>
            <strong>{{ formatCurrency(result.regularIncome) }}</strong>
          </div>
          <div class="spec-cell">
            <span>Unused LTCG threshold</span>
            <strong>{{ formatCurrency(result.unusedLtcgThreshold) }}</strong>
          </div>
        </div>

        <div class="number-row">
          <article>
            <span>Estimated Tax Liability</span>
            <strong>{{ formatCurrency(result.totalTaxLiability) }}</strong>
            <dl class="tax-breakdown">
              <div>
                <dt>Slab tax before relief</dt>
                <dd>{{ formatCurrency(result.regularIncomeTaxBeforeRelief) }}</dd>
              </div>
              <div>
                <dt>87A / marginal relief</dt>
                <dd>{{ formatCurrency(-result.regularIncomeTaxRelief) }}</dd>
              </div>
              <div>
                <dt>Regular tax after relief</dt>
                <dd>{{ formatCurrency(result.regularIncomeTax) }}</dd>
              </div>
              <div>
                <dt>Realized LTCG tax</dt>
                <dd>{{ formatCurrency(result.realizedLtcgTax) }}</dd>
              </div>
              <div>
                <dt>Health &amp; Education Cess</dt>
                <dd>{{ formatCurrency(result.healthEducationCess) }}</dd>
              </div>
            </dl>
            <p>Presumptive profit, bank interest, and dividends use new-regime slabs, then Section 87A rebate and marginal relief up to ₹12L of normal income. Realized LTCG is taxed separately. Final liability includes 4% cess on base tax.</p>
          </article>
          <article>
            <span>LTCG Threshold Used</span>
            <strong>{{ formatCurrency(result.ltcgUsed) }} / ₹1,25,000</strong>
            <dl class="tax-breakdown">
              <div>
                <dt>Unused threshold</dt>
                <dd>{{ formatCurrency(result.unusedLtcgThreshold) }}</dd>
              </div>
              <div>
                <dt>Taxable realized LTCG</dt>
                <dd>{{ formatCurrency(result.taxableRealizedLtcg) }}</dd>
              </div>
            </dl>
            <div class="track threshold-track" aria-hidden="true">
              <i :style="{ width: `${ltcgProgress}%` }"></i>
            </div>
          </article>
        </div>

        <article
          v-if="result.boundaryBreach"
          class="boundary-alert"
          aria-live="polite"
        >
          <span>Presumptive boundary warning</span>
          <p>
            Receipts above ₹50,00,000 need digital receipts of at least 95% to rely on
            the expanded ₹75,00,000 threshold.
          </p>
        </article>

        <div id="harvest" class="harvest-results">
          <article class="premium-harvest-callout">
            <span>Learn legal ways to save tax</span>
            <p>
              Gain insights into advanced tax gain/loss harvesting ideas, advanced tax payment, receiving inward remittances as Freelance Professional
            </p>
          </article>
        </div>

        <a
          class="button-primary kit-button"
          id="kit"
          :href="GUMROAD_PRODUCT_LINK"
          @click="handleKitDownload"
        >
          Download the Complete Freelancer Tax Optimization &amp; Harvesting Kit (₹499)
        </a>
      </section>
    </section>

    <footer class="site-footer">
      <div>
        <span>50% deemed profit</span>
        <span>Interest and dividends included in slab income</span>
        <span>Portfolio gain/loss harvesting in premium kit</span>
        <span>₹12L new-regime rebate band</span>
        <span>₹1.25L equity LTCG threshold</span>
        <span>Includes 4% cess; excludes GST, surcharge, and filing advice</span>
      </div>
      <button class="wordmark wordmark-button" type="button" @click="scrollToTop">
        TAX OPTIMIZER
      </button>
    </footer>
  </main>
</template>
