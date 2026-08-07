import React from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronRight } from "lucide-react";
import { REPORTS, REPORT_CATEGORIES } from "@/components/reports/reportConfigs";

export default function Reports() {
  return (
    <div className="max-w-4xl">
      {/* Cabeçalho */}
      <div className="mb-8 pb-5 border-b border-border">
        <div className="flex items-center gap-2 mb-1.5">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Central de Relatórios</span>
        </div>
        <h1 className="text-[22px] font-black text-foreground tracking-tight">Relatórios</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Selecione um relatório para configurar filtros, gerar em tela ou exportar os dados.
        </p>
      </div>

      {/* Categorias */}
      <div className="space-y-8">
        {REPORT_CATEGORIES.map((category) => (
          <section key={category}>
            <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wide mb-3">{category}</h2>
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
              {REPORTS.filter((r) => r.category === category).map((report) => (
                <Link
                  key={report.slug}
                  to={`/report/${report.slug}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/60 transition-colors group focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors">{report.title}</p>
                    <p className="text-[12px] text-muted-foreground truncate mt-0.5">{report.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}