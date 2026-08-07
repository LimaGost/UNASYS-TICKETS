import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Building2, Phone, Mail, FileText, Clock, CheckCircle2,
  AlertCircle, Hash, Calendar, ExternalLink, User, Search, MapPin,
  TrendingUp, Ticket, ChevronRight, Wrench, PackageOpen
} from "lucide-react";

const urgencyConfig = {
  baixa:  { label: "Baixa",   color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  media:  { label: "Média",   color: "#eab308", bg: "rgba(234,179,8,0.12)"   },
  alta:   { label: "Alta",    color: "#f97316", bg: "rgba(249,115,22,0.12)"  },
  critica:{ label: "Crítica", color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
};

export default function ClientDetail() {
  const { clientId } = useParams();
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => api.entities.Client.get(clientId),
    enabled: !!clientId,
  });

  const { data: allTickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["clientTickets", clientId],
    queryFn: () => api.entities.Ticket.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  // IDs dos tickets do cliente, pra buscar os apontamentos de horas
  const ticketIds = allTickets.map(t => t.id);
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["clientTimeEntries", clientId, ticketIds.join(",")],
    queryFn: async () => {
      if (ticketIds.length === 0) return [];
      // Busca em paralelo por lotes de 10 (limite do filter)
      const chunks = [];
      for (let i = 0; i < ticketIds.length; i += 10) chunks.push(ticketIds.slice(i, i + 10));
      const results = await Promise.all(
        chunks.map(chunk => api.entities.TimeEntry.filter({ ticket_id: { $in: chunk } }))
      );
      return results.flat();
    },
    enabled: ticketIds.length > 0,
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const vertical = verticals.find(v => v.code === client?.vertical);

  const isFinalStatus = (t) => {
    const title = (t.status_column_title || "").toLowerCase();
    return title.includes("conclu") || title.includes("cancel") || title.includes("finaliz") || title.includes("fechado");
  };

  const filtered = allTickets
    .filter(t => {
      if (filterStatus === "open") return !isFinalStatus(t);
      if (filterStatus === "closed") return isFinalStatus(t);
      return true;
    })
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (t.title || "").toLowerCase().includes(q) ||
        (t.ticket_type || "").toLowerCase().includes(q) ||
        (t.status_column_title || "").toLowerCase().includes(q) ||
        (t.assigned_to_name || "").toLowerCase().includes(q) ||
        (t.external_order_number || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const openCount   = allTickets.filter(t => !isFinalStatus(t)).length;
  const closedCount = allTickets.filter(t =>  isFinalStatus(t)).length;

  // Horas separadas por categoria de ticket (suporte vs implantação)
  const ticketTypeMap = Object.fromEntries(allTickets.map(t => [t.id, t.main_type || ""]));
  const fmtH = (min) => {
    if (!min) return "0h";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };
  const horasSuporteMin  = timeEntries
    .filter(e => e.hour_type !== "interna" && (ticketTypeMap[e.ticket_id] || "") === "suporte")
    .reduce((s, e) => s + (e.total_minutes || 0), 0);
  const horasImplantMin  = timeEntries
    .filter(e => e.hour_type !== "interna" && (ticketTypeMap[e.ticket_id] || "") === "implantacao")
    .reduce((s, e) => s + (e.total_minutes || 0), 0);
  const horasTotalMin    = timeEntries
    .filter(e => e.hour_type !== "interna")
    .reduce((s, e) => s + (e.total_minutes || 0), 0);
  const horasExtraMin    = timeEntries
    .filter(e => e.hour_type === "extra")
    .reduce((s, e) => s + (e.total_minutes || 0), 0);

  const displayName = client?.nome_fantasia || client?.name || "—";
  const razaoSocial = client?.empresa || client?.razao_social;

  if (loadingClient) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Link to="/Clients" className="text-primary text-sm mt-2 inline-block hover:underline">← Voltar para Clientes</Link>
      </div>
    );
  }

  const infoFields = [
    { icon: Hash,     label: "CNPJ",        value: client.cnpj },
    { icon: FileText, label: "CNAE",        value: client.cnae },
    { icon: Building2,label: "Razão Social",value: razaoSocial },
    { icon: Mail,     label: "E-mail",      value: client.email },
    { icon: Phone,    label: "Telefone",    value: client.telefone || client.phone },
    { icon: Phone,    label: "Telefone 2",  value: client.telefone2 },
    { icon: User,     label: "Contato",     value: client.nome || client.contact_person },
    { icon: MapPin,   label: "Município/UF",value: [client.municipio, client.uf].filter(Boolean).join(" / ") },
  ].filter(f => f.value);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link to="/Clients">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-foreground truncate">{displayName}</h1>
          {razaoSocial && razaoSocial !== displayName && (
            <p className="text-xs text-muted-foreground truncate">{razaoSocial}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {vertical && (
            <Badge style={{ background: `${vertical.color}20`, color: vertical.color, border: `1px solid ${vertical.color}40` }}>
              {vertical.name}
            </Badge>
          )}
          <Badge className={client.active !== false
            ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
            : "bg-muted text-muted-foreground border-border"
          }>
            {client.active !== false ? "Ativo" : "Inativo"}
          </Badge>
          {client.status_contrato && (
            <Badge className={client.status_contrato === "ativo"
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
            }>
              Contrato {client.status_contrato}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Painel esquerdo ── */}
        <div className="space-y-4">
          {/* Dados do cliente */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dados do Cliente</p>
            {infoFields.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-foreground break-all">{value}</p>
                </div>
              </div>
            ))}
            {client.notes && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Observações</p>
                <p className="text-xs text-muted-foreground">{client.notes}</p>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total",    value: allTickets.length, icon: Ticket,        color: "#8B5CF6" },
              { label: "Abertos",  value: openCount,         icon: TrendingUp,    color: "#3b82f6" },
              { label: "Fechados", value: closedCount,       icon: CheckCircle2,  color: "#22c55e" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
                <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Horas gastas por tipo */}
          {timeEntries.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Horas Gastas</p>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Suporte</p>
                  <p className="text-sm font-semibold text-foreground">{fmtH(horasSuporteMin)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <PackageOpen className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Implantação</p>
                  <p className="text-sm font-semibold text-foreground">{fmtH(horasImplantMin)}</p>
                </div>
              </div>

              <div className="border-t border-border pt-3 flex gap-4">
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-sm font-bold text-foreground">{fmtH(horasTotalMin)}</p>
                </div>
                {horasExtraMin > 0 && (
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Extras</p>
                    <p className="text-sm font-bold text-orange-400">{fmtH(horasExtraMin)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Histórico de Tickets ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Histórico de Tickets</p>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar ticket..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-full sm:w-48 bg-background"
                />
              </div>
              <div className="flex gap-1">
                {[["all", "Todos"], ["open", "Abertos"], ["closed", "Fechados"]].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setFilterStatus(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      filterStatus === v
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lista */}
          {loadingTickets ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum ticket encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(ticket => {
                const urg = urgencyConfig[ticket.urgency] || urgencyConfig.media;
                const closed = isFinalStatus(ticket);
                return (
                  <Link
                    key={ticket.id}
                    to={`/ticket/${ticket.id}`}
                    className="block bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-accent/30 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${closed ? "bg-green-500/10" : "bg-blue-500/10"}`}>
                        {closed
                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                          : <AlertCircle  className="w-4 h-4 text-blue-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {ticket.title}
                          </p>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                            style={{ background: urg.bg, color: urg.color }}
                          >
                            {urg.label}
                          </span>
                          {ticket.status_column_title && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                              {ticket.status_column_title}
                            </span>
                          )}
                          {ticket.ticket_type && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                              {ticket.ticket_type}
                            </span>
                          )}
                          {ticket.external_order_number && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Hash className="w-3 h-3" /> OP: {ticket.external_order_number}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(ticket.created_date).toLocaleDateString("pt-BR")}
                          </span>
                          {ticket.assigned_to_name && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" /> {ticket.assigned_to_name}
                            </span>
                          )}
                          {(ticket.total_normal_hours > 0 || ticket.total_extra_hours > 0) && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {((ticket.total_normal_hours || 0) + (ticket.total_extra_hours || 0)).toFixed(1)}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {filtered.length} ticket{filtered.length !== 1 ? "s" : ""} exibido{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}