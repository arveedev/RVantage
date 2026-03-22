import React from 'react';
import { 
  CheckCircle, 
  TrendingDown, 
  ShieldCheck, 
  Zap,
  Brain,
  Compass,
  ArrowDownCircle,
  ShieldAlert,
  Sparkles,
  Target
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
  
  // 1. SYSTEM INITIALIZATION: No Income
  if (baseIncome <= 0) {
    return {
      title: "Engine Standby",
      body: "Your financial engine is idling. Initialize your monthly income in the Command Center to allow the system to map your spending velocity and habit patterns.",
      icon: React.createElement(Zap, { size: 20, className: "text-aura-accent" }),
      color: "border-aura-accent/20"
    };
  }

  // 2. CRITICAL: THE "RED ZONE" (Retention < 5%)
  if (retentionRate < 5) {
    return {
      title: "Liquidity Alert",
      body: `Critical alert: You are retaining almost zero capital. With ${highestExpenseName} consuming a major share, your safety margin is non-existent. Immediate pivot required to avoid debt-looping.`,
      icon: React.createElement(ShieldAlert, { size: 20, className: "text-red-500" }),
      color: "border-red-500/40"
    };
  }

  // 3. STRUCTURAL: FIXED COST TRAP (High Fixed + Low Retention)
  if (fixedRatio > 65 && retentionRate < 15) {
    return {
      title: "Structural Rigidity",
      body: `Your high fixed costs (${fixedRatio}%) are strangling your flexibility. Since your retention is low, you are 'house-poor' or over-subscribed. Consider downsizing recurring obligations to regain agility.`,
      icon: React.createElement(ArrowDownCircle, { size: 20, className: "text-orange-400" }),
      color: "border-orange-400/20"
    };
  }

  // 4. BEHAVIORAL: LIFESTYLE LEAK (High Variable + Low Retention)
  if (variableRatio > 50 && retentionRate < 20) {
    return {
      title: "Variable Erosion",
      body: `Your lifestyle spending is currently outperforming your savings. Reducing ${highestExpenseName} by just 15% would significantly stabilize your trajectory. This is a behavioral fix, not a structural one.`,
      icon: React.createElement(Brain, { size: 20, className: "text-yellow-500" }),
      color: "border-yellow-500/20"
    };
  }

  // 5. STRATEGIC: EXPENSE DOMINANCE (Highest Expense Analysis)
  const expenseFocus = highestExpenseName.toLowerCase();
  if (retentionRate < 25) {
    if (expenseFocus.includes('food') || expenseFocus.includes('dining')) {
      return {
        title: "Culinary Overhead",
        body: "Food costs are your primary growth inhibitor. Transitioning 20% of dining out to grocery-based prep would instantly move your retention into the 'Safe' tier.",
        icon: React.createElement(Compass, { size: 20, className: "text-aura-accent" }),
        color: "border-aura-accent/20"
      };
    }
    if (expenseFocus.includes('sub') || expenseFocus.includes('bills')) {
      return {
        title: "Subscription Fatigue",
        body: "Your wealth is leaking through recurring 'micro-transactions'. Audit your digital services; these small amounts are compounding into a significant annual loss.",
        icon: React.createElement(TrendingDown, { size: 20, className: "text-blue-400" }),
        color: "border-blue-400/20"
      };
    }
  }

  // 6. POSITIVE: GROWTH PHASE (High Retention)
  if (retentionRate > 35) {
    return {
      title: "Peak Efficiency",
      body: "Strategic dominance detected. You are retaining over 35% of your inflow. This surplus should be channeled into high-yield deployments or long-term assets while maintaining this momentum.",
      icon: React.createElement(Sparkles, { size: 20, className: "text-aura-accent" }),
      color: "border-aura-accent/40"
    };
  }

  // 7. POSITIVE: DEBT SHIELD (Low Fixed + Good Retention)
  if (fixedRatio < 30 && retentionRate > 20) {
    return {
      title: "Financial Agility",
      body: "You have very low recurring debt/bills. This makes you extremely resilient to income shocks. Your current focus should be building a 'Freedom Fund' to leverage this low-overhead state.",
      icon: React.createElement(ShieldCheck, { size: 20, className: "text-green-400" }),
      color: "border-green-400/20"
    };
  }

  // 8. OPTIMIZATION: THE MID-TIER (Balanced)
  if (retentionRate >= 15 && retentionRate <= 30) {
    return {
      title: "Steady Equilibrium",
      body: `You are in a healthy maintenance phase. To reach the next tier, analyze your ${highestExpenseName} habits. A minor optimization there will push you into the 'High Efficiency' bracket.`,
      icon: React.createElement(Target, { size: 20, className: "text-aura-subtle" }),
      color: "border-white/10"
    };
  }

  // 9. DEFAULT: NEUTRAL STABILITY
  return {
    title: "Stability Protocol",
    body: "Cash flow is consistent and balanced. No immediate threats detected. Proceed with current spending patterns while monitoring for lifestyle creep.",
    icon: React.createElement(CheckCircle, { size: 20, className: "text-green-400" }),
    color: "border-green-400/20"
  };
};