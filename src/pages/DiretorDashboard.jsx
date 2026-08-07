import React, { useState } from "react";
import {
  Shield, LayoutDashboard, TrendingUp, Users, Clock, BarChart2, ScrollText, BellRing
} from "lucide-react";
import { useDiretorData, DEFAULT_FILTERS } from "@/components/diretor/useDiretorData";
import DiretorFilters from "@/components/diretor/DiretorFilters";
import ExecutiveTab from "@/components/diretor/ExecutiveTab";
import EscalationsTab from "@/components/diretor/EscalationsTab";
import TeamTab from "@/components/diretor/TeamTab";
import HoursTab from "@/components/diretor/HoursTab";
import IndicatorsTab from "@/components/diretor/IndicatorsTab";
import AuditTab from "@/components/diretor/AuditTab";
import AlertsTab from "@/components/diretor/AlertsTab";

const TABS = [
  { key: "executivo", label: "Executivo", icon: LayoutDashboard, Comp: ExecutiveTab },
  { key: "escalonamentos", label: "Escalonamentos", icon: TrendingUp, Comp: EscalationsTab },
  { key: "equipe", label: "Equipe", icon: Users, Comp: TeamTab },
  { key: "horas", label: "Horas", icon: Clock, Comp: HoursTab },
  { key: "indicadores", label: "Indicadores", icon: BarChart2, Comp: IndicatorsTab },
  { key: "auditoria", label: "Auditoria", icon: ScrollText, Comp: AuditTab },
  { key: "alertas", label: "Alertas", icon: BellRing, Comp: AlertsTab },
];

export default function DiretorDashboard() {
  const [tab, setTab] = useState("executivo");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const data = useDiretorData(filters);

  const ActiveComp = TABS.find(t => t.key === tab)?.Comp || ExecutiveTab;
  const alertCount = data.allEscalations.filter(e => e.status === "aberto").length;

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Painel do Diretor</h1>
        </div>
        <p className="text-sm text-muted-foreground">Central de Inteligência Operacional — KPIs, escalonamentos, equipe, horas, auditoria e alertas</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.key === "escalonamentos" && alertCount > 0 && (
                <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <DiretorFilters filters={filters} setFilters={setFilters}
        clientes={data.clientes} internos={data.internos} verticais={data.verticais} />

      {/* Active tab */}
      <ActiveComp data={data} />
    </div>
  );
}