import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PipelineColumn from "../components/tickets/PipelineColumn";
import KanbanFilters from "../components/tickets/KanbanFilters";
import TicketFormModal from "../components/tickets/TicketFormModal";
import ChecklistModal from "../components/tickets/ChecklistModal";
import SubStatusModal from "../components/tickets/SubStatusModal";
import EmailToTicketModal from "../components/tickets/EmailToTicketModal";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Mail, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useVerticalFilter } from "@/hooks/useVerticalFilter";
import AdvancedFiltersPanel from "../components/tickets/views/AdvancedFiltersPanel";
import BoardActionsMenu from "../components/tickets/views/BoardActionsMenu";
import { emptyAdvanced, applyAdvancedFilters, countActiveAdvanced } from "../components/tickets/views/filterUtils";

export default function Tickets() {

  const { userVertical, canAccessAllVerticals } = useVerticalFilter();
  const [showCreate, setShowCreate] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailPrefill, setEmailPrefill] = useState(null);
  const [checklistModal, setChecklistModal] = useState(null);
  const [subStatusModal, setSubStatusModal] = useState(null);

  // Persistência de filtros (busca + filtros + vertical) em localStorage
  const FILTERS_KEY = 'tickets_filters_v1';
  const SEARCH_KEY = 'tickets_search_v1';
  const VERTICAL_KEY = 'tickets_selected_vertical';

  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem(SEARCH_KEY) || "");
  const [selectedVertical, setSelectedVertical] = useState(() => localStorage.getItem(VERTICAL_KEY) || "");


  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(FILTERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { urgency: [], assigned: [], client: "", serviceType: "", groupBy: "none" };
  });

  useEffect(() => { localStorage.setItem(SEARCH_KEY, searchTerm); }, [searchTerm]);
  useEffect(() => {
    try { localStorage.setItem(FILTERS_KEY, JSON.stringify(filters)); } catch {}
  }, [filters]);

  const handleSetVertical = (code) => {
    setSelectedVertical(code);
    localStorage.setItem(VERTICAL_KEY, code);
  };

  // ── Visões salvas + filtros avançados ──
  const ADV_KEY = 'tickets_advanced_v1';
  const [advanced, setAdvanced] = useState(() => {
    try { const s = localStorage.getItem(ADV_KEY); if (s) return { ...emptyAdvanced, ...JSON.parse(s) }; } catch {}
    return { ...emptyAdvanced };
  });
  useEffect(() => { try { localStorage.setItem(ADV_KEY, JSON.stringify(advanced)); } catch {} }, [advanced]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-scroll horizontal do quadro durante o drag
  const boardRef = React.useRef(null);
  const handleBoardDragOver = (e) => {
    const el = boardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const edge = 120, speed = 22;
    if (e.clientX > rect.right - edge) el.scrollLeft += speed;
    else if (e.clientX < rect.left + edge) el.scrollLeft -= speed;
  };

  // Se usuário tem vertical restrita, forçar sempre a vertical dele (ignora localStorage)
  React.useEffect(() => {
    if (userVertical && selectedVertical !== userVertical) {
      handleSetVertical(userVertical);
    }
  }, [userVertical]);

  const queryClient = useQueryClient();
  const location = useLocation();

  // Aplica filtro vindo de outra página (ex.: Meu Perfil → contadores de tickets)
  useEffect(() => {
    const incoming = location.state?.filter;
    if (!incoming) return;
    setSearchTerm("");
    setFilters(prev => ({
      ...prev,
      urgency: [],
      client: "",
      serviceType: "",
      assigned: incoming.assigned_to ? [incoming.assigned_to] : [],
    }));
    if (incoming.vertical) handleSetVertical(incoming.vertical);
    // Limpa o state para não reaplicar ao navegar de volta
    window.history.replaceState({}, "");
  }, [location.state]);

  const { data: allVerticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Filtrar verticais: se o usuário tem vertical definida, mostrar apenas aquela
  const verticals = userVertical 
    ? allVerticals.filter(v => v.code === userVertical)
    : allVerticals;

  const { data: kanbanConfigs = [] } = useQuery({
    queryKey: ["kanbanConfigs"],
    queryFn: () => api.entities.KanbanConfig.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allTickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.entities.Ticket.list("-created_date", 1000),
    staleTime: 30 * 1000,
  });

  // Ordenar tickets por created_date e atribuir número sequencial
  const ticketsWithOrder = useMemo(() => {
    const sorted = [...allTickets].sort((a, b) => {
      const dateA = new Date(a.created_date).getTime();
      const dateB = new Date(b.created_date).getTime();
      return dateA - dateB;
    });
    
    const ticketNumberMap = new Map();
    sorted.forEach((ticket, index) => {
      ticketNumberMap.set(ticket.id, index + 1);
    });
    
    return { sorted, ticketNumberMap };
  }, [allTickets]);

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.entities.Client.list(),
  });

  const clients = userVertical 
    ? allClients.filter(c => !c.vertical || c.vertical === userVertical)
    : allClients;

  const { data: allServiceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => api.entities.ServiceType.list(),
  });

  const serviceTypes = userVertical
    ? allServiceTypes.filter(st => !st.vertical || st.vertical === userVertical)
    : allServiceTypes;

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.entities.User.list(),
  });

  // Set initial vertical - prefer saved, then vertical with most tickets, then first alphabetical
  React.useEffect(() => {
    if (verticals.length === 0) return;
    const activeSorted = [...verticals].filter(v => v.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    if (activeSorted.length === 0) return;

    // If current selection is still valid, keep it
    if (selectedVertical && activeSorted.some(v => v.code === selectedVertical)) return;

    // Try saved from localStorage
    const saved = localStorage.getItem('tickets_selected_vertical');
    if (saved && activeSorted.some(v => v.code === saved)) {
      setSelectedVertical(saved);
      return;
    }

    // Auto-select vertical with most "implantação" tickets; fall back to first alphabetical
    const counts = new Map();
    allTickets.forEach(t => {
      if (t.main_type === 'implantacao' && t.vertical) {
        counts.set(t.vertical, (counts.get(t.vertical) || 0) + 1);
      }
    });
    const bestWithTickets = activeSorted
      .map(v => ({ code: v.code, count: counts.get(v.code) || 0 }))
      .filter(v => v.count > 0)
      .sort((a, b) => b.count - a.count)[0];
    const pick = bestWithTickets?.code || activeSorted[0].code;
    handleSetVertical(pick);
  }, [verticals.length, allTickets.length, selectedVertical]);

  // Get columns for selected vertical (Implantação type) — sem fallback genérico
  // Se não houver configuração, retorna vazio para exibir o CTA "Pipeline não configurado"
  const columns = useMemo(() => {
    if (!selectedVertical) return [];

    const config = kanbanConfigs.find(
      c => c.main_type === "implantacao" &&
           c.vertical === selectedVertical &&
           c.active !== false
    );

    return (config?.columns && config.columns.length > 0) ? config.columns : [];
  }, [kanbanConfigs, selectedVertical]);

  // Filter tickets based on selected vertical and filters (only Implantação type)
  const filteredTickets = useMemo(() => {
    let filtered = allTickets.filter(t => {
      // Mostrar apenas tickets do tipo "implantação"
      if (t.main_type !== "implantacao") return false;
      // Filtrar por vertical se houver seleção (comparação case-insensitive)
      if (selectedVertical && t.vertical?.toLowerCase().trim() !== selectedVertical.toLowerCase().trim()) return false;
      return true;
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.title?.toLowerCase().includes(term) ||
        t.client_name?.toLowerCase().includes(term) ||
        t.requester?.toLowerCase().includes(term)
      );
    }

    if (filters.urgency.length > 0) {
      filtered = filtered.filter(t => filters.urgency.includes(t.urgency));
    }

    if (filters.assigned.length > 0) {
      filtered = filtered.filter(t => filters.assigned.includes(t.assigned_to));
    }

    if (filters.client) {
      filtered = filtered.filter(t => t.client_id === filters.client);
    }

    if (filters.serviceType) {
      filtered = filtered.filter(t => t.service_type === filters.serviceType);
    }

    filtered = applyAdvancedFilters(filtered, advanced);

    return filtered;
  }, [allTickets, searchTerm, filters, selectedVertical, advanced]);

  const sortedColumns = useMemo(() => {
    return [...columns].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [columns]);

  const categoryOptions = useMemo(
    () => [...new Set(allTickets.filter(t => t.main_type === "implantacao").map(t => t.category).filter(Boolean))].sort(),
    [allTickets]
  );

  const moveTicketMutation = useMutation({
    mutationFn: async ({ ticketId, columnTitle, subStatus }) => {
      const col = columns.find(c => c.title === columnTitle);
      await api.functions.invoke('updateTicketStatus', {
        ticketId,
        newStatus: columnTitle,
        columnData: col,
        subStatus: subStatus || null,
      });
    },
    // Optimistic update — move o card imediatamente no cache
    onMutate: async ({ ticketId, columnTitle, subStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["tickets"] });
      const previous = queryClient.getQueryData(["tickets"]);
      queryClient.setQueryData(["tickets"], (old = []) =>
        old.map(t => t.id === ticketId ? { ...t, status_column_title: columnTitle, sub_status: subStatus || null } : t)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["tickets"], context.previous);
      toast.error("Erro ao mover ticket");
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      setChecklistModal(null);
      setSubStatusModal(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  const handleDrop = (ticketId, columnTitle) => {
    const ticket = filteredTickets.find(t => t.id === ticketId);
    // Aborta drop na mesma coluna ou ticket inexistente
    if (!ticket || ticket.status_column_title === columnTitle) return;

    const targetColumn = columns.find(c => c.title === columnTitle);
    if (targetColumn?.sub_statuses?.length > 0) {
      // Coluna com tipos (ex: Parado) — exige escolher o tipo antes de mover
      setSubStatusModal({ ticketId, columnTitle, column: targetColumn, ticket });
    } else if (targetColumn?.required_fields && targetColumn.required_fields.length > 0) {
      setChecklistModal({ ticketId, columnTitle, column: targetColumn, ticket });
    } else {
      moveTicketMutation.mutate({ ticketId, columnTitle });
    }
  };

  const handleSubStatusConfirm = (subStatus) => {
    if (!subStatusModal) return;
    const { ticketId, columnTitle, column, ticket } = subStatusModal;
    if (column?.required_fields?.length > 0) {
      setSubStatusModal(null);
      setChecklistModal({ ticketId, columnTitle, column, ticket, subStatus });
    } else {
      moveTicketMutation.mutate({ ticketId, columnTitle, subStatus });
    }
  };

  const handleChecklistConfirm = () => {
    if (checklistModal) {
      moveTicketMutation.mutate({
        ticketId: checklistModal.ticketId,
        columnTitle: checklistModal.columnTitle,
        subStatus: checklistModal.subStatus,
      });
    }
  };

  const finalColumnTitlesKpi = useMemo(() => {
    const s = new Set();
    kanbanConfigs.forEach(cfg => cfg.columns?.forEach(col => { if (col.is_final) s.add(col.title); }));
    return s;
  }, [kanbanConfigs]);

  // Usar filteredTickets em vez de allTickets para respeitar filtro de vertical
  const implantacoesFiltered = filteredTickets;
  const totalCount = implantacoesFiltered.length;
  const openCount = implantacoesFiltered.filter(t => !finalColumnTitlesKpi.has(t.status_column_title)).length;
  const criticalCount = implantacoesFiltered.filter(t => t.urgency === "critica").length;
  const slaBreachedCount = implantacoesFiltered.filter(t => t.sla_breached).length;

  return (
    <div className="h-screen bg-background -m-6 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-card border-b border-border">

        {/* Linha 1: Título + KPIs + Ações */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Implantação</h1>
            <p className="text-[11px] mt-0.5 text-muted-foreground">
              Pipeline de projetos por vertical · {totalCount} registros
            </p>
          </div>

          <div className="flex items-center gap-6">
            {/* KPIs */}
            <div className="flex items-center gap-6">
              {[
                { label: "Total", value: totalCount },
                { label: "Abertos", value: openCount },
                { label: "Críticos", value: criticalCount, alert: criticalCount > 0 },
                { label: "SLA", value: slaBreachedCount, alert: slaBreachedCount > 0 },
              ].map(({ label, value, alert }) => (
                <div key={label} className="text-center">
                  <p className={`text-lg font-semibold leading-none tabular-nums ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
                  <p className="text-[10px] mt-1 text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Divisór */}
            <div className="w-px h-8 bg-border" />

            {/* Ações */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEmailModal(true)}
                className="gap-1.5 h-8 px-3 text-xs">
                <Mail className="w-3.5 h-3.5" /> E-mail
              </Button>
              <Button onClick={() => { setEmailPrefill(null); setShowCreate(true); }}
                className="gap-1.5 h-8 px-3 text-xs">
                <Plus className="w-3.5 h-3.5" /> Nova
              </Button>
              <BoardActionsMenu tickets={filteredTickets} />
            </div>
          </div>
        </div>

        {/* Linha 2: Pipeline progress overview */}
        {sortedColumns.length > 0 && (
          <div className="px-6 pb-3 flex items-center gap-1 overflow-x-auto">
            {sortedColumns.map((col, idx) => {
              const count = filteredTickets.filter(t => t.status_column_title === col.title).length;
              const isLast = idx === sortedColumns.length - 1;
              return (
                <div key={col.title} className="flex items-center gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md flex-shrink-0">
                   <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                     style={{ background: col.color || "hsl(var(--primary))", opacity: count > 0 ? 1 : 0.25 }} />
                   <span className={`text-[11px] whitespace-nowrap ${count > 0 ? "text-foreground" : "text-muted-foreground/50"}`}>
                     {col.title}
                   </span>
                   <span className={`text-[11px] tabular-nums ${count > 0 ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                     {count}
                   </span>
                  </div>
                  {!isLast && (
                   <ChevronRight className="w-3 h-3 flex-shrink-0 text-muted-foreground/30" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Linha 3: Verticais + Filtros */}
        <div className="px-6 pb-3 flex items-center gap-3 flex-wrap border-t border-border">
          <div className="flex items-center gap-2 flex-shrink-0 pt-3">
            {[...verticals].filter(v => v.active).sort((a, b) => a.name.localeCompare(b.name)).map((v) => (
              <motion.button
                key={v.id}
                onClick={() => handleSetVertical(v.code)}
                whileTap={{ scale: 0.97 }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedVertical === v.code
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                }`}
              >
                {v.name}
              </motion.button>
            ))}
          </div>
          <div className="flex-1 pt-3">
            <KanbanFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filters={filters}
              setFilters={setFilters}
              clients={clients}
              serviceTypes={serviceTypes}
              users={users}
              advancedCount={countActiveAdvanced(advanced)}
              onOpenAdvanced={() => setShowAdvanced(true)}
              onClearAdvanced={() => setAdvanced({ ...emptyAdvanced })}
            />
          </div>
        </div>
      </div>

      {/* Pipeline Board */}
      <div
        ref={boardRef}
        onDragOver={handleBoardDragOver}
        className="flex-1 overflow-auto px-6 py-5"
      >
        <AnimatePresence mode="wait">
          {sortedColumns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full h-96 flex items-center justify-center"
            >
              <div className="max-w-sm text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Settings className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground mb-1">Pipeline não configurado</h3>
                  <p className="text-muted-foreground text-sm">
                    Configure as etapas para <span className="text-primary">{verticals.find(v => v.code === selectedVertical)?.name}</span>
                  </p>
                </div>
                <Link to={createPageUrl("KanbanConfig")}>
                  <Button className="gap-2 mt-2">
                    <Settings className="w-4 h-4" /> Configurar Pipeline
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={selectedVertical}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex gap-3 h-full"
              style={{ minWidth: "max-content" }}
            >
              {sortedColumns.map((col, idx) => {
                const allColumnTitles = new Set(sortedColumns.map(c => c.title));
                const ticketsInColumn = filteredTickets.filter(t => {
                  if (idx === 0) {
                    // Primeira coluna: inclui tickets sem status ou com status não reconhecido
                    return t.status_column_title === col.title || !t.status_column_title || !allColumnTitles.has(t.status_column_title);
                  }
                  return t.status_column_title === col.title;
                });
                return (
                  <motion.div
                    key={`${selectedVertical}-${col.title}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                    className="h-full"
                    style={{ width: 264 }}
                  >
                    <PipelineColumn
                      column={col}
                      tickets={ticketsInColumn}
                      ticketNumberMap={ticketsWithOrder.ticketNumberMap}
                      onDrop={handleDrop}
                      onNewTicket={idx === 0 ? () => { setEmailPrefill(null); setShowCreate(true); } : null}
                      isFirst={idx === 0}
                      isLast={idx === sortedColumns.length - 1}
                      groupBy={filters.groupBy}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TicketFormModal
        open={showCreate}
        onOpenChange={(v) => { setShowCreate(v); if (!v) setEmailPrefill(null); }}
        mainType={emailPrefill?.main_type || "implantacao"}
        defaultVertical={selectedVertical}
        prefillData={emailPrefill}
        onTicketCreated={(ticket) => {
          if (ticket?.vertical && ticket.vertical !== selectedVertical) {
            handleSetVertical(ticket.vertical);
          }
        }}
      />

      <EmailToTicketModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        onTicketPrefilled={(data) => {
          setEmailPrefill(data);
          setShowEmailModal(false);
          setShowCreate(true);
        }}
      />

      <AdvancedFiltersPanel
        open={showAdvanced}
        onOpenChange={setShowAdvanced}
        adv={advanced}
        setAdv={setAdvanced}
        categories={categoryOptions}
        statuses={sortedColumns.map(c => c.title)}
      />

      {subStatusModal && (
        <SubStatusModal
          open={!!subStatusModal}
          onClose={() => setSubStatusModal(null)}
          onConfirm={handleSubStatusConfirm}
          column={subStatusModal.column}
          ticket={subStatusModal.ticket}
        />
      )}

      {checklistModal && (
        <ChecklistModal
          open={!!checklistModal}
          onClose={() => setChecklistModal(null)}
          onConfirm={handleChecklistConfirm}
          column={checklistModal.column}
          ticket={checklistModal.ticket}
        />
      )}
    </div>
  );
}