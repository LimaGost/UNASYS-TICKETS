import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

export default function KPICards({ kpis }) {
  const getTrendIcon = (trend) => {
    if (!trend) return <Minus className="w-3 h-3" />;
    if (trend > 0) return <TrendingUp className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  const getTrendColor = (trend, invertColors = false) => {
    if (!trend) return "text-muted-foreground";
    const positive = invertColors ? trend < 0 : trend > 0;
    return positive ? "text-emerald-500" : "text-red-500";
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${kpi.color}18` }}
              >
                <Icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              {kpi.trend !== undefined && (
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${getTrendColor(kpi.trend, kpi.invertTrend)}`}>
                  {getTrendIcon(kpi.trend)}
                  {Math.abs(kpi.trend)}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className="text-xl font-bold" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
            {kpi.subtitle && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">{kpi.subtitle}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}