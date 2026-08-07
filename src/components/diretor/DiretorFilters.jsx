import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, RotateCcw } from "lucide-react";
import { DEFAULT_FILTERS } from "./useDiretorData";

const URGENCIAS = [["todas", "Todas prioridades"], ["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"], ["critica", "Crítica"]];
const STATUS = [["todos", "Todos status"], ["abertos", "Abertos"], ["fechados", "Concluídos"]];
const PERIODOS = [["7", "7 dias"], ["15", "15 dias"], ["30", "30 dias"], ["90", "90 dias"], ["180", "180 dias"], ["365", "12 meses"]];

function F({ value, onChange, options, width = "w-[150px]" }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs ${width}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function DiretorFilters({ filters, setFilters, clientes, internos, verticais }) {
  const set = (k) => (v) => setFilters(f => ({ ...f, [k]: v }));
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mr-1">
        <Filter className="w-3.5 h-3.5" /> Filtros
      </div>
      <F value={filters.periodo} onChange={set("periodo")} options={PERIODOS} width="w-[110px]" />
      <F value={filters.cliente} onChange={set("cliente")}
        options={[["todos", "Todos clientes"], ...clientes.map(c => [c, c])]} width="w-[190px]" />
      <F value={filters.colaborador} onChange={set("colaborador")}
        options={[["todos", "Todos colaboradores"], ...internos.map(u => [u.email, u.full_name || u.email])]} width="w-[190px]" />
      <F value={filters.vertical} onChange={set("vertical")}
        options={[["todos", "Todos departamentos"], ...verticais.map(v => [v, v.toUpperCase()])]} width="w-[170px]" />
      <F value={filters.urgency} onChange={set("urgency")} options={URGENCIAS} width="w-[150px]" />
      <F value={filters.status} onChange={set("status")} options={STATUS} width="w-[130px]" />
      <button onClick={() => setFilters(DEFAULT_FILTERS)}
        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted">
        <RotateCcw className="w-3 h-3" /> Limpar
      </button>
    </div>
  );
}