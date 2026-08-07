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
import { Plus, Settings, Mail, ChevronRight, Headphones, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useVerticalFilter } from "@/hooks/useVerticalFilter";
import AdvancedFiltersPanel from "../components/tickets/views/AdvancedFiltersPanel";
import BoardActionsMenu from "../components/tickets/views/BoardActionsMenu";
import { emptyAdvanced, applyAdvancedFilters, countActiveAdvanced } from "../components/tickets/views/filterUtils";

const ACCENT = "#10B981";
const ACCENT_DARK = "#059669";

export default function Suporte() {
  const { userVertical } = useVerticalFilter();
  const [showCreate, setShowCreate] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailPrefill, setEmailPrefill] = useState(null);
  const [checklistModal, setChecklistModal] = useState(null);
  const [subStatusModal, setSubStatusModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVertical, setSelectedVertical] = useState("");
  const [filters, setFilters] = useState({
    urgency: [],
    assigned: [],
    client: "",
    serviceType: "",
    groupBy: "none"
  });
  const queryClient = useQueryClient();

  // ── Filtros avançados ──
  const [advanced, setAdvanced] = useState({ ...emptyAdvanced });
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

  const { data: allVerticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const verticals = userVertical
    ? allVerticals.filter(v => v.code === userVertical)
    : allVerticals;

  const { data: kanbanConfigs = [] } = useQuery({
    queryKey: ["kanbanConfigs"],
    queryFn: () => api.entities.KanbanConfig.list(),
  });

  const { data: allTickets = [] } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.entities.Ticket.list(),
  });

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

  useEffect(() => {
    if (!selectedVertical && verticals.length > 0) {
      setSelectedVertical(verticals.find(v => v.active)?.code || verticals[0]?.code);
    }
  }, [verticals, selectedVertical]);

  const columns = useMemo(() => {
    if (!selectedVertical) return [];
    const config = kanbanConfigs.find(
      c => c.main_type === "suporte" &&
           c.vertical === selectedVertical &&
           c.active !== false
    );
    return config?.columns?.length > 0 ? config.columns : [];
  }, [kanbanConfigs, selectedVertical]);

  const filteredTickets = useMemo(() => {
    let filtered = allTickets.filter(t =>
      t.main_type === "suporte" && t.vertical === selectedVertical
    );
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.title?.toLowerCase().includes(term) ||
        t.client_name?.toLowerCase().includes(term) ||
        t.requester?.toLowerCase().includes(term)
      );
    }
    if (filters.urgency.length > 0) filtered = filtered.filter(t => filters.urgency.includes(t.urgency));
    if (filters.assigned.length > 0) filtered = filtered.filter(t => filters.assigned.includes(t.assigned_to));
    if (filters.client) filtered = filtered.filter(t => t.client_id === filters.client);
    if (filters.serviceType) filtered = filtered.filter(t => t.service_type === filters.serviceType);
    filtered = applyAdvancedFilters(filtered, advanced);
    return filtered;
  }, [allTickets, searchTerm, filters, selectedVertical, advanced]);

  const sortedColumns = useMemo(() =>
    [...columns].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [columns]
  );

  const categoryOptions = useMemo(
    () => [...new Set(allTickets.filter(t => t.main_type === "suporte").map(t => t.category).filter(Boolean))].sort(),
    [allTickets]
  );

  const moveTicketMutation = useMutation({
    mutationFn: async ({ ticketId, columnTitle, subStatus }) => {
      const ticket = filteredTickets.find(t => t.id === ticketId);
      if (!ticket || ticket.status_column_title === columnTitle) return;
      const col = columns.find(c => c.title === columnTitle);
      await api.functions.invoke('updateTicketStatus', {
        ticketId,
        newStatus: columnTitle,
        columnData: col,
        subStatus: subStatus || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Status atualizado com sucesso!");
      setChecklistModal(null);
      setSubStatusModal(null);
    },
  });

  const handleDrop = (ticketId, columnTitle) => {
    const targetColumn = columns.find(c => c.title === columnTitle);
    const ticket = filteredTickets.find(t => t.id === ticketId);
    if (targetColumn?.sub_statuses?.length > 0) {
      setSubStatusModal({ ticketId, columnTitle, column: targetColumn, ticket });
    } else if (targetColumn?.required_fields?.length > 0) {
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

  const finalTitles = useMemo(() => {
    const s = new Set();
    kanbanConfigs.forEach(cfg => cfg.columns?.forEach(col => { if (col.is_final) s.add(col.title); }));
    return s;
  }, [kanbanConfigs]);

  const suporteAll = allTickets.filter(t => t.main_type === "suporte");
  const totalCount = suporteAll.length;
  const openCount = suporteAll.filter(t => !finalTitles.has(t.status_column_title)).length;
  const criticalCount = suporteAll.filter(t => t.urgency === "critica").length;
  const resolvedCount = suporteAll.filter(t => finalTitles.has(t.status_column_title)).length;

  return (
    <div className="h-screen bg-background -m-6 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-card border-b border-border">
        {/* Top bar */}
        <div className="px-6 pt-5 pb-4 flex items-center gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Suporte</h1>
            <p className="text-[11px] mt-0.5 text-muted-foreground">
              Pipeline de tickets por vertical · {filteredTickets.length} registros
            </p>
          </div>

          {/* Pipeline progress overview */}
          {sortedColumns.length > 0 && (
            <div className="flex-1 flex items-center gap-1 overflow-x-auto px-2">
              {sortedColumns.map((col, idx) => {
                const count = filteredTickets.filter(t => t.status_column_title === col.title).length;
                const colColor = col.color || ACCENT;
                const isLast = idx === sortedColumns.length - 1;
                return (
                  <React.Fragment key={col.title}>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: colColor, opacity: count > 0 ? 1 : 0.25 }} />
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
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* KPIs compactos */}
          <div className="flex items-center gap-6 flex-shrink-0">
            {[
              { label: "Total", value: totalCount },
              { label: "Abertos", value: openCount },
              { label: "Críticos", value: criticalCount, alert: criticalCount > 0 },
              { label: "Resolvidos", value: resolvedCount },
            ].map(({ label, value, alert }) => (
              <div key={label} className="text-center">
                <p className={`text-lg font-semibold leading-none tabular-nums ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
                <p className="text-[10px] mt-1 text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Ações */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowEmailModal(true)}
              className="gap-1.5 h-8 px-3 text-xs"
            >
              <Mail className="w-3.5 h-3.5" /> E-mail
            </Button>
            <Button
              onClick={() => { setEmailPrefill(null); setShowCreate(true); }}
              className="gap-1.5 h-8 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Ticket
            </Button>
            <BoardActionsMenu tickets={filteredTickets} />
          </div>
        </div>

        {/* Verticais + Filtros */}
        <div className="px-6 pb-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {verticals.filter(v => v.active).map((v) => (
              <motion.button
                key={v.id}
                onClick={() => setSelectedVertical(v.code)}
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

          <div className="flex-1">
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
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
                  <Settings className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground mb-1">Pipeline não configurado</h3>
                  <p className="text-muted-foreground text-sm">
                    Configure as etapas para{" "}
                    <span className="text-primary">
                      {verticals.find(v => v.code === selectedVertical)?.name}
                    </span>{" "}
                    (tipo Suporte)
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
              {sortedColumns.map((col, idx) => (
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
                    tickets={filteredTickets.filter(t => t.status_column_title === col.title)}
                    onDrop={handleDrop}
                    onNewTicket={idx === 0 ? () => { setEmailPrefill(null); setShowCreate(true); } : null}
                    isFirst={idx === 0}
                    isLast={idx === sortedColumns.length - 1}
                    groupBy={filters.groupBy}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TicketFormModal
        open={showCreate}
        onOpenChange={(v) => { setShowCreate(v); if (!v) setEmailPrefill(null); }}
        mainType={emailPrefill?.main_type || "suporte"}
        defaultVertical={selectedVertical}
        prefillData={emailPrefill}
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