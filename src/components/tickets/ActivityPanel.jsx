import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, X, Send, Clock, Mail, MessageSquare, ChevronDown, Play, Square, Pause, Plus, Lock, Users } from "lucide-react";
import RichEditor from "./RichEditor";
import TimerControl from "./TimerControl";
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import TimelineItem from "./TimelineItem";
import EmailTimeline from "./EmailTimeline";
import WhatsAppComposer from "./WhatsAppComposer";
import TemplateSelector from "./TemplateSelector";
import { calculateHours, formatHM, validateTimeEntry } from "../../utils/timeCalculations";
import { todayBrasilia, currentTimeBrasilia } from "../../utils/dateUtils";

/* ── Tag Input e Row para o painel de e-mail ── */
function EmailTagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const isValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const addTag = useCallback(() => {
    const val = input.trim();
    if (!val) return;
    const emails = val.split(/[;,\s]+/).map((e) => e.trim()).filter(Boolean);
    const valid = emails.filter(isValid);
    onChange([...new Set([...tags, ...valid])]);
    setInput("");
  }, [input, tags, onChange]);
  const handleKeyDown = (e) => {
    if (["Enter", ",", ";", "Tab"].includes(e.key)) {e.preventDefault();addTag();} else
    if (e.key === "Backspace" && !input && tags.length > 0) onChange(tags.slice(0, -1));
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center cursor-text min-h-[34px]" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, i) =>
      <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/35">
          {tag}
          <button type="button" onClick={(e) => {e.stopPropagation();onChange(tags.filter((_, j) => j !== i));}} className="ml-0.5 text-primary/70 hover:text-foreground">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      )}
      <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKeyDown} onBlur={addTag}
      placeholder={tags.length === 0 ? placeholder : ""}
      className="flex-1 min-w-[120px] bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground"
      style={{ textTransform: "none" }} />
    </div>);

}

function EmailTagRow({ label, children, extra }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-border">
      <span className="text-[10px] font-semibold uppercase tracking-wider w-12 flex-shrink-0 pt-1.5 text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
      {extra}
    </div>);

}

