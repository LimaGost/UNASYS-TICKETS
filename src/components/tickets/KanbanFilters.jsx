import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, UserCheck, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useAssignedFilter } from "@/lib/AssignedFilterContext";
import SearchableSelect from "@/components/ui/SearchableSelect";

export default function KanbanFilters({ 
  searchTerm, 
  setSearchTerm, 
  filters, 
  setFilters,
  clients,
  serviceTypes,
  users,
  advancedCount = 0,
  onOpenAdvanced,
  onClearAdvanced
}) {
  const { user: currentUser } = useAuth();
  const { assignedFilter, setAssignedFilter } = useAssignedFilter();

  // Sincroniza com o filtro global de Responsável (compartilhado com Relatórios).
  // O Kanban continua guardando "assigned" como array (suporta multi-seleção
  // no futuro), mas hoje só usa 1 valor — refletimos esse valor nos dois sentidos.
  const currentAssignedEmail = filters.assigned[0] || "";

  React.useEffect(() => {
    if (assignedFilter !== currentAssignedEmail) {
      setFilters(prev => ({ ...prev, assigned: assignedFilter ? [assignedFilter] : [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedFilter]);

  const handleAssignedChange = (email) => {
    setFilters({ ...filters, assigned: email ? [email] : [] });
    setAssignedFilter(email || "");
  };
  const hasActiveFilters = filters.urgency.length > 0 || 
                          filters.assigned.length > 0 || 
                          filters.client || 
                          filters.serviceType ||
                          advancedCount > 0;

  const clearFilters = () => {
    setSearchTerm("");
    setFilters({
      urgency: [],
      assigned: [],
      client: "",
      serviceType: "",
      groupBy: "none"
    });
    setAssignedFilter("");
    onClearAdvanced?.();
  };

  const urgencyOptions = [
    { value: "critica", label: "Crítica", color: "#D5666D" },
    { value: "alta", label: "Alta", color: "#D9A462" },
    { value: "media", label: "Média", color: "#7C8DC9" },
    { value: "baixa", label: "Baixa", color: "#94A3B8" }
  ];

  const toggleUrgency = (urgency) => {
    setFilters(prev => ({
      ...prev,
      urgency: prev.urgency.includes(urgency)
        ? prev.urgency.filter(u => u !== urgency)
        : [...prev.urgency, urgency]
    }));
  };

  const toggleAssigned = (email) => {
    setFilters(prev => ({
      ...prev,
      assigned: prev.assigned.includes(email)
        ? prev.assigned.filter(e => e !== email)
        : [...prev.assigned, email]
    }));
  };

  return (
    <div className="space-y-3">
      {/* Search - Full width */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por título, cliente ou solicitante..."
          className="pl-10 pr-10 h-9 text-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Urgency Filter - Inline */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Urgência:</span>
        {urgencyOptions.map(opt => {
          const active = filters.urgency.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleUrgency(opt.value)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                active
                  ? "bg-accent border-transparent text-accent-foreground font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: opt.color, opacity: active ? 1 : 0.5 }} />
              {opt.label}
            </button>
          );
        })}

        {currentUser?.email && (
          <Button
            type="button"
            variant={filters.assigned.includes(currentUser.email) && filters.assigned.length === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => {
              const isMine = filters.assigned.includes(currentUser.email) && filters.assigned.length === 1;
              handleAssignedChange(isMine ? "" : currentUser.email);
            }}
            className="h-6 px-2.5 text-xs font-medium ml-2"
          >
            <UserCheck className="w-3 h-3 mr-1.5" /> Meus tickets
          </Button>
        )}
      </div>

      {/* Selects Row - Compact */}
      <div className="flex items-end gap-3 flex-wrap">
        {/* Client Filter */}
        <div className="space-y-1 flex-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground font-medium">Cliente</label>
          <SearchableSelect
            value={filters.client}
            onValueChange={(v) => setFilters({ ...filters, client: v || "" })}
            options={clients.map(c => ({ value: c.id, label: c.name, searchTerms: [c.cnpj, c.razao_social] }))}
            placeholder="Todos"
            searchPlaceholder="Buscar cliente ou CNPJ..."
            className="[&>button]:h-8 [&>button]:text-xs"
          />
        </div>

        {/* Service Type Filter */}
        <div className="space-y-1 flex-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground font-medium">Tipo de Serviço</label>
          <SearchableSelect
            value={filters.serviceType}
            onValueChange={(v) => setFilters({ ...filters, serviceType: v || "" })}
            options={serviceTypes.map(s => ({ value: s.name, label: s.name }))}
            placeholder="Todos"
            searchPlaceholder="Buscar tipo..."
            className="[&>button]:h-8 [&>button]:text-xs"
          />
        </div>

        {/* Assigned Filter */}
        <div className="space-y-1 flex-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground font-medium">Responsável</label>
          <SearchableSelect
            value={filters.assigned[0] || ""}
            onValueChange={(v) => handleAssignedChange(v || "")}
            options={users.map(u => ({ value: u.email, label: currentUser?.email === u.email ? `${u.full_name} (você)` : u.full_name, searchTerms: [u.email] }))}
            placeholder="Todos"
            searchPlaceholder="Buscar analista..."
            className="[&>button]:h-8 [&>button]:text-xs"
          />
        </div>

        {/* Group By */}
        <div className="space-y-1 flex-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground font-medium">Agrupar</label>
          <Select value={filters.groupBy} onValueChange={(v) => setFilters({ ...filters, groupBy: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="requester">Solicitante</SelectItem>
              <SelectItem value="assigned">Responsável</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtros avançados */}
        {onOpenAdvanced && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAdvanced}
            className="h-8 px-3 text-xs gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Avançados
            {advancedCount > 0 && (
              <span className="px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] leading-4">
                {advancedCount}
              </span>
            )}
          </Button>
        )}

        {/* Clear Filters */}
        {(hasActiveFilters || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2 text-xs"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}