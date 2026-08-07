import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function TicketCounts({ tickets, onCountClick }) {
  const navigate = useNavigate();
  const byStatus = tickets.reduce((acc, t) => {
    const k = t.status_column_title || "Sem status";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);

  const handleTotalClick = () => {
    if (onCountClick) onCountClick();
  };

  return (
    <div>
      {/* Total com clique */}
      <div 
        onClick={handleTotalClick}
        className="flex items-baseline gap-2 mb-4 cursor-pointer group"
      >
        <span className="text-4xl font-black text-foreground leading-none group-hover:text-primary transition-colors">
          {tickets.length}
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">total</span>
          <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5" />
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum ticket no momento.</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([status, count]) => (
            <div 
              key={status} 
              onClick={() => onCountClick?.(status)}
              className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 hover:bg-muted cursor-pointer transition-colors group"
            >
              <span className="text-muted-foreground group-hover:text-foreground truncate flex-1">{status}</span>
              <span className="text-foreground font-semibold ml-2 group-hover:text-primary transition-colors">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}