function loadDraft(ticketId) {
  try {
    const raw = sessionStorage.getItem(`activity_draft_${ticketId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft(ticketId, data) {
  try {
    sessionStorage.setItem(`activity_draft_${ticketId}`, JSON.stringify(data));
  } catch {}
}

function clearDraft(ticketId) {
  try {
    sessionStorage.removeItem(`activity_draft_${ticketId}`);
  } catch {}
}

export default function ActivityPanel({ ticket, workStart = "08:00", workEnd = "18:00", isClosed = false, onSaved }) {
  const queryClient = useQueryClient();
  const ticketId = ticket?.id;

  const { data: clientData } = useQuery({
    queryKey: ["client", ticket?.client_id],
    queryFn: () => api.entities.Client.get(ticket.client_id),
    enabled: !!ticket?.client_id,
  });

  // Monta lista de e-mails padrão: email principal + extras do cadastro do cliente
  const defaultClientEmails = React.useMemo(() => {
    const list = [];
    if (ticket?.client_email) list.push(ticket.client_email);
    if (clientData?.emails_extras?.length) {
      for (const e of clientData.emails_extras) {
        if (e && !list.includes(e)) list.push(e);
      }
    }
    return list;
  }, [ticket?.client_email, clientData]);

  const defaultForm = {
    date: todayBrasilia(),
    // Padrão: horário atual (minuto a minuto), fim = início — o analista informa
    // o fim real; salvar com menos de 1 minuto é bloqueado abaixo
    start_time: currentTimeBrasilia(),
    end_time: currentTimeBrasilia(),
    start_time2: "",
    end_time2: "",
    use_second_period: false,
    hour_type: "normal",
    description: "",
    attachments: [],
    email_recipients: defaultClientEmails.length > 0 ? defaultClientEmails : (ticket?.client_email ? [ticket.client_email] : []),
    email_cc_list: [],
    email_bcc_list: [],
    email_subject: `Atualização - ${ticket?.title || ""}`
  };

  // Atualiza destinatários quando o cadastro do cliente carregar (se ainda não modificados pelo usuário)
  useEffect(() => {
    if (!clientData || defaultClientEmails.length <= 1) return;
    setForm(prev => {
      const singleDefault = ticket?.client_email ? [ticket.client_email] : [];
      const unchanged = JSON.stringify(prev.email_recipients) === JSON.stringify(singleDefault);
      if (unchanged) return { ...prev, email_recipients: defaultClientEmails };
      return prev;
    });
  }, [defaultClientEmails]);

  const draft = loadDraft(ticketId);
  const [tab, setTab] = useState(draft?.tab || "registro");
  const [sendEmail, setSendEmail] = useState(draft?.sendEmail || false);
  const [uploading, setUploading] = useState(false);
  const [ccDropdownOpen, setCcDropdownOpen] = useState(false);
  const quillRef = useRef(null);

  const [form, setForm] = useState(draft?.form || defaultForm);
  const [showEmailCc, setShowEmailCc] = useState(draft?.showEmailCc || false);
  const [showEmailBcc, setShowEmailBcc] = useState(draft?.showEmailBcc || false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamDropdownRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target)) {
        setTeamDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ["internalUsers"],
    queryFn: async () => {
      const res = await api.functions.invoke('listInternalUsers', {});
      return res.data?.users || [];
    }
  });

  // Usuários da mesma vertical do ticket
  const teamUsers = useMemo(() => {
    return users.filter(u => u.email && u.vertical === ticket?.vertical && u.status !== "inativo");
  }, [users, ticket?.vertical]);

  // Persiste o draft sempre que algum estado relevante mudar
  useEffect(() => {
    saveDraft(ticketId, { form, tab, sendEmail, showEmailCc, showEmailBcc });
  }, [form, tab, sendEmail, showEmailCc, showEmailBcc, ticketId]);

  const [durationError, setDurationError] = useState(false);

  const hours1 = calculateHours(form.start_time, form.end_time, workStart, workEnd);
  const hours2 = (form.use_second_period && form.start_time2 && form.end_time2)
    ? calculateHours(form.start_time2, form.end_time2, workStart, workEnd)
    : { normal: 0, extra: 0, total: 0, totalMinutes: 0 };
  // Soma dos dois períodos num único registro
  const hours = {
    normal: Math.round((hours1.normal + hours2.normal) * 100) / 100,
    extra: Math.round((hours1.extra + hours2.extra) * 100) / 100,
    total: Math.round((hours1.total + hours2.total) * 100) / 100,
    totalMinutes: (hours1.totalMinutes || 0) + (hours2.totalMinutes || 0),
  };
  const secondPeriodInvalid = form.use_second_period &&
    (!form.start_time2 || !form.end_time2 || hours2.totalMinutes < 1);

  // Limpa o aviso de duração assim que o horário for corrigido
  useEffect(() => {
    if (hours.totalMinutes >= 1 && !secondPeriodInvalid && durationError) setDurationError(false);
  }, [hours.totalMinutes, secondPeriodInvalid, durationError]);
  const validation = validateTimeEntry({
    ticket_id: ticketId,
    date: form.date,
    start_time: form.start_time,
    end_time: form.end_time,
    normal_hours: hours.normal,
    extra_hours: hours.extra
  });

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: events = [] } = useQuery({
    queryKey: ["ticketEvents", ticketId],
    queryFn: () => api.entities.TicketEvent.filter({ ticket_id: ticketId }),
    enabled: !!ticketId
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", ticketId],
    queryFn: () => api.entities.TimeEntry.filter({ ticket_id: ticketId }),
    enabled: !!ticketId
  });
  const { data: emails = [] } = useQuery({
    queryKey: ["ticketEmails", ticketId],
    queryFn: () => api.entities.TicketEmail.filter({ ticket_id: ticketId }),
    enabled: !!ticketId
  });

  // Apontamentos de horas ordenam pela DATA DO APONTAMENTO (+ horário de início),
  // não pela data de criação do registro — um registro lançado hoje para um dia
  // anterior precisa aparecer na posição cronológica do dia trabalhado.
  const allItems = [
  ...events.map((e) => ({ ...e, _type: "event", _date: e.created_date })),
  ...timeEntries.map((t) => ({
    ...t,
    _type: "time",
    _date: t.date ? `${t.date}T${t.start_time || "00:00"}:00` : t.created_date
  }))].
  sort((a, b) => new Date(b._date) - new Date(a._date));

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) continue;
        setUploading(true);
        const { file_url } = await api.integrations.Core.UploadFile({ file: blob });
        setUploading(false);
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, "image", file_url);
          quill.setSelection(range.index + 1);
        }
      }
    }
  };

  const handleFileAttach = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    const uploaded = await Promise.all(
      files.map(async (file) => {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        return { url: file_url, name: file.name, size: file.size };
      })
    );
    setUploading(false);
    set("attachments", [...form.attachments, ...uploaded]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const user = await api.auth.me();
      await api.entities.TimeEntry.create({
        ticket_id: ticketId,
        ticket_title: ticket.title,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        ...(form.use_second_period && form.start_time2 && form.end_time2
          ? { start_time2: form.start_time2, end_time2: form.end_time2 }
          : {}),
        description: form.description,
        normal_hours: hours.normal,
        extra_hours: hours.extra,
        total_minutes: hours.totalMinutes,
        hour_type: form.hour_type,
        attachments: form.attachments.map((a) => a.url),
        technician_email: user.email,
        technician_name: user.full_name
      });

      // Regra única: TODAS as horas contam (inclusive internas) — mesma regra
      // do backend (recomputeTicketHours) e dos relatórios
      {
        const entries = await api.entities.TimeEntry.filter({ ticket_id: ticketId });
        const totalN = Math.round(entries.reduce((s, e) => s + (e.normal_hours || 0), 0) * 100) / 100;
        const totalE = Math.round(entries.reduce((s, e) => s + (e.extra_hours || 0), 0) * 100) / 100;
        await api.entities.Ticket.update(ticketId, { total_normal_hours: totalN, total_extra_hours: totalE });
      }

      if (sendEmail && form.email_recipients.length > 0) {
        const ccList = [...form.email_cc_list, ...form.email_bcc_list].join(",");
        // Monta bloco de horas para o e-mail
        const thisNormal = hours.normal;
        const thisExtra = hours.extra;
        const emailTotalN = (ticket.total_normal_hours || 0) + thisNormal;
        const emailTotalE = (ticket.total_extra_hours || 0) + thisExtra;
        const contracted = ticket.contracted_hours || 0;
        const remaining = contracted > 0 ? Math.max(contracted - emailTotalN - emailTotalE, 0) : null;
        const hoursBlock = `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;color:#374151">
  <tr style="background:#f3f4f6">
    <td style="padding:8px 12px;font-weight:600" colspan="2">⏱ Registro de Horas — Este Atendimento</td>
  </tr>
  <tr><td style="padding:6px 12px;color:#6b7280">Horas normais:</td><td style="padding:6px 12px;font-weight:600">${thisNormal.toFixed(1)}h</td></tr>
  ${thisExtra > 0 ? `<tr><td style="padding:6px 12px;color:#6b7280">Horas extras:</td><td style="padding:6px 12px;font-weight:600;color:#f97316">${thisExtra.toFixed(1)}h</td></tr>` : ""}
  <tr style="background:#f9fafb"><td style="padding:6px 12px;font-weight:600">Total acumulado no projeto:</td><td style="padding:6px 12px;font-weight:700;color:#7c3aed">${(emailTotalN + emailTotalE).toFixed(1)}h</td></tr>
  ${contracted > 0 ? `<tr><td style="padding:6px 12px;color:#6b7280">Horas contratadas:</td><td style="padding:6px 12px;font-weight:600">${contracted}h</td></tr>
  <tr><td style="padding:6px 12px;color:#6b7280">Saldo restante:</td><td style="padding:6px 12px;font-weight:700;color:${remaining <= 0 ? "#ef4444" : "#10b981"}">${remaining <= 0 ? `<span style="color:#ef4444">Excedido em ${Math.abs(remaining).toFixed(1)}h</span>` : `${remaining.toFixed(1)}h`}</td></tr>` : ""}
</table>`;
        const bodyWithHours = form.description + hoursBlock;
        // Criar registro do e-mail antes de enviar (para salvar no histórico)
        const emailRecord = await api.entities.TicketEmail.create({
          ticket_id: ticketId,
          direction: 'sent',
          from_email: user.email,
          from_name: user.full_name,
          to: form.email_recipients,
          cc: [...form.email_cc_list, ...form.email_bcc_list],
          bcc: [],
          subject: form.email_subject,
          body: bodyWithHours,
          attachments: [],
          visible_to_client: true,
        });

        await api.functions.invoke('sendEmailGmail', {
          ticket_id: ticketId,
          to: form.email_recipients,
          cc: ccList,
          subject: form.email_subject,
          body: bodyWithHours,
          email_record_id: emailRecord?.id,
          attachments: form.attachments.map((a) => ({ url: a.url, name: a.name })),
        });
      }

      await api.entities.TicketEvent.create({
        ticket_id: ticketId,
        type: "time_entry",
        description: `Registro: ${formatHM(hours.total)} (${form.hour_type})`,
        user_email: user.email,
        user_name: user.full_name,
        visible_to_client: sendEmail,
        email_sent: sendEmail
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticketEvents", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticketEmails", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["reportsData"] });
      clearDraft(ticketId);
      setForm({
        ...defaultForm,
        start_time: currentTimeBrasilia(),
        end_time: currentTimeBrasilia(),
      });
      setSendEmail(false);
      setShowEmailCc(false);
      setShowEmailBcc(false);
      setTab("registro");
      onSaved?.();
    }
  });

  const TABS = [
  { id: "registro", label: "Novo Registro" },
  { id: "emails", label: `E-mails${emails.length ? ` (${emails.length})` : ""}` }];


  return (
    <div className="space-y-4">
      {/* Top panel: registro/emails */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center border-b border-border bg-muted/40">
          {TABS.map((t) =>
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors relative ${
            tab === t.id ?
            "text-foreground" :
            "text-muted-foreground hover:text-foreground"}`
            }>
            
              {t.label}
              {tab === t.id &&
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            }
            </button>
          )}
          <div className="ml-auto pr-3 flex items-center gap-2">
            <WhatsAppComposer ticket={ticket} />
            <TemplateSelector
              onSelectTemplate={(template) => {
                const event = new CustomEvent('template-selected', { detail: template });
                document.dispatchEvent(event);
              }}
              mainType={ticket?.main_type} />
            
          </div>
        </div>

        <div className="p-5">
          {/* REGISTRO TAB */}
          {tab === "registro" && isClosed &&
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">Ticket encerrado</p>
            <p className="text-xs text-muted-foreground max-w-xs">Este ticket está fechado. Novos registros de atividade estão bloqueados. Reabra o ticket para continuar registrando.</p>
          </div>
          }

          {/* REGISTRO TAB */}
          {tab === "registro" && !isClosed &&
          <div className="space-y-4">
            {/* Timer */}
            <TimerControl
              ticketId={ticketId}
              onTimeComplete={(timeData) => {
                set("date", timeData.date);
                set("start_time", timeData.start_time);
                set("end_time", timeData.end_time);
              }} />
            

            {/* Time + tipo + resumo numa linha só */}
            <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
              {/* Campos de tempo */}
              <div className="grid grid-cols-4 divide-x divide-border">
                <div className="px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Data</p>
                  <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                  className="bg-transparent border-0 text-foreground h-7 text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Início</p>
                  <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)}
                  className="bg-transparent border-0 text-foreground h-7 text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Fim</p>
                  <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)}
                  className="bg-transparent border-0 text-foreground h-7 text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tipo</p>
                  <Select value={form.hour_type} onValueChange={(v) => set("hour_type", v)}>
                    <SelectTrigger className="bg-transparent border-0 text-foreground h-7 text-sm p-0 focus:ring-0 [&>svg]:hidden">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="interna">Interna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 2º período no mesmo registro */}
              {form.use_second_period ? (
                <div className="grid grid-cols-4 divide-x divide-border border-t border-border">
                  <div className="px-3 py-2.5 flex items-center">
                    <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">2º Horário</span>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Início 2</p>
                    <Input type="time" value={form.start_time2} onChange={(e) => set("start_time2", e.target.value)}
                    className="bg-transparent border-0 text-foreground h-7 text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Fim 2</p>
                    <Input type="time" value={form.end_time2} onChange={(e) => set("end_time2", e.target.value)}
                    className="bg-transparent border-0 text-foreground h-7 text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </div>
                  <div className="px-3 py-2.5 flex items-center justify-end">
                    <button
                      onClick={() => setForm(prev => ({ ...prev, use_second_period: false, start_time2: "", end_time2: "" }))}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" /> Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-border px-3 py-2">
                  <button
                    onClick={() => set("use_second_period", true)}
                    className="flex items-center gap-1.5 text-[11px] text-primary hover:underline">
                    <Plus className="w-3 h-3" /> Adicionar 2º horário no mesmo registro
                  </button>
                </div>
              )}

              {/* Resumo de horas */}
              <div className="flex items-center gap-0 border-t border-border">
                <div className="flex-1 flex items-center justify-center gap-2 py-2.5 border-r border-border">
                  <span className="text-[10px] text-muted-foreground">Normal</span>
                  <span className="text-sm font-bold text-emerald-500">{formatHM(hours.normal)}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-2 py-2.5 border-r border-border">
                  <span className="text-[10px] text-muted-foreground">Extra</span>
                  <span className="text-sm font-bold text-cyan-500">{formatHM(hours.extra)}</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-2 py-2.5">
                  <span className="text-[10px] text-muted-foreground">Total</span>
                  <span className="text-sm font-bold text-primary">{formatHM(hours.total)}</span>
                </div>
                {form.hour_type === "interna" &&
                <div className="px-3 py-2.5 border-l border-border">
                    <span className="text-[10px] text-amber-500 font-semibold">Interna</span>
                  </div>
                }
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-muted-foreground text-[11px] mb-1.5 block">Relato da Atividade</Label>
              <div
                onPaste={handlePaste}
                className="border border-border rounded-lg overflow-hidden text-foreground"
                style={{ minHeight: "200px" }}>
                
                <RichEditor
                  ref={quillRef}
                  value={form.description}
                  onChange={(v) => set("description", v)}
                  placeholder="Descreva o trabalho realizado... (Cole imagens com Ctrl+V)" />
                
              </div>
            </div>

            {/* Attachments */}
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleFileAttach} multiple />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border border-border hover:border-primary/50">
                  <Paperclip className="w-3.5 h-3.5" />
                  {uploading ? "Enviando..." : "Anexar arquivo"}
                </div>
              </label>
              {form.attachments.map((att, idx) =>
              <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded border border-border">
                  <span className="truncate max-w-[100px]">{att.name}</span>
                  <button onClick={() => set("attachments", form.attachments.filter((_, i) => i !== idx))} className="text-gray-600 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Send email toggle */}
            <div className="border-t border-border pt-4 space-y-3">
              <button
                onClick={() => setSendEmail(!sendEmail)}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-all ${
                sendEmail ?
                "border-primary/40 bg-primary/10 text-primary" :
                "border-border text-muted-foreground hover:text-foreground"}`
                }>
                
                <Mail className="w-4 h-4" />
                {sendEmail ? "Notificar cliente por e-mail ✓" : "Notificar cliente por e-mail"}
              </button>

              {sendEmail &&
              <div className="rounded-xl overflow-hidden border border-border bg-card">
                  {/* Resumo das horas que serão registradas */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-500/5 border-b border-border">
                    <Clock className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-[11px] text-muted-foreground">Horas a registrar:</span>
                    <span className="text-[11px] font-semibold text-emerald-500">{formatHM(hours.normal)} normal</span>
                    {hours.extra > 0 && <span className="text-[11px] font-semibold text-cyan-500">{formatHM(hours.extra)} extra</span>}
                    <span className="ml-auto text-[11px] font-bold text-primary">{formatHM(hours.total)} total</span>
                  </div>

                  {/* Para */}
                  <EmailTagRow label="Para"
                extra={
                <div className="flex items-center gap-1 pt-1 flex-shrink-0">
                        {!showEmailCc && <button onClick={() => { setShowEmailCc(true); }} className="text-[10px] px-1.5 py-0.5 rounded text-primary/70 hover:text-primary">Cc</button>}
                        {!showEmailBcc && <button onClick={() => setShowEmailBcc(true)} className="text-[10px] px-1.5 py-0.5 rounded text-primary/70 hover:text-primary">Cco</button>}
                      </div>
                }>
                    <EmailTagInput tags={form.email_recipients} onChange={(v) => set("email_recipients", v)} placeholder="Destinatário (Enter para confirmar)" />
                  </EmailTagRow>

                  {/* CC */}
                  {showEmailCc &&
                <EmailTagRow label="Cc" extra={
                  <div className="flex items-center gap-1 pt-1 flex-shrink-0">
                    {/* Botão Equipe */}
                    <div className="relative" ref={teamDropdownRef}>
                      <button
                        onClick={() => setTeamDropdownOpen(o => !o)}
                        className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border transition-colors font-medium ${
                          form.email_cc_list.some(e => teamUsers.find(u => u.email === e))
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted"
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        Equipe
                        {form.email_cc_list.filter(e => teamUsers.find(u => u.email === e)).length > 0 && (
                          <span className="bg-primary text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold">
                            {form.email_cc_list.filter(e => teamUsers.find(u => u.email === e)).length}
                          </span>
                        )}
                      </button>

                      {teamDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                          {/* Header com "Selecionar todos" */}
                          <div className="px-4 py-3 border-b border-border bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[12px] font-semibold text-foreground">Equipe — {ticket?.vertical}</p>
                              <button onClick={() => setTeamDropdownOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {teamUsers.length > 0 && (
                              <button
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                  const allEmails = teamUsers.map(u => u.email);
                                  const allSelected = allEmails.every(e => form.email_cc_list.includes(e));
                                  if (allSelected) {
                                    set("email_cc_list", form.email_cc_list.filter(e => !allEmails.includes(e)));
                                  } else {
                                    set("email_cc_list", [...new Set([...form.email_cc_list, ...allEmails])]);
                                  }
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/40 hover:bg-primary/5 transition-colors text-left"
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${teamUsers.every(u => form.email_cc_list.includes(u.email)) ? "bg-primary border-primary" : "border-border"}`}>
                                  {teamUsers.every(u => form.email_cc_list.includes(u.email)) && <span className="text-white text-[9px] font-bold">✓</span>}
                                </div>
                                <span className="text-[11px] font-medium text-primary">
                                  {teamUsers.every(u => form.email_cc_list.includes(u.email)) ? "Remover todos" : "Selecionar todos"}
                                </span>
                                <span className="ml-auto text-[10px] text-muted-foreground">{teamUsers.length} membros</span>
                              </button>
                            )}
                          </div>

                          {/* Lista */}
                          {teamUsers.length === 0 ? (
                            <div className="flex flex-col items-center py-8 gap-2">
                              <Users className="w-8 h-8 text-muted-foreground/30" />
                              <p className="text-[11px] text-muted-foreground">Nenhum membro encontrado</p>
                            </div>
                          ) : (
                            <div className="max-h-56 overflow-y-auto">
                              {teamUsers.map(u => {
                                const inCc = form.email_cc_list.includes(u.email);
                                const initials = (u.full_name || u.nome || u.email).split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();
                                return (
                                  <button
                                    key={u.email}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => {
                                      if (inCc) {
                                        set("email_cc_list", form.email_cc_list.filter(e => e !== u.email));
                                      } else {
                                        set("email_cc_list", [...form.email_cc_list, u.email]);
                                      }
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-border/50 last:border-0 ${inCc ? "bg-primary/5" : "hover:bg-muted/50"}`}
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${inCc ? "bg-primary border-primary" : "border-border"}`}>
                                      {inCc && <span className="text-white text-[9px] font-bold">✓</span>}
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${inCc ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                                      {initials}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-[12px] font-medium truncate ${inCc ? "text-foreground" : "text-foreground"}`}>{u.full_name || u.nome || u.email}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="border-t border-border px-4 py-2.5 bg-muted/20 flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground">
                              {form.email_cc_list.filter(e => teamUsers.find(u => u.email === e)).length} de {teamUsers.length} selecionados
                            </p>
                            <button
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => setTeamDropdownOpen(false)}
                              className="text-[11px] font-semibold text-primary hover:underline"
                            >
                              Confirmar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => {setShowEmailCc(false);set("email_cc_list", []);}} className="text-gray-600 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                }>
                      <EmailTagInput tags={form.email_cc_list} onChange={(v) => set("email_cc_list", v)} placeholder="Cc (Enter para confirmar)" />
                    </EmailTagRow>
                }

                  {/* BCC */}
                  {showEmailBcc &&
                <EmailTagRow label="Cco" extra={<button onClick={() => {setShowEmailBcc(false);set("email_bcc_list", []);}} className="pt-1.5 text-gray-600 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>}>
                      <EmailTagInput tags={form.email_bcc_list || []} onChange={(v) => set("email_bcc_list", v)} placeholder="Cco (Enter para confirmar)" />
                    </EmailTagRow>
                }

                  {/* Assunto */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                    <span className="text-[10px] font-semibold uppercase tracking-wider w-12 flex-shrink-0 text-muted-foreground">Assunto</span>
                    <input value={form.email_subject} onChange={(e) => set("email_subject", e.target.value)}
                  placeholder="Assunto" className="flex-1 bg-transparent outline-none text-[12px] text-foreground placeholder-muted-foreground"
                  style={{ textTransform: "none" }} />
                  </div>

                  {/* Footer do painel de e-mail */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <span className="text-[11px] text-muted-foreground">
                      {form.email_recipients.length > 0 &&
                    <span>Para: <span className="text-primary">{form.email_recipients.length} destinatário{form.email_recipients.length > 1 ? "s" : ""}</span></span>
                    }
                      {form.email_cc_list?.length > 0 && <span> · Cc: <span className="text-primary">{form.email_cc_list.length}</span></span>}
                    </span>
                  </div>
                </div>
              }

              <div className="flex items-center justify-end gap-3">
                {durationError && (
                  <p className="text-xs text-red-400 mr-auto">
                    ⚠️ {secondPeriodInvalid
                      ? <>Ajuste o <strong>2º horário</strong> — informe início e fim válidos ou remova o período.</>
                      : <>Ajuste o horário de <strong>Fim</strong> — o registro precisa ter pelo menos 1 minuto.</>}
                  </p>
                )}
                <Button
                  onClick={() => {
                    if (!hours.totalMinutes || hours.totalMinutes < 1 || secondPeriodInvalid) {
                      setDurationError(true);
                      return;
                    }
                    setDurationError(false);
                    saveMutation.mutate();
                  }}
                  disabled={saveMutation.isPending}
                  className="h-9 px-6 gap-2 text-sm font-semibold">
                  
                  {saveMutation.isPending ?
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :

                  <Send className="w-4 h-4" />
                  }
                  {sendEmail ? "Salvar e Enviar E-mail" : "Salvar Registro"}
                </Button>
              </div>
            </div>
          </div>
          }

          {/* E-MAILS TAB */}
          {tab === "emails" &&
          <div className="space-y-4">
              <EmailTimeline emails={emails} />
              {emails.length === 0 &&
            <div className="text-center py-10">
                  <Mail className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhum e-mail enviado ainda</p>
                </div>
            }
            </div>
          }
        </div>
      </div>

      {/* Bottom panel: Histórico */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
          <span className="text-sm font-medium text-foreground">Histórico</span>
          {allItems.length > 0 &&
          <span className="text-[11px] text-muted-foreground">{allItems.length} registro{allItems.length !== 1 ? "s" : ""}</span>
          }
        </div>
        <div className="p-5">
          <div className="space-y-0 max-h-[480px] overflow-y-auto pr-1">
            {allItems.length === 0 ?
            <div className="text-center py-10">
                <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Nenhum registro ainda</p>
              </div> :

            allItems.map((item) => <TimelineItem key={item.id} item={item} />)
            }
          </div>
        </div>
      </div>
    </div>);

}