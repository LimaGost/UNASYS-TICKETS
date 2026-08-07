import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Link, useParams } from "react-router-dom";
import { createPageUrl } from "../utils";
import CustomFieldsRenderer from "../components/tickets/CustomFieldsRenderer";
import SmartKnowledgeSuggestions from "../components/tickets/SmartKnowledgeSuggestions";
import EscalateButton from "../components/tickets/EscalateButton";
import TicketInfoPanel from "../components/tickets/TicketInfoPanel";
import ActivityPanel from "../components/tickets/ActivityPanel";
import ReplicateTicketModal from "../components/tickets/ReplicateTicketModal";
import RelatedTicketsPanel from "../components/tickets/RelatedTicketsPanel";
import SectionBlock from "../components/tickets/SectionBlock";

import ActivityTimeline from "../components/tickets/ActivityTimeline";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Paperclip, Download, ChevronDown, Pencil, Clock, Mail, RefreshCw, Lock, Unlock, Copy } from "lucide-react";
import { toast } from "sonner";
import EditTicketModal from "../components/tickets/EditTicketModal";
import SubStatusModal from "../components/tickets/SubStatusModal";
import EmailComposerPanel from "../components/tickets/EmailComposerPanel";
import EmailTimeline from "../components/tickets/EmailTimeline";
import { calculateHours } from "../utils/timeCalculations";
import TicketPDFExport from "../components/tickets/TicketPDFExport";
import { formatDateBrasilia, toUTC } from "../utils/dateUtils";

