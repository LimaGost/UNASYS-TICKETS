import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, Filter, RotateCcw, Lock } from "lucide-react";
import { format } from "date-fns";
import { nowBrasilia } from "@/utils/dateUtils";

export default function ReportFilters({ filters, setFilters, clients, ticketTypes, verticals, hideVerticalFilter = false, currentUserEmail = "" }) {
  const handleReset = () => {
    setFilters({ startDate: "", endDate: "", vertical: "", client: "", assigned: "", ticketType: "", status: "", period: "month" });
  };

  const quickPeriods = [
    { value: "today", label: "Hoje" },
    { value: "week", label: "Esta Semana" },
    { value: "month", label: "Este Mês" },
    { value: "quarter", label: "Este Trimestre" },
    { value: "year", label: "Este Ano" },
    { value: "custom", label: "Personalizado" }
  ];

  const handlePeriodChange = (period) => {
    if (period !== "custom") {
      // Períodos calculados no horário de Brasília
      const now = nowBrasilia();
      let start = nowBrasilia();
      switch(period) {
        case "today": start.setHours(0, 0, 0, 0); break;
        case "week": start.setDate(now.getDate() - 7); break;
        case "month": start.setMonth(now.getMonth() - 1); break;
        case "quarter": start.setMonth(now.getMonth() - 3); break;
        case "year": start.setFullYear(now.getFullYear() - 1); break;
      }
      setFilters({ ...filters, period, startDate: format(start, "yyyy-MM-dd"), endDate: format(now, "yyyy-MM-dd") });
    } else {
      setFilters({ ...filters, period });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Filtros de Relatório</h3>
          <span className="flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            <Lock className="w-3 h-3" /> Seus dados
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="w-3 h-3 mr-1.5" /> Limpar
        </Button>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {quickPeriods.map(p => (
          <button
            key={p.value}
            onClick={() => handlePeriodChange(p.value)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              filters.period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {filters.period === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Data Início
            </Label>
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Data Fim
            </Label>
            <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="h-9" />
          </div>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-3 ${hideVerticalFilter ? "md:grid-cols-4" : "md:grid-cols-5"}`}>
        {!hideVerticalFilter && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Vertical</Label>
            <Select value={filters.vertical} onValueChange={(v) => setFilters({ ...filters, vertical: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todas</SelectItem>
                {verticals.map(v => <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Select value={filters.client} onValueChange={(v) => setFilters({ ...filters, client: v })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Responsável</Label>
          <div className="h-9 px-3 rounded-lg border border-border bg-muted/40 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="w-3 h-3" /> Somente você
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Tipo de Ticket</Label>
          <Select value={filters.ticketType} onValueChange={(v) => setFilters({ ...filters, ticketType: v })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos</SelectItem>
              {ticketTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={filters.status || ""} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos</SelectItem>
              <SelectItem value="abertos">Abertos</SelectItem>
              <SelectItem value="fechados">Fechados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}