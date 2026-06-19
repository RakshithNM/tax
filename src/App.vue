<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import {
  type AmountKey,
  calculateFreelancerTax,
  clampAmount,
  TAX_LIMITS,
} from "./lib/tax";

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

const result = computed(() => calculateFreelancerTax(model));
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