export default function TicketDetail() {
  const { ticketId } = useParams();
  const queryClient = useQueryClient();
  
  const [uploading, setUploading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("activities");
  const [subStatusModal, setSubStatusModal] = useState(null);

  const { data: ticket } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api.entities.Ticket.get(ticketId),
    enabled: !!ticketId,
  });

  const { data: allTickets = [] } = useQuery({
    queryKey: ["allTickets"],
    queryFn: async () => {
      const tickets = await api.entities.Ticket.list('created_date', 1000);
      return tickets.sort((a, b) => 
        new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
      );
    },
  });

  const ticketNumber = useMemo(() => {
    if (!ticket || !allTickets?.length) return null;
    return allTickets.findIndex(t => t.id === ticket.id) + 1;
  }, [ticket, allTickets]);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", ticketId],
    queryFn: () => api.entities.TimeEntry.filter({ ticket_id: ticketId }),
    enabled: !!ticketId,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", ticketId],
    queryFn: () => api.entities.TicketAttachment.filter({ ticket_id: ticketId }),
    enabled: !!ticketId,
  });

  const { data: emails = [] } = useQuery({
    queryKey: ["ticketEmails", ticketId],
    queryFn: () => api.entities.TicketEmail.filter({ ticket_id: ticketId }),
    enabled: !!ticketId,
  });

  const { data: ticketEvents = [] } = useQuery({
    queryKey: ["ticketEvents", ticketId],
    queryFn: () => api.entities.TicketEvent.filter({ ticket_id: ticketId }),
    enabled: !!ticketId,
  });

  const { data: kanbanConfigs = [] } = useQuery({
    queryKey: ["kanbanConfigs"],
    queryFn: () => api.entities.KanbanConfig.list(),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["systemConfigs"],
    queryFn: () => api.entities.SystemConfig.list(),
  });

  const workStart = configs.find(c => c.key === "work_start")?.value || "08:00";
  const workEnd = configs.find(c => c.key === "work_end")?.value || "18:00";

  // Find matching kanban config for this ticket
  const kanbanConfig = ticket ? kanbanConfigs.find(
    kc => kc.vertical === ticket.vertical &&
          kc.main_type === ticket.main_type &&
          kc.ticket_type === ticket.ticket_type
  ) || kanbanConfigs.find(
    kc => kc.vertical === ticket.vertical && kc.main_type === ticket.main_type
  ) : null;

  const columns = kanbanConfig?.columns
    ? [...kanbanConfig.columns].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];

  const currentColumn = columns.find(c => c.title === ticket?.status_column_title);
  const isClosed = currentColumn?.is_final === true;

  // Reopen: move to first non-final column
  const reopenMutation = useMutation({
    mutationFn: async () => {
      const firstOpen = columns.find(c => !c.is_final);
      if (!firstOpen) return;
      await api.functions.invoke('updateTicketStatus', {
        ticketId,
        newStatus: firstOpen.title,
        columnData: firstOpen,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticketEvents", ticketId] });
      toast.success("Ticket reaberto com sucesso");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ columnTitle, subStatus }) => {
      const col = columns.find(c => c.title === columnTitle);
      await api.functions.invoke('updateTicketStatus', {
        ticketId,
        newStatus: columnTitle,
        columnData: col,
        subStatus: subStatus || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticketEvents", ticketId] });
      setSubStatusModal(null);
    },
  });

  const handleStatusChange = (columnTitle) => {
    if (isClosed || columnTitle === ticket?.status_column_title) return;
    const col = columns.find(c => c.title === columnTitle);
    if (col?.sub_statuses?.length > 0) {
      setSubStatusModal({ columnTitle, column: col });
    } else {
      statusMutation.mutate({ columnTitle });
    }
  };

  const uploadFileMutation = useMutation({
    mutationFn: async (file) => {
      const user = await api.auth.me();
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      
      await api.entities.TicketAttachment.create({
        ticket_id: ticketId,
        file_url,
        file_name: file.name,
        file_size: file.size,
        uploaded_by_name: user.full_name,
        uploaded_by_email: user.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", ticketId] });
    },
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      await Promise.all(files.map(file => uploadFileMutation.mutateAsync(file)));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Regra única do sistema: TODAS as horas registradas contam (inclusive internas)
  const totalNormal = timeEntries.reduce((s, e) => s + (e.normal_hours || 0), 0);
  const totalExtra = timeEntries.reduce((s, e) => s + (e.extra_hours || 0), 0);

  // Calculate ticket age
  const ticketAge = () => {
    const created = toUTC(ticket.created_date);
    const now = new Date();
    const diffMs = Math.max(0, now - created);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="space-y-4">
      {/* Closed banner */}
      {isClosed && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-500">Ticket encerrado</p>
            <p className="text-xs text-amber-500/70">Novos registros de atividade estão bloqueados. Reabra o ticket para continuar.</p>
          </div>
          <button
            onClick={() => reopenMutation.mutate()}
            disabled={reopenMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            <Unlock className="w-3.5 h-3.5" />
            {reopenMutation.isPending ? "Reabrindo..." : "Reabrir ticket"}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={createPageUrl(ticket?.main_type === "suporte" ? "Suporte" : "Tickets")}>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground truncate">{ticket.title}</h1>
            <button
              onClick={() => setEditModalOpen(true)}
              className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
              title="Editar ticket"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ticketNumber ? `#${String(ticketNumber).padStart(4, '0')} - ${ticket.ticket_type || ticket.main_type}` : `#${ticketId.slice(0, 8)}`}
          </p>
        </div>
        <EditTicketModal ticket={ticket} open={editModalOpen} onClose={() => setEditModalOpen(false)} />
        <div className="flex items-center gap-2">
          <TicketPDFExport ticket={ticket} timeEntries={timeEntries} ticketNumber={ticketNumber} events={ticketEvents} emails={emails} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReplicateOpen(true)}
            className="gap-1.5 h-9 rounded-lg"
            title="Replicar Ticket (criar Ticket Filho)"
          >
            <Copy className="w-3.5 h-3.5" />
            Replicar Ticket
          </Button>
          <ReplicateTicketModal ticket={ticket} ticketNumber={ticketNumber} open={replicateOpen} onOpenChange={setReplicateOpen} />
          <EmailComposerPanel ticket={ticket} />
          <EscalateButton ticket={ticket} />
          {columns.length > 0 ? (
            <Select value={ticket.status_column_title} onValueChange={handleStatusChange} disabled={isClosed}>
              <SelectTrigger className={`w-52 bg-card border-border text-foreground h-9 transition-colors ${isClosed ? "opacity-60 cursor-not-allowed" : "hover:border-primary"}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {(() => {
                    const col = columns.find(c => c.title === ticket.status_column_title);
                    return col ? (
                      <>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color || "hsl(var(--primary))" }} />
                        <span className="truncate text-sm font-medium">{ticket.status_column_title || "Sem status"}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">{ticket.status_column_title || "Selecionar status"}</span>
                    );
                  })()}
                </div>
              </SelectTrigger>
              <SelectContent>
                {columns.map((c, i) => (
                  <SelectItem key={i} value={c.title}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || "hsl(var(--primary))" }} />
                      <span>{c.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-md h-9">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-sm text-foreground">{ticket.status_column_title || "—"}</span>
            </div>
          )}
        </div>
      </div>

      {subStatusModal && (
        <SubStatusModal
          open={!!subStatusModal}
          onClose={() => setSubStatusModal(null)}
          onConfirm={(subStatus) => statusMutation.mutate({ columnTitle: subStatusModal.columnTitle, subStatus })}
          column={subStatusModal.column}
          ticket={ticket}
        />
      )}

      {/* 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-5">

          {/* Info Panel principal */}
          <TicketInfoPanel ticket={ticket} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] })} />

          {/* Relacionamento Pai/Filhos */}
          <RelatedTicketsPanel ticket={ticket} />

          {/* Métricas rápidas: idade + horas */}
          <SectionBlock title="Resumo de Horas">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Aberto há</p>
                <p className="text-lg font-bold text-primary">{ticketAge()}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{formatDateBrasilia(ticket.created_date)}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Normal</p>
                <p className="text-lg font-bold text-primary">{totalNormal.toFixed(1)}h</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">horas</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Extra</p>
                <p className="text-lg font-bold text-orange-500">{totalExtra.toFixed(1)}h</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">horas</p>
              </div>
            </div>

            {/* Barra de progresso de horas contratadas */}
            {ticket.contracted_hours > 0 && (() => {
              const totalUsed = totalNormal + totalExtra;
              const contracted = ticket.contracted_hours;
              const pct = Math.min((totalUsed / contracted) * 100, 100);
              const remaining = Math.max(contracted - totalUsed, 0);
              const isOver = totalUsed > contracted;
              const color = isOver ? "bg-red-500" : pct > 80 ? "bg-orange-500" : pct > 50 ? "bg-yellow-500" : "bg-emerald-500";
              const textColor = isOver ? "text-red-500" : pct > 80 ? "text-orange-500" : "text-emerald-500";
              return (
                <div className="pt-2 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Progresso de Horas</span>
                    <span className={`text-[11px] font-bold ${textColor}`}>
                      {totalUsed.toFixed(1)}h / {contracted}h
                    </span>
                  </div>
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{pct.toFixed(0)}% utilizado</span>
                    <span className={`font-semibold ${isOver ? "text-red-500" : "text-emerald-600"}`}>
                      {isOver
                        ? `⚠ ${(totalUsed - contracted).toFixed(1)}h excedidas`
                        : `${remaining.toFixed(1)}h restantes`}
                    </span>
                  </div>
                </div>
              );
            })()}
          </SectionBlock>

          {/* Descrição */}
          {ticket.description && (
            <SectionBlock title="Descrição">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </SectionBlock>
          )}

          {/* Observações da Proposta (integração externa) */}
          {ticket.observacoes_gerais && (
            <SectionBlock title="Observações da Proposta" defaultOpen={false}>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ticket.observacoes_gerais}</p>
            </SectionBlock>
          )}

          {/* Dados Externos */}
          {(ticket.external_order_number || ticket.external_reference || ticket.external_customer_code) && (
            <SectionBlock title="Dados Externos" defaultOpen={false}>
              <div className="space-y-2">
                {ticket.external_order_number && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-[11px] text-muted-foreground">Nº OP / Pedido</span>
                    <span className="text-xs text-primary font-semibold">{ticket.external_order_number}</span>
                  </div>
                )}
                {ticket.external_customer_code && (
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-[11px] text-muted-foreground">Código do Cliente</span>
                    <span className="text-xs text-primary font-semibold">{ticket.external_customer_code}</span>
                  </div>
                )}
                {ticket.external_reference && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[11px] text-muted-foreground">Referência</span>
                    <span className="text-xs text-primary font-semibold">{ticket.external_reference}</span>
                  </div>
                )}
                {ticket.external_system && (
                  <p className="text-[10px] text-muted-foreground italic pt-1">Via: {ticket.external_system}</p>
                )}
              </div>
            </SectionBlock>
          )}

          {/* Anexos */}
          <SectionBlock title={`Anexos${attachments.length > 0 ? ` (${attachments.length})` : ""}`} defaultOpen={attachments.length > 0}>
            <div className="flex items-center justify-end mb-3">
              <label>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} multiple />
                <Button size="sm" className="gap-1.5 h-7 text-xs rounded-lg" asChild disabled={uploading}>
                  <span className="cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5" />
                    {uploading ? "Enviando..." : "Anexar"}
                  </span>
                </Button>
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum anexo</p>
            ) : (
              <div className="space-y-1.5">
                {attachments.map(att => (
                  <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted border border-border hover:border-primary/40 transition-all group">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate font-medium">{att.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">{(att.file_size / 1024).toFixed(1)} KB · {att.uploaded_by_name}</p>
                    </div>
                    <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </SectionBlock>

          <SmartKnowledgeSuggestions ticket={ticket} />
        </div>

        {/* RIGHT COLUMN - Activity */}
        <div className="lg:col-span-8 space-y-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="activities">Atividades</TabsTrigger>
              <TabsTrigger value="emails" className="gap-2">
                <Mail className="w-4 h-4" />
                E-mails
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-2">
                <Clock className="w-4 h-4" />
                Linha do Tempo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activities" className="mt-4">
              <ActivityPanel
                ticket={ticket}
                workStart={workStart}
                workEnd={workEnd}
                isClosed={isClosed}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] })}
              />
            </TabsContent>

            <TabsContent value="emails" className="mt-4 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground font-medium">{emails.length} e-mail(s) registrado(s)</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const t = toast.loading("Buscando respostas...");
                    try {
                      const res = await api.functions.invoke('checkTicketEmails', { ticketId });
                      const n = res?.data?.processed ?? 0;
                      toast.success(n > 0 ? `${n} resposta(s) recebida(s)` : "Nenhuma resposta nova", { id: t });
                      queryClient.invalidateQueries({ queryKey: ["ticketEmails", ticketId] });
                    } catch (e) {
                      toast.error("Erro ao buscar respostas", { id: t });
                    }
                  }}
                  className="gap-1.5 h-8 text-xs rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Buscar respostas
                </Button>
              </div>
              <EmailTimeline emails={emails} />
            </TabsContent>

            <TabsContent value="timeline" className="mt-4 bg-card border border-border rounded-xl p-5">
              <ActivityTimeline ticket={ticket} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
  }