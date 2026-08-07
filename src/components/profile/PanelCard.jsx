import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function PanelCard({
  icon: Icon,
  title,
  accent = "#A78BFA",
  expandable = false,
  defaultOpen = true,
  action,
  actionOnClick,
  className = "",
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = expandable ? open : true;

  return (
    <div
      className={"rounded-xl flex flex-col overflow-hidden transition-all " + className}
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      <div
        onClick={expandable ? () => setOpen(!open) : undefined}
        className={"flex items-center gap-2.5 px-4 py-3.5 " + (expandable ? "cursor-pointer hover:bg-muted/30" : "")}
        style={{ borderBottom: isOpen ? "1px solid hsl(var(--border))" : "none" }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
        <span className="text-sm font-semibold text-foreground flex-1 truncate">{title}</span>
        {expandable && (
          isOpen
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex-1">{children}</div>
          {action && (
            <div className="mt-4 pt-3 border-t border-border">
              {actionOnClick ? (
                <button
                  onClick={actionOnClick}
                  className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity w-full text-right"
                  style={{ color: action.color || "#F97316" }}
                >
                  {action.label} →
                </button>
              ) : (
                <Link
                  to={action.href}
                  className="text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-opacity block text-right"
                  style={{ color: action.color || "#F97316" }}
                >
                  {action.label} →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}