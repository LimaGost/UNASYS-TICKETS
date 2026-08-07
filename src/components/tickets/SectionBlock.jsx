import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

// Bloco colapsável e espaçado usado na tela de detalhe do ticket —
// prioriza respiro visual: título discreto, conteúdo recolhível.
export default function SectionBlock({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left group"
      >
        <span className="text-[13px] font-semibold text-foreground flex-1">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}