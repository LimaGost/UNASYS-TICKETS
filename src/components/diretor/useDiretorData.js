import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";

export const DEFAULT_FILTERS = {
  periodo: "30",
  cliente: "todos",
  colaborador: "todos",
  vertical: "todos",
  urgency: "todas",
  status: "todos",
};

export function fmtHoras(h) {
  if (!h) return "0h";
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

export function fmtDuracao(ms) {
  if (ms == null || isNaN(ms) || ms < 0) return "—";
  const h = ms / 3.6e6;
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export const MOTIVO_LABELS = {
  falha_processo: "Falha de Processo",
  falha_tecnica: "Falha Técnica",
  falha_operacional: "Falha Operacional",
  complexidade: "Complexidade",
  prazo: "Prazo",
  cliente_insatisfeito: "Cliente Insatisfeito",
  outro: "Outro",
};

export const ESC_STATUS = {
  aberto: { label: "Aberto", color: "#ef4444" },
  em_tratativa: { label: "Em Tratativa", color: "#f59e0b" },
  resolvido: { label: "Resolvido", color: "#22c55e" },
  encerrado: { label: "Encerrado", color: "#94a3b8" },
};

export function useDiretorData(filters) {
  const { data: allTickets = [], isLoading: l1 } = useQuery({
    queryKey: ["dir-tickets"],
    queryFn: () => api.entities.Ticket.list("-created_date", 1000),
  });
  const { data: allEntries = [], isLoading: l2 } = useQuery({
    queryKey: ["dir-entries"],
    queryFn: () => api.entities.TimeEntry.list("-date", 1000),
  });
  const { data: allEvents = [] } = useQuery({
    queryKey: ["dir-all-events"],
    queryFn: () => api.entities.TicketEvent.list("-created_date", 1000),
  });
  const { data: allEscalations = [] } = useQuery({
    queryKey: ["dir-escalations"],
    queryFn: () => api.entities.Escalation.list("-created_date", 500),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["dir-users"],
    queryFn: async () => {
      const r = await api.functions.invoke("listInternalUsers", {});
      return r.data?.users || [];
    },
  });

  const internos = useMemo(
    () => users.filter(u => u.tipo_perfil === "interno" && u.cargo !== "Diretor"),
    [users]
  );

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(filters.periodo));
    return d;
  }, [filters.periodo]);

  const ticketById = useMemo(() => {
    const m = {};
    allTickets.forEach(t => { m[t.id] = t; });
    return m;
  }, [allTickets]);

  const tickets = useMemo(() => allTickets.filter(t => {
    if (new Date(t.created_date) < cutoff) return false;
    if (filters.cliente !== "todos" && t.client_name !== filters.cliente) return false;
    if (filters.colaborador !== "todos" && t.assigned_to !== filters.colaborador) return false;
    if (filters.vertical !== "todos" && t.vertical !== filters.vertical) return false;
    if (filters.urgency !== "todas" && t.urgency !== filters.urgency) return false;
    if (filters.status === "abertos" && t.closed_at) return false;
    if (filters.status === "fechados" && !t.closed_at) return false;
    return true;
  }), [allTickets, cutoff, filters]);

  const entries = useMemo(() => allEntries.filter(e => {
    if (e.date && new Date(e.date) < cutoff) return false;
    if (filters.colaborador !== "todos" && e.technician_email !== filters.colaborador) return false;
    const t = ticketById[e.ticket_id];
    if (filters.cliente !== "todos" && t?.client_name !== filters.cliente) return false;
    if (filters.vertical !== "todos" && t?.vertical !== filters.vertical) return false;
    return true;
  }), [allEntries, cutoff, filters, ticketById]);

  const escalations = useMemo(() => allEscalations.filter(e => {
    if (new Date(e.created_date) < cutoff) return false;
    if (filters.cliente !== "todos" && e.client_name !== filters.cliente) return false;
    if (filters.colaborador !== "todos" && e.colaborador_email !== filters.colaborador && e.escalated_to_email !== filters.colaborador) return false;
    if (filters.vertical !== "todos" && e.vertical !== filters.vertical) return false;
    return true;
  }), [allEscalations, cutoff, filters]);

  const events = useMemo(
    () => allEvents.filter(e => new Date(e.created_date) >= cutoff),
    [allEvents, cutoff]
  );

  const reaberturas = useMemo(
    () => events.filter(e => (e.description || "").toLowerCase().includes("reabert")),
    [events]
  );

  const clientes = useMemo(
    () => [...new Set(allTickets.map(t => t.client_name).filter(Boolean))].sort(),
    [allTickets]
  );
  const verticais = useMemo(
    () => [...new Set(allTickets.map(t => t.vertical).filter(Boolean))].sort(),
    [allTickets]
  );

  return {
    loading: l1 || l2,
    allTickets, tickets, entries, allEntries, events, allEvents,
    escalations, allEscalations, users, internos, ticketById,
    reaberturas, clientes, verticais, cutoff,
  };
}