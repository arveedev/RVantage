export interface ForecastResult {
  month: number;
  balance: number;
  installment: number;
  percentage: number;
  status: 'safe' | 'warning' | 'danger';
  baseSpend: number;       // The original average spending
  inflationImpact: number; // The extra cost added by inflation ONLY
  inflatedSpend: number;   // The total spending for that month (Base + Impact)
  isBonusMonth: boolean;   // To highlight 13th month pay in the UI
}

interface ForecastInput {
  currentBalance: number;
  monthlyIncome: number;
  fixedBills: number;
  variableSpend: number;
  purchasePrice: number;
  interestRate: number;
  termMonths: number;
  isCash: boolean;
  inflation: number; // From MPDD (e.g., 3 for 3%)
}

// Seasonal spending weights (1.0 is average)
// Adjusted for NFA Field Work, Storm Season (Bicol), and Holidays
const SEASONAL_WEIGHTS = [
  1.10, // Jan: Post-holiday/Bills
  0.95, // Feb: Short month
  1.15, // Mar: NFA Field Work / Buying Station Peak
  1.15, // Apr: NFA Field Work / Buying Station Peak
  1.15, // May: NFA Field Work / Buying Station Peak
  1.10, // Jun: Enrollment/School
  1.20, // Jul: Storm Season / Stock-up Prep
  1.20, // Aug: Storm Season / Stock-up Prep
  1.20, // Sep: Storm Season / Stock-up Prep
  1.15, // Oct: NFA Field Work / Harvest Peak
  1.15, // Nov: NFA Field Work / Harvest Peak
  1.35, // Dec: Christmas/New Year/Gifts (Highest)
];

export const calculateGhostForecast = (input: ForecastInput): ForecastResult[] => {
  const inc = Number(input.monthlyIncome) || 0;
  const bills = Number(input.fixedBills) || 0;
  const vSpend = Number(input.variableSpend) || 0;
  const price = Number(input.purchasePrice) || 0;
  const rate = Number(input.interestRate) || 0;
  const term = Number(input.termMonths) || 1;
  const annualInflation = Number(input.inflation || 3) / 100;

  const projections: ForecastResult[] = [];
  
  // Ghost Isolation: Start relative to the purchase impact
  let runningBalance = input.isCash ? (0 - price) : 0;

  // Standard Amortization Formula
  const i = (rate / 100) / 12;
  const n = term;
  const monthlyInstallment = (!input.isCash && price > 0)
    ? (i > 0 ? (price * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1) : price / n)
    : 0;

  const maxMonths = Math.max(24, n + 2);
  const now = new Date();
  const startMonthIndex = now.getMonth(); // 0-11

  for (let m = 1; m <= maxMonths; m++) {
    const currentCalendarMonth = (startMonthIndex + m) % 12;
    const monthlyInflation = annualInflation / 12;
    
    // 1. Income Logic (13th Month, Mid-Year Bonus, and Subsidies)
    let monthlyTotalIncome = inc;
    let isBonusMonth = false;

    // 13th Month Bonus (December)
    if (currentCalendarMonth === 11) {
      monthlyTotalIncome += inc; 
      isBonusMonth = true;
    }

    // Mid-Year Bonus (May)
    if (currentCalendarMonth === 4) {
      monthlyTotalIncome += inc; 
      isBonusMonth = true;
    }

    // Clothing Allowance (March)
    if (currentCalendarMonth === 2) {
      monthlyTotalIncome += 7000; // Standard Government Clothing Allowance
      isBonusMonth = true;
    }

    // 2. Apply Seasonal Variance + Small Habit Jitter (±3%)
    const seasonFactor = SEASONAL_WEIGHTS[currentCalendarMonth];
    const jitter = 0.97 + (Math.random() * 0.06); 
    const adjustedBaseSpend = vSpend * seasonFactor * jitter;
    
    // 3. Compounded Inflation
    const totalInflatedVariableSpend = adjustedBaseSpend * Math.pow(1 + monthlyInflation, m);
    const inflationOnlyCost = totalInflatedVariableSpend - adjustedBaseSpend;
    
    // 4. Ghost Payment
    const activeInstallment = (!input.isCash && m <= n) ? monthlyInstallment : 0;
    
    // Total outgoings
    const totalMonthlyOutflow = bills + totalInflatedVariableSpend + activeInstallment;
    
    // Update Running Balance
    runningBalance = (runningBalance + monthlyTotalIncome) - totalMonthlyOutflow;

    let status: 'safe' | 'warning' | 'danger' = 'safe';
    if (runningBalance <= 0) {
      status = 'danger';
    } else if (runningBalance < totalMonthlyOutflow * 1.5) {
      status = 'warning';
    }

    const maxReference = inc * 12;
    const percentage = Math.max(0, Math.min(100, (runningBalance / maxReference) * 100));

    projections.push({
      month: m,
      balance: runningBalance,
      installment: activeInstallment,
      percentage,
      status,
      baseSpend: adjustedBaseSpend,
      inflationImpact: inflationOnlyCost,
      inflatedSpend: totalInflatedVariableSpend,
      isBonusMonth
    });
  }

  return projections;
};