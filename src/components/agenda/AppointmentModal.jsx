import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, ChevronsUpDown, Check, Search, X, Users, Calendar, Clock, Palette } from "lucide-react";
import { format } from "date-fns";

const TYPES = [
  { value: "reuniao",     label: "Reunião",     icon: "🤝", color: "#8B5CF6" },
  { value: "visita",      label: "Visita",      icon: "📍", color: "#3B82F6" },
  { value: "treinamento", label: "Treinamento", icon: "📚", color: "#10B981" },
  { value: "entrega",     label: "Entrega",     icon: "📦", color: "#F59E0B" },
  { value: "followup",    label: "Follow-up",   icon: "📞", color: "#EC4899" },
  { value: "outro",       label: "Outro",       icon: "📌", color: "#6B7280" },
];

const COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#F97316"];

const EMPTY_FORM = {
  title: "", description: "", date: format(new Date(), "yyyy-MM-dd"),
  start_time: "09:00", end_time: "10:00", vertical: "", type: "reuniao",
  client_id: "", client_name: "", ticket_id: "", ticket_title: "",
  color: "#8B5CF6", attendees: [],
};

export default function AppointmentModal({ open, onOpenChange, initialDate, initialTime, appointment, verticals }) {
  const queryClient = useQueryClient();
  const isEditing = !!appointment;

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketPopoverOpen, setTicketPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [attendeesPopoverOpen, setAttendeesPopoverOpen] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState("");

  const { data: currentUser } = useQuery({ queryKey: ["currentUser"], queryFn: () => api.auth.me() });

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setForm({ ...EMPTY_FORM, ...appointment, attendees: appointment.attendees || [] });
    } else {
      const startTime = initialTime || "09:00";
      const [h, m] = startTime.split(":").map(Number);
      const endHour = String(Math.min(h + 1, 23)).padStart(2, "0");
      setForm({
        ...EMPTY_FORM,
        date: initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        start_time: startTime,
        end_time: `${endHour}:${String(m || 0).padStart(2, "0")}`,
        vertical: verticals?.[0]?.code || "",
        attendees: currentUser?.email ? [currentUser.email] : [],
      });
    }
  }, [appointment, initialDate, initialTime, open, currentUser?.email]);

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => api.entities.Client.list() });
  const { data: tickets = [] } = useQuery({ queryKey: ["tickets"], queryFn: () => api.entities.Ticket.list() });
  const { data: internalUsersRaw } = useQuery({
    queryKey: ["internalUsers"],
    queryFn: () => api.functions.invoke("listInternalUsers", {}),
  });
  const internalUsers = useMemo(() => {
    const u = internalUsersRaw?.data?.users;
    return Array.isArray(u) ? u : [];
  }, [internalUsersRaw]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const user = await api.auth.me();
      const payload = { ...data, owner_email: user.email, owner_name: user.full_name };
      return isEditing
        ? api.entities.Appointment.update(appointment.id, payload)
        : api.entities.Appointment.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(isEditing ? "Compromisso atualizado!" : "Compromisso criado!");
      onOpenChange(false);
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.entities.Appointment.delete(appointment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Compromisso excluído!");
      onOpenChange(false);
    },
  });

  const filteredClients = useMemo(() => {
    const base = form.vertical ? clients.filter(c => c.vertical === form.vertical) : clients;
    if (!clientSearch.trim()) return base.slice(0, 50);
    const q = clientSearch.toLowerCase();
    return base.filter(c =>
      c.nome_fantasia?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.empresa?.toLowerCase().includes(q) ||
      c.cnpj?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [clients, form.vertical, clientSearch]);

  const filteredTickets = useMemo(() => {
    const base = form.vertical ? tickets.filter(t => t.vertical === form.vertical) : tickets;
    if (!ticketSearch.trim()) return base.slice(0, 30);
    const q = ticketSearch.toLowerCase();
    return base.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.client_name?.toLowerCase().includes(q) ||
      String(t.ticket_number || "").includes(q)
    ).slice(0, 30);
  }, [tickets, form.vertical, ticketSearch]);

  const filteredAttendees = useMemo(() => {
    const base = form.vertical ? internalUsers.filter(u => u.vertical === form.vertical) : internalUsers;
    if (!attendeeSearch.trim()) return base;
    const q = attendeeSearch.toLowerCase();
    return base.filter(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [internalUsers, form.vertical, attendeeSearch]);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleClientChange = (client) => {
    setForm(f => ({ ...f, client_id: client.id, client_name: client.nome_fantasia || client.name || "" }));
    setClientPopoverOpen(false);
    setClientSearch("");
  };

  const clearClient = () => { setField("client_id", ""); setField("client_name", ""); setClientSearch(""); };

  const handleTicketChange = (ticket) => {
    setForm(f => ({
      ...f, ticket_id: ticket.id, ticket_title: ticket.title || "",
      vertical: f.vertical || ticket.vertical,
      client_id: f.client_id || ticket.client_id || "",
      client_name: f.client_name || ticket.client_name || "",
    }));
    setTicketPopoverOpen(false);
    setTicketSearch("");
  };

  const clearTicket = () => { setField("ticket_id", ""); setField("ticket_title", ""); setTicketSearch(""); };

  const toggleAttendee = (email) => {
    setForm(f => {
      const cur = f.attendees || [];
      return { ...f, attendees: cur.includes(email) ? cur.filter(e => e !== email) : [...cur, email] };
    });
  };

  const getAttendeeName = (email) => internalUsers.find(u => u.email === email)?.full_name || email;

  const selectedType = TYPES.find(t => t.value === form.type);
  const selectedVertical = verticals?.find(v => v.code === form.vertical);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">

        {/* Header with type selector */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-semibold mb-4">
              {isEditing ? "Editar Compromisso" : "Novo Compromisso"}
            </DialogTitle>
          </DialogHeader>

          {/* Type pills */}
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => { setField("type", t.value); setField("color", t.color); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                style={form.type === t.value
                  ? { background: t.color + "25", borderColor: t.color, color: t.color }
                  : {}}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1 block">Título *</Label>
            <Input
              value={form.title}
              onChange={e => setField("title", e.target.value)}
              placeholder="Ex: Reunião de kickoff com cliente"
            />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Data *</Label>
              <Input type="date" value={form.date} onChange={e => setField("date", e.target.value)} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Início</Label>
              <Input type="time" value={form.start_time} onChange={e => setField("start_time", e.target.value)} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">Término</Label>
              <Input type="time" value={form.end_time} onChange={e => setField("end_time", e.target.value)} />
            </div>
          </div>

          {/* Vertical */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1 block">Vertical *</Label>
            <Select value={form.vertical} onValueChange={v => setForm(f => ({ ...f, vertical: v, client_id: "", client_name: "", ticket_id: "", ticket_title: "", attendees: currentUser?.email ? [currentUser.email] : [] }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a vertical..." />
              </SelectTrigger>
              <SelectContent>
                {verticals?.filter(v => v.active).map(v => (
                  <SelectItem key={v.id} value={v.code}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: v.color || "#8B5CF6" }} />
                      {v.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client + Ticket */}
          <div className="grid grid-cols-2 gap-3">
            {/* Cliente com busca */}
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">Cliente</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-left transition-colors hover:bg-muted text-foreground">
                    <span className="truncate flex-1 text-sm">
                      {form.client_id ? form.client_name || "Cliente selecionado" : <span className="text-muted-foreground">Nenhum</span>}
                    </span>
                    <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                      {form.client_id && (
                        <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400"
                          onClick={(e) => { e.stopPropagation(); clearClient(); }} />
                      )}
                      <ChevronsUpDown className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    <input autoFocus value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                      placeholder="Nome, CNPJ, e-mail..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" style={{ textTransform: "none" }} />
                    {clientSearch && (
                      <button onClick={() => setClientSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <button className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted border-b border-border"
                      onClick={() => { clearClient(); setClientPopoverOpen(false); }}>Nenhum</button>
                    {filteredClients.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum cliente encontrado</p>}
                    {filteredClients.map(c => {
                      const displayName = c.nome_fantasia || c.name || c.empresa || "—";
                      return (
                        <button key={c.id} className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border last:border-0"
                          onClick={() => handleClientChange(c)}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-foreground font-medium truncate">{displayName}</span>
                            {form.client_id === c.id && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                          </div>
                          {(c.cnpj || c.email) && (
                            <div className="flex items-center gap-2 mt-0.5">
                              {c.cnpj && <span className="text-[10px] text-muted-foreground font-mono">{c.cnpj}</span>}
                              {c.email && <span className="text-[10px] text-muted-foreground truncate">{c.email}</span>}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Ticket com busca melhorada */}
            <div>
              <Label className="text-muted-foreground text-xs mb-1 block">Ticket vinculado</Label>
              <Popover open={ticketPopoverOpen} onOpenChange={setTicketPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-left transition-colors hover:bg-muted text-foreground">
                    <span className="truncate flex-1 text-sm">
                      {form.ticket_id ? form.ticket_title : <span className="text-muted-foreground">Nenhum</span>}
                    </span>
                    <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                      {form.ticket_id && (
                        <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-400"
                          onClick={(e) => { e.stopPropagation(); clearTicket(); }} />
                      )}
                      <ChevronsUpDown className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    <input autoFocus value={ticketSearch} onChange={e => setTicketSearch(e.target.value)}
                      placeholder="Título, cliente ou #número..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" style={{ textTransform: "none" }} />
                    {ticketSearch && (
                      <button onClick={() => setTicketSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" /></button>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <button className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted border-b border-border"
                      onClick={() => { clearTicket(); setTicketPopoverOpen(false); }}>Nenhum</button>
                    {filteredTickets.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum ticket encontrado</p>}
                    {filteredTickets.map(t => (
                      <button key={t.id} className="w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border last:border-0"
                        onClick={() => handleTicketChange(t)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-foreground font-medium truncate flex-1">{t.title}</span>
                          {form.ticket_id === t.id && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {t.ticket_number && <span className="text-[10px] text-primary bg-primary/15 px-1.5 py-0.5 rounded font-mono">#{t.ticket_number}</span>}
                          {t.client_name && <span className="text-[10px] text-muted-foreground truncate">{t.client_name}</span>}
                          {t.status_column_title && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.status_column_title}</span>}
                        </div>
                      </button>
                    ))}
                    {filteredTickets.length === 30 && (
                      <p className="text-center text-[10px] text-muted-foreground py-2">Refine a busca para ver mais resultados</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Attendees */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Participantes</Label>
            <Popover open={attendeesPopoverOpen} onOpenChange={setAttendeesPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-start justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-left transition-colors hover:bg-muted min-h-[38px]">
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {(form.attendees || []).length === 0 ? (
                      <span className="text-muted-foreground text-sm">Adicionar participantes...</span>
                    ) : (
                      (form.attendees || []).map(email => (
                        <span key={email} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {getAttendeeName(email)}
                          <X className="w-3 h-3 hover:text-red-300 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); toggleAttendee(email); }} />
                        </span>
                      ))
                    )}
                  </div>
                  <Users className="w-3.5 h-3.5 text-gray-500 ml-2 mt-0.5 flex-shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <input autoFocus value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)}
                    placeholder="Buscar usuário..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredAttendees.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-4">
                      {form.vertical ? "Nenhum usuário nesta vertical" : "Selecione uma vertical primeiro"}
                    </p>
                  )}
                  {filteredAttendees.map(u => {
                    const selected = (form.attendees || []).includes(u.email);
                    return (
                      <button key={u.email}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center gap-3 border-b border-border last:border-0"
                        onClick={() => toggleAttendee(u.email)}>
                        <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${selected ? "bg-primary border-primary" : "border-border"}`}>
                          {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground font-medium truncate">{u.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1 block">Descrição</Label>
            <Textarea value={form.description} onChange={e => setField("description", e.target.value)}
              placeholder="Detalhes, pauta, links relevantes..."
              className="resize-none h-20" />
          </div>

          {/* Color */}
          <div>
            <Label className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Palette className="w-3 h-3" /> Cor do evento</Label>
            <div className="flex gap-2 mt-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => setField("color", c)}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "scale-125 ring-2 ring-foreground/30 ring-offset-1 ring-offset-background" : "hover:scale-110 opacity-70 hover:opacity-100"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-border bg-muted/50">
          {isEditing ? (
            <Button variant="ghost" onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5">
              <Trash2 className="w-4 h-4" /> {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.title || !form.date || !form.vertical || saveMutation.isPending}
              className="text-white gap-1.5 min-w-[90px]"
              style={{ background: form.color || "#8B5CF6" }}
            >
              {saveMutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}