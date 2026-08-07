import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Link } from "react-router-dom";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  Building2, Layers, Headphones, Kanban, Settings,
  ExternalLink, User, Loader2, Hash, Phone, Mail, FileText, Clock,
  Pencil, X, Check, Plus
} from "lucide-react";
import CustomFieldsPanel from "./CustomFieldsPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function TicketInfoPanel({ ticket, onUpdate }) {
  const qc = useQueryClient();
  const [editClientOpen, setEditClientOpen] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => api.entities.Client.list() });
  const { data: ticketTypes = [] } = useQuery({ queryKey: ["ticketTypes"], queryFn: () => api.entities.TicketType.list() });
  const { data: serviceTypes = [] } = useQuery({ queryKey: ["serviceTypes"], queryFn: () => api.entities.ServiceType.list() });
  const { data: categories = [] } = useQuery({ queryKey: ["serviceCategories"], queryFn: () => api.entities.ServiceCategory.list() });
  const { data: users = [] } = useQuery({
    queryKey: ["internalUsers"],
    queryFn: async () => { const res = await api.functions.invoke('listInternalUsers', {}); return res.data?.users || []; },
  });
  const { data: verticals = [] } = useQuery({ queryKey: ["verticals"], queryFn: () => api.entities.Vertical.list() });

  const updateMutation = useMutation({
    mutationFn: (data) => api.entities.Ticket.update(ticket.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ticket", ticket.id] }); onUpdate?.(); },
  });

  const handleSelectChange = useCallback((fields) => updateMutation.mutate(fields), [ticket.id]);
  const handleTextBlur = useCallback((field, value) => {
    if (value !== (ticket[field] || "")) updateMutation.mutate({ [field]: value });
  }, [ticket]);

  const relatedTicketTypes = ticketTypes.filter(t => t.active !== false && t.main_type === ticket.main_type && (!t.vertical || t.vertical === ticket.vertical));
  const relatedServiceTypes = serviceTypes.filter(s => s.active !== false && (!ticket.ticket_type || s.ticket_type === ticket.ticket_type) && (!s.vertical || s.vertical === ticket.vertical));
  const relatedCategories = categories.filter(c => c.active !== false && (!c.vertical || c.vertical === ticket.vertical));

  const clientData = clients.find(c => c.id === ticket.client_id);
  const verticalData = verticals.find(v => v.code === ticket.vertical);
  const isSaving = updateMutation.isPending;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 flex-wrap">
          {verticalData && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
              style={{ background: `${verticalData.color}18`, color: verticalData.color, border: `1px solid ${verticalData.color}28` }}>
              <Layers className="w-3 h-3" /> {verticalData.name}
            </span>
          )}
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
            ticket.main_type === "suporte"
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              : "bg-primary/10 text-primary border-primary/20"
          }`}>
            {ticket.main_type === "suporte"
              ? <><Headphones className="w-3 h-3" /> Suporte</>
              : <><Kanban className="w-3 h-3" /> Implantação</>
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          <Link to="/CustomFieldsConfig" className="text-muted-foreground hover:text-primary transition-colors p-1" title="Campos Customizados">
            <Settings className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="divide-y divide-border">

        {/* ── CLIENTE ── */}
        <Block>
          <FieldLabel icon={Building2}>Cliente</FieldLabel>
          <SearchableSelect
            value={ticket.client_id || ""}
            onValueChange={(v) => {
              const c = clients.find(cl => cl.id === v);
              handleSelectChange({ client_id: v, client_name: c?.name || "", client_email: c?.email || "" });
            }}
            options={clients.map(c => ({
              value: c.id,
              label: c.nome_fantasia || c.name || c.empresa || c.id,
              searchTerms: [c.cnpj, c.email, c.empresa, c.razao_social, c.nome_fantasia, c.name],
            }))}
            placeholder="Selecionar cliente..."
            searchPlaceholder="Buscar cliente..."
          />
          {clientData && (
            <div className="mt-2 rounded-xl border border-border overflow-hidden">
              <div className="flex border-b border-border">
                <Link
                  to={`/clients/${clientData.id}`}
                  className="flex items-center justify-between px-3 py-1.5 text-[11px] text-primary hover:bg-primary/5 transition-colors flex-1 border-r border-border"
                >
                  <span className="font-medium">Ver histórico do cliente</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => setEditClientOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  title="Editar cadastro do cliente"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Editar</span>
                </button>
              </div>
              <div className="px-3 py-2 space-y-1 bg-muted/30">
                {[
                  { icon: FileText, label: "Razão Social", value: clientData.razao_social },
                  { icon: Hash, label: "CNPJ", value: clientData.cnpj },
                  { icon: Phone, label: "Telefone", value: clientData.phone },
                  { icon: Mail, label: "E-mail", value: clientData.email },
                ].filter(f => f.value).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-[10px] text-muted-foreground w-14 flex-shrink-0">{label}</span>
                    <span className="text-[11px] text-foreground truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Block>

        {/* Modal edição do cliente */}
        {clientData && (
          <EditClientModal
            client={clientData}
            open={editClientOpen}
            onOpenChange={setEditClientOpen}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["clients"] });
              qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
            }}
          />
        )}

        {/* ── SOLICITANTE ── */}
        <Block>
          <FieldLabel icon={User}>Solicitante</FieldLabel>
          <InlineTextInput
            value={ticket.requester || ""}
            placeholder="Nome do solicitante"
            onBlur={(v) => handleTextBlur("requester", v)}
          />
        </Block>

        {/* ── CLASSIFICAÇÃO (grupo) ── */}
        <Block>
          <FieldLabel>Classificação</FieldLabel>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-muted-foreground mb-1 block">Tipo de Ticket</span>
              <SearchableSelect
                value={ticket.ticket_type || ""}
                onValueChange={(v) => handleSelectChange({ ticket_type: v, service_type: "" })}
                options={relatedTicketTypes.map(t => ({ value: t.name, label: t.name }))}
                placeholder="Selecionar tipo..."
                searchPlaceholder="Buscar tipo..."
              />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground mb-1 block">Tipo de Serviço</span>
              <SearchableSelect
                value={ticket.service_type || ""}
                onValueChange={(v) => handleSelectChange({ service_type: v })}
                options={relatedServiceTypes.map(s => ({ value: s.name, label: s.name }))}
                placeholder="Selecionar serviço..."
                searchPlaceholder="Buscar serviço..."
              />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground mb-1 block">Categoria</span>
              <SearchableSelect
                value={ticket.category || ""}
                onValueChange={(v) => handleSelectChange({ category: v })}
                options={relatedCategories.map(c => ({ value: c.name, label: c.name }))}
                placeholder="Selecionar categoria..."
                searchPlaceholder="Buscar categoria..."
              />
            </div>
          </div>
        </Block>

        {/* ── ANALISTA ── */}
        <Block>
          <FieldLabel icon={User}>Analista Responsável</FieldLabel>
          <SearchableSelect
            value={ticket.assigned_to || ""}
            onValueChange={(v) => {
              const u = users.find(us => us.email === v);
              handleSelectChange({ assigned_to: v, assigned_to_name: u?.full_name || "" });
            }}
            options={users.map(u => ({ value: u.email, label: u.full_name }))}
            placeholder="Selecionar analista..."
            searchPlaceholder="Buscar analista..."
          />
        </Block>

        {/* ── HORAS CONTRATADAS ── */}
        <Block>
          <FieldLabel icon={Clock}>Horas Contratadas</FieldLabel>
          <InlineNumberInput
            value={ticket.contracted_hours || 0}
            placeholder="0"
            onBlur={(v) => { if (v !== (ticket.contracted_hours || 0)) updateMutation.mutate({ contracted_hours: v }); }}
          />
        </Block>

        {/* ── CAMPOS CUSTOMIZADOS ── */}
        {ticket.vertical && ticket.service_type && (
          <Block>
            <FieldLabel>Campos Adicionais</FieldLabel>
            <CustomFieldsPanel
              ticket={ticket}
              vertical={ticket.vertical}
              serviceType={ticket.service_type}
            />
          </Block>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

function Block({ children }) {
  return <div className="px-4 py-3">{children}</div>;
}

function FieldLabel({ icon: Icon, children }) {
  return (
    <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2">
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </label>
  );
}

function InlineNumberInput({ value, placeholder, onBlur }) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type="number"
      min="0"
      step="0.5"
      value={local}
      onChange={(e) => setLocal(parseFloat(e.target.value) || 0)}
      onBlur={() => onBlur(parseFloat(local) || 0)}
      placeholder={placeholder}
      className="w-full bg-background border border-border hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors"
    />
  );
}

function InlineTextInput({ value, placeholder, onBlur }) {
  const [local, setLocal] = useState(value);
  React.useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onBlur(local)}
      placeholder={placeholder}
      className="w-full bg-background border border-border hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors"
    />
  );
}

function MultiItemInput({ label, icon: Icon, items, onChange, placeholder, type = "text" }) {
  const add = () => onChange([...items, ""]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, v) => onChange(items.map((item, idx) => idx === i ? v : item));

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          {Icon && <Icon className="w-3 h-3" />} {label}
        </Label>
        <button type="button" onClick={add} className="text-xs text-primary flex items-center gap-0.5 hover:underline">
          <Plus className="w-3 h-3" /> Adicionar
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map((val, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              type={type}
              value={val}
              onChange={e => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            {items.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditClientModal({ client, open, onOpenChange, onSaved }) {
  const [form, setForm] = useState({});
  const [emails, setEmails] = useState([""]);
  const [phones, setPhones] = useState([""]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && client) {
      setForm({
        nome_fantasia: client.nome_fantasia || client.name || "",
        empresa: client.empresa || client.razao_social || "",
        cnpj: client.cnpj || "",
        municipio: client.municipio || "",
        uf: client.uf || "",
      });
      // Emails: email principal + extras em emails_extras (array)
      const emailList = [client.email || ""];
      if (Array.isArray(client.emails_extras)) emailList.push(...client.emails_extras);
      setEmails(emailList.filter(Boolean).length > 0 ? emailList : [""]);
      // Phones: telefone + telefone2 + telefone3
      const phoneList = [client.telefone || client.phone || "", client.telefone2 || "", client.telefone3 || ""].filter(Boolean);
      setPhones(phoneList.length > 0 ? phoneList : [""]);
    }
  }, [open, client]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const validEmails = emails.filter(e => e.trim());
      const validPhones = phones.filter(p => p.trim());
      const payload = {
        ...form,
        email: validEmails[0] || "",
        emails_extras: validEmails.slice(1),
        telefone: validPhones[0] || "",
        telefone2: validPhones[1] || "",
        telefone3: validPhones[2] || "",
      };
      await api.entities.Client.update(client.id, payload);
      toast.success("Cliente atualizado!");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const simpleFields = [
    { key: "nome_fantasia", label: "Nome Fantasia *", col2: true },
    { key: "empresa", label: "Razão Social", col2: true },
    { key: "cnpj", label: "CNPJ", col2: false },
    { key: "municipio", label: "Município", col2: false },
    { key: "uf", label: "UF", col2: false },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cadastro do Cliente</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          {simpleFields.map(({ key, label, col2 }) => (
            <div key={key} className={col2 ? "col-span-2" : ""}>
              <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
              <Input value={form[key] || ""} onChange={e => setField(key, e.target.value)} placeholder={label} />
            </div>
          ))}

          <MultiItemInput
            label="E-mails"
            icon={Mail}
            items={emails}
            onChange={setEmails}
            placeholder="email@exemplo.com"
            type="email"
          />

          <MultiItemInput
            label="Celulares / Telefones"
            icon={Phone}
            items={phones}
            onChange={setPhones}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.nome_fantasia}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}