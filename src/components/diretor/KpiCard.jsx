import React from "react";

export default function KpiCard({ label, value, sub, icon: Icon, color = "#8b5cf6" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
        )}
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground leading-tight">{sub}</div>}
    </div>
  );
}