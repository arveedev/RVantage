export interface ForecastResult {
  month: number;
  balance: number;
  installment: number;
  percentage: number;
  status: 'safe' | 'warning' | 'danger';
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
  inflation: number; // Added from MPDD
}

export const calculateGhostForecast = (input: ForecastInput): ForecastResult[] => {
  const curBal = Number(input.currentBalance) || 0;
  const inc = Number(input.monthlyIncome) || 0;
  const bills = Number(input.fixedBills) || 0;
  const vSpend = Number(input.variableSpend) || 0;
  const price = Number(input.purchasePrice) || 0;
  const rate = Number(input.interestRate) || 0;
  const term = Number(input.termMonths) || 1;
  const annualInflation = Number(input.inflation || 3) / 100;

  const projections: ForecastResult[] = [];
  let runningBalance = input.isCash ? (curBal - price) : curBal;

  const i = (rate / 100) / 12;
  const n = term;
  const monthlyInstallment = (!input.isCash && price > 0)
    ? (i > 0 ? (price * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1) : price / n)
    : 0;

  for (let m = 1; m <= 24; m++) {
    const monthlyInflation = annualInflation / 12;
    const inflatedVariableSpend = vSpend * Math.pow(1 + monthlyInflation, m);
    const activeInstallment = m <= n ? monthlyInstallment : 0;
    
    const monthlyNet = inc - bills - inflatedVariableSpend - activeInstallment;
    runningBalance += monthlyNet;

    const monthlyOutflow = bills + inflatedVariableSpend + activeInstallment;
    
    let status: 'safe' | 'warning' | 'danger' = 'safe';
    if (runningBalance <= 0) status = 'danger';
    else if (runningBalance < monthlyOutflow * 1.5) status = 'warning';

    const maxReference = curBal + inc;
    const percentage = Math.max(0, Math.min(100, (runningBalance / maxReference) * 100));

    projections.push({
      month: m,
      balance: runningBalance,
      installment: activeInstallment,
      percentage,
      status
    });
  }

  return projections;
};