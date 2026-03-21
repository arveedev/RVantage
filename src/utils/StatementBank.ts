// src/utils/StatementBank.ts

import React from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  TrendingDown, 
  Lightbulb, 
  ShieldCheck, 
  Zap
} from 'lucide-react';

export interface FinancialInsight {
  title: string;
  body: string;
  icon: React.ReactNode;
  color: string;
}

export const getFinancialInsight = (
  baseIncome: number,
  retentionRate: number,
  variableRatio: number,
  fixedRatio: number,
  highestExpenseName: string
): FinancialInsight => {
  
  // 1. Critical: No Income
  if (baseIncome <= 0) {
    return {
      title: "No Inflow Detected",
      body: "Initialize your monthly income in the Command Center to unlock deeper habit analytics.",
      icon: React.createElement(Zap, { size: 20, className: "text-aura-accent" }),
      color: "border-aura-accent/20"
    };
  }

  // 2. Critical: Low Retention (Spending too much)
  if (retentionRate < 10) {
    return {
      title: "Critical Margin",
      body: `You are retaining less than 10% of your income. Your spending on ${highestExpenseName} is a primary factor. Seek immediate optimization.`,
      icon: React.createElement(AlertTriangle, { size: 20, className: "text-red-500" }),
      color: "border-red-500/20"
    };
  }

  // 3. Warning: Variable Bloat
  if (variableRatio > 60) {
    return {
      title: "Lifestyle Bloat",
      body: "Your variable habits outweigh your fixed needs. This is the most flexible area to cut back and increase your safety net.",
      icon: React.createElement(TrendingDown, { size: 20, className: "text-yellow-500" }),
      color: "border-yellow-500/20"
    };
  }

  // 4. Warning: Fixed Heavy
  if (fixedRatio > 70) {
    return {
      title: "Fixed Heavy",
      body: "High recurring obligations detected. Consider downsizing subscriptions or fixed costs to regain financial agility.",
      icon: React.createElement(ShieldCheck, { size: 20, className: "text-blue-400" }),
      color: "border-blue-400/20"
    };
  }

  // 5. Positive: High Efficiency
  if (retentionRate > 30) {
    return {
      title: "High Efficiency",
      body: "Exceptional retention detected. Your current path is highly sustainable. Consider aggressive wealth-building deployments.",
      icon: React.createElement(Lightbulb, { size: 20, className: "text-aura-accent" }),
      color: "border-aura-accent/30"
    };
  }

  // 6. Default: Balanced
  return {
    title: "Stability Detected",
    body: "Your cash flow is currently balanced. Maintain this equilibrium to ensure long-term financial health.",
    icon: React.createElement(CheckCircle, { size: 20, className: "text-green-400" }),
    color: "border-green-400/20"
  };
};