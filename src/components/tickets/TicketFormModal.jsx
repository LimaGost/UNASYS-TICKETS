import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Kanban, Headphones, AlertCircle } from "lucide-react";
import DynamicFields from "./DynamicFields";
import CustomFieldsPanel from "./CustomFieldsPanel";

export default function TicketFormModal({ open, onOpenChange, initialColumnId, mainType, defaultVertical, prefillData, onTicketCreated }) {
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.entities.Client.list(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.entities.ServiceCategory.list(),
  });
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => api.entities.ServiceType.list(),
  });
  const { data: usersRaw } = useQuery({
    queryKey: ["internalUsers"],
    queryFn: async () => {
      const res = await api.functions.invoke('listInternalUsers', {});
      return res.data?.users || [];
    },
  });
  const users = Array.isArray(usersRaw) ? usersRaw : [];
  const { data: kanbanConfigs = [] } = useQuery({
    queryKey: ["kanbanConfigs"],
    queryFn: () => api.entities.KanbanConfig.list(),
  });
  const { data: configs = [] } = useQuery({
    queryKey: ["systemConfigs"],
    queryFn: () => api.entities.SystemConfig.list(),
  });

  const { data: formConfigs = [] } = useQuery({
    queryKey: ["formConfigs"],
    queryFn: () => api.entities.ServiceFormConfig.list(),
  });

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ["ticketTypes"],
    queryFn: () => api.entities.TicketType.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: () => api.entities.TicketCustomField.list(),
  });

  const [form, setForm] = useState({
    title: "", client_id: "", requester: "",
    service_type: "", category: "", urgency: "media", description: "",
    assigned_to: "", assigned_to_name: "", ticket_type: "",
    main_type: mainType || "suporte",
    vertical: defaultVertical || "",
  });
  const [dynamicFields, setDynamicFields] = useState({});
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setForm(prev => ({
        ...prev,
        main_type: mainType || prev.main_type || "implantacao",
        vertical: defaultVertical || prev.vertical || "",
        ...(prefillData ? {
          title: prefillData.title || prev.title,
          description: prefillData.description || prev.description,
          requester: prefillData.requester || prev.requester,
          urgency: prefillData.urgency || prev.urgency,
          client_id: prefillData.client_id || prev.client_id,
          ticket_type: prefillData.ticket_type || prev.ticket_type,
          service_type: prefillData.service_type || prev.service_type,
          main_type: prefillData.main_type || mainType || prev.main_type || "implantacao",
        } : {}),
      }));
    }
  }, [open, prefillData]);

  // Get dynamic form config
  // Resolve a vertical do cliente: campo legado `vertical` (pode vir com valores compostos,
  // ex: "retail - suporti", de importações antigas) ou `vertical_ids`
  const resolveClientVertical = (client) => {
    if (!client) return "";
    if (client.vertical) {
      const raw = String(client.vertical).trim().toLowerCase();
      const exact = verticals.find(v => v.code.toLowerCase() === raw);
      if (exact) return exact.code;
      const partial = verticals.find(v => raw.includes(v.code.toLowerCase()));
      if (partial) return partial.code;
    }
    if (client.vertical_ids?.length) {
      for (const id of client.vertical_ids) {
        const v = verticals.find(vt => vt.id === id);
        if (v) return v.code;
      }
    }
    return "";
  };

  const selectedClient = clients.find(c => c.id === form.client_id);
  const clientVertical = resolveClientVertical(selectedClient);
  const activeFormConfig = formConfigs.find(
    fc => fc.service_type === form.service_type && fc.vertical === clientVertical && fc.active
  );

  const getSLAHours = (urgency) => {
    const key = `sla_${urgency}`;
    const cfg = configs.find(c => c.key === key);
    return cfg ? parseInt(cfg.value) : 24;
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const client = clients.find(c => c.id === data.client_id);
      
      // Validar vertical obrigatória (suporta campo legado, valores compostos e vertical_ids)
      const clientVerticalCode = resolveClientVertical(client);
      const vertical = clientVerticalCode || data.vertical;
      
      if (!vertical) {
        throw new Error("Cliente deve ter uma vertical definida");
      }

      const slaHours = getSLAHours(data.urgency);
      const expectedRes = new Date();
      expectedRes.setHours(expectedRes.getHours() + slaHours);

      // Get first column from KanbanConfig for this main_type and vertical
      const config = kanbanConfigs.find(
        c => c.main_type === data.main_type && c.vertical === vertical
      );
      const firstColumn = config?.columns?.sort((a, b) => (a.order || 0) - (b.order || 0))[0];
      
      // Default column if no config
      const defaultColumn = { title: "Novo", color: "#8B5CF6" };
      const targetColumn = firstColumn || defaultColumn;

      const ticketData = {
        ...data,
        ...dynamicFields,
        client_name: client?.name || "",
        client_email: client?.email || "",
        vertical: vertical,
        status_column_title: targetColumn.title,
        sla_hours: slaHours,
        expected_resolution: expectedRes.toISOString(),
        total_normal_hours: 0,
        total_extra_hours: 0,
        notified: false,
        sla_breached: false,
      };

      const ticket = await api.entities.Ticket.create(ticketData);

      // Create creation event
      const user = await api.auth.me();
      await api.entities.TicketEvent.create({
        ticket_id: ticket.id,
        type: "creation",
        description: `Ticket criado: "${data.title}"`,
        user_email: user.email,
        user_name: user.full_name,
        visible_to_client: false,
        email_sent: false,
      });

      // Notify assigned user
      if (ticketData.assigned_to && ticketData.assigned_to !== user.email) {
        await api.functions.invoke('createNotification', {
          user_email: ticketData.assigned_to,
          type: 'ticket_assigned',
          title: `Novo ticket atribuído: ${ticketData.title}`,
          message: `Você foi atribuído ao ticket #${ticket.id.slice(0, 8)}`,
          ticket_id: ticket.id,
          ticket_title: ticketData.title,
          actor_name: user.full_name,
          actor_email: user.email,
          priority: ticketData.urgency === 'critica' ? 'high' : 'normal',
        });
      }

      return ticket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      if (onTicketCreated) onTicketCreated(ticket);
      onOpenChange(false);
      setForm({
        title: "", client_id: "", requester: "",
        service_type: "", category: "", urgency: "media", description: "",
        assigned_to: "", assigned_to_name: "", ticket_type: "",
        main_type: mainType || "suporte",
        vertical: defaultVertical || "",
      });
      setDynamicFields({});
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    createMutation.mutate(form, { onSettled: () => setSaving(false) });
  };

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">
            {form.main_type === "suporte" ? "Novo Ticket de Suporte" : "Nova Implantação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">

          {/* Tipo: Suporte ou Implantação — só mostra se não for forçado pela prop */}
          {!mainType && (
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Tipo *</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "suporte", label: "Suporte", icon: Headphones, color: "#10B981", desc: "Atendimento técnico e suporte" },
                  { value: "implantacao", label: "Implantação", icon: Kanban, color: "#8B5CF6", desc: "Implantação e onboarding" },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = form.main_type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { set("main_type", opt.value); set("ticket_type", ""); }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center"
                      style={{
                        background: active ? `${opt.color}15` : "rgba(255,255,255,0.02)",
                        borderColor: active ? opt.color : "rgba(139,92,246,0.15)",
                        color: active ? opt.color : "#6b7280",
                      }}
                    >
                      <Icon className="w-5 h-5" />
                      <div>
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs opacity-70">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <Label className="text-muted-foreground text-xs">Título *</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
              className="mt-1"
              placeholder="Título do ticket"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client */}
            <div>
              <Label className="text-muted-foreground text-xs">Cliente *</Label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.client_id}
                  onValueChange={(v) => { 
                    const client = clients.find(c => c.id === v);
                    set("client_id", v); 
                    set("ticket_type", ""); 
                    set("service_type", "");
                    const resolvedV = resolveClientVertical(client);
                    set("vertical", resolvedV || defaultVertical || "");
                  }}
                  options={clients.filter(c => c.active !== false).map(c => {
                    const cv = resolveClientVertical(c);
                    const vt = verticals.find(v => v.code === cv);
                    return { value: c.id, label: vt ? `${c.nome_fantasia || c.name} · ${vt.name}` : (c.nome_fantasia || c.name) };
                  })}
                  placeholder="Selecione o cliente"
                  searchPlaceholder="Buscar cliente..."
                />
              </div>
              {/* Vertical badge do cliente selecionado */}
              {selectedClient && (() => {
                const v = verticals.find(vt => vt.code === clientVertical);
                return v ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: v.color || "#8B5CF6" }} />
                    <span className="text-xs" style={{ color: v.color || "#a78bfa" }}>Vertical: {v.name}</span>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-1.5 text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-xs">Cliente sem vertical definida</span>
                  </div>
                );
              })()}
            </div>

            {/* Requester */}
            <div>
              <Label className="text-muted-foreground text-xs">Solicitante</Label>
              <Input
                value={form.requester}
                onChange={(e) => set("requester", e.target.value)}
                className="mt-1"
                placeholder="Nome do solicitante"
              />
            </div>

            {/* Analyst */}
            <div>
              <Label className="text-muted-foreground text-xs">Analista Responsável</Label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.assigned_to}
                  onValueChange={(v) => {
                    const u = users.find(u => u.email === v);
                    set("assigned_to", v);
                    set("assigned_to_name", u?.full_name || "");
                  }}
                  options={users.map(u => ({ value: u.email, label: u.full_name }))}
                  placeholder="Selecione (opcional)"
                  searchPlaceholder="Buscar analista..."
                />
              </div>
            </div>

            {/* Ticket Type */}
            <div>
              <Label className="text-muted-foreground text-xs">Tipo de Ticket *</Label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.ticket_type}
                  onValueChange={(v) => {
                    set("ticket_type", v);
                    set("service_type", "");
                  }}
                  options={ticketTypes.filter(t =>
                    t.active !== false &&
                    t.main_type === form.main_type &&
                    (!clientVertical || !t.vertical || t.vertical === clientVertical)
                  ).map(t => ({ value: t.name, label: t.name }))}
                  placeholder="Selecione o tipo"
                  searchPlaceholder="Buscar tipo..."
                />
              </div>
            </div>

            {/* Service Type */}
            <div>
              <Label className="text-muted-foreground text-xs">Tipo de Serviço</Label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.service_type}
                  onValueChange={(v) => set("service_type", v)}
                  options={serviceTypes.filter(s =>
                    s.active !== false &&
                    (form.ticket_type ? s.ticket_type === form.ticket_type : true) &&
                    (!clientVertical || !s.vertical || s.vertical === clientVertical)
                  ).map(s => ({ value: s.name, label: s.name }))}
                  placeholder="Selecione o serviço"
                  searchPlaceholder="Buscar serviço..."
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <Label className="text-muted-foreground text-xs">Categoria</Label>
              <div className="mt-1">
                <SearchableSelect
                  value={form.category}
                  onValueChange={(v) => set("category", v)}
                  options={categories.filter(c => c.active !== false).map(c => ({ value: c.name, label: c.name }))}
                  placeholder="Selecione a categoria"
                  searchPlaceholder="Buscar categoria..."
                />
              </div>
            </div>

            {/* Urgency */}
            <div>
              <Label className="text-muted-foreground text-xs">Urgência *</Label>
              <Select value={form.urgency} onValueChange={(v) => set("urgency", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dynamic Fields */}
          {activeFormConfig && (
            <DynamicFields
              config={activeFormConfig}
              values={dynamicFields}
              onChange={setDynamicFields}
            />
          )}

          {/* Custom Fields */}
          {form.service_type && form.vertical && (
            <CustomFieldsPanel
              ticket={null}
              serviceType={form.service_type}
              vertical={form.vertical}
              isEditing={true}
              onFieldsChange={setDynamicFields}
            />
          )}

          {/* Description */}
          <div>
            <Label className="text-muted-foreground text-xs">Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="mt-1 min-h-[100px]"
              placeholder="Descreva o problema ou solicitação..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.title || !form.client_id}>
              {saving ? "Criando..." : (form.main_type === "suporte" ? "Criar Ticket de Suporte" : "Criar Implantação")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}