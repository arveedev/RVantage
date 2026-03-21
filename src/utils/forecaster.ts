// utils/forecaster.ts

export interface ForecastResult {
  month: number;
  balance: number;
  installment: number;
  percentage: number;
  status: 'safe' | 'warning' | 'danger';
  baseSpend: number;       // The original average spending
  inflationImpact: number; // The extra cost added by inflation ONLY
  inflatedSpend: number;   // The total spending for that month (Base + Impact)
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

export const calculateGhostForecast = (input: ForecastInput): ForecastResult[] => {
  const inc = Number(input.monthlyIncome) || 0;
  const bills = Number(input.fixedBills) || 0;
  const vSpend = Number(input.variableSpend) || 0;
  const price = Number(input.purchasePrice) || 0;
  const rate = Number(input.interestRate) || 0;
  const term = Number(input.termMonths) || 1;
  const annualInflation = Number(input.inflation || 3) / 100;

  const projections: ForecastResult[] = [];
  
  /**
   * FIX: GHOST ISOLATION
   * We set the starting balance to 0. 
   * This ensures we are forecasting the IMPACT on your monthly budget, 
   * not adding to your existing real-world savings.
   */
  let runningBalance = input.isCash ? (0 - price) : 0;

  // Standard Amortization Formula
  const i = (rate / 100) / 12;
  const n = term;
  const monthlyInstallment = (!input.isCash && price > 0)
    ? (i > 0 ? (price * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1) : price / n)
    : 0;

  // DYNAMIC TIMELINE: Project at least 24 months or the full term
  const maxMonths = Math.max(24, n + 2);

  for (let m = 1; m <= maxMonths; m++) {
    const monthlyInflation = annualInflation / 12;
    
    // Calculate total spend with compounded inflation
    const totalInflatedVariableSpend = vSpend * Math.pow(1 + monthlyInflation, m);
    
    // Inflation cost only
    const inflationOnlyCost = totalInflatedVariableSpend - vSpend;
    
    // Installment applies only during the term
    const activeInstallment = (!input.isCash && m <= n) ? monthlyInstallment : 0;
    
    // Total outgoings for the month
    const totalMonthlyOutflow = bills + totalInflatedVariableSpend + activeInstallment;
    
    /**
     * MATH PROCESS:
     * We start with the ghost balance, add the income, then subtract expenses.
     * This shows your cumulative "Ghost Savings" or "Ghost Debt" month by month.
     */
    runningBalance = (runningBalance + inc) - totalMonthlyOutflow;

    // Status logic: Since this is a ghost forecast, 'danger' means the purchase 
    // puts you in the negative relative to your monthly earnings.
    let status: 'safe' | 'warning' | 'danger' = 'safe';
    if (runningBalance <= 0) {
      status = 'danger';
    } else if (runningBalance < totalMonthlyOutflow * 1.5) {
      status = 'warning';
    }

    // Percentage based on a theoretical max year of income
    const maxReference = inc * 12;
    const percentage = Math.max(0, Math.min(100, (runningBalance / maxReference) * 100));

    projections.push({
      month: m,
      balance: runningBalance,
      installment: activeInstallment,
      percentage,
      status,
      baseSpend: vSpend,
      inflationImpact: inflationOnlyCost,
      inflatedSpend: totalInflatedVariableSpend
    });
  }

  return projections;
};