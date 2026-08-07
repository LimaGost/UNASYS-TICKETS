import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock } from "lucide-react";
import { toZonedTime, format as tzFormat } from "date-fns-tz";
import TimelineRecordCard from "./TimelineRecordCard";

const TZ = "America/Sao_Paulo";
const PAGE = 15;

function toUTC(dateStr) {
  if (!dateStr) return null;
  if (dateStr.endsWith?.("Z") || dateStr.includes?.("+") || /[0-9]T[0-9].*[-+][0-9]/.test(dateStr)) return new Date(dateStr);
  return new Date(String(dateStr).replace(" ", "T") + "Z");
}

function formatDateTime(d) {
  if (!d) return "";
  try {
    return tzFormat(toZonedTime(toUTC(d), TZ), "dd/MM/yyyy 'às' HH:mm", { timeZone: TZ });
  } catch {
    return "";
  }
}

const FILTERS = [
  { key: "publicas", label: "Ações públicas" },
  { key: "internas", label: "Ações internas" },
  { key: "mensagens", label: "Mensagens" },
  { key: "alteracoes", label: "Histórico de alterações" },
];

export default function ActivityTimeline({ ticket }) {
  const [filters, setFilters] = useState({ publicas: true, internas: true, mensagens: true, alteracoes: true });
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [expanded, setExpanded] = useState({});

  const { data: events = [] } = useQuery({
    queryKey: ["ticketEvents", ticket.id],
    queryFn: () => api.entities.TicketEvent.filter({ ticket_id: ticket.id }),
    refetchInterval: 10000,
  });
  const { data: emails = [] } = useQuery({
    queryKey: ["ticketEmails", ticket.id],
    queryFn: () => api.entities.TicketEmail.filter({ ticket_id: ticket.id }),
    refetchInterval: 10000,
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", ticket.id],
    queryFn: () => api.entities.TimeEntry.filter({ ticket_id: ticket.id }),
    refetchInterval: 10000,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.entities.User.list(),
  });

  // WhatsApp vinculado (se houver)
  const { data: linkedAttendance } = useQuery({
    queryKey: ["whatsapp-attendance", ticket.id],
    queryFn: async () => (await api.entities.WhatsAppAtendimentoVinculado.filter({ ticket_id: ticket.id }))[0] || null,
    refetchInterval: 10000,
  });
  const { data: chatDetail } = useQuery({
    queryKey: ["whatsapp-chat-detail", linkedAttendance?.attendance_id],
    queryFn: async () => {
      const res = await api.functions.invoke("fetchMetabotChats", { action: "chat", chat_id: linkedAttendance.attendance_id });
      return res.data?.data;
    },
    enabled: !!linkedAttendance?.attendance_id,
    refetchInterval: 10000,
  });

  const allItems = useMemo(() => {
    const items = [];

    // Apontamentos / ações de atendimento
    // timestamp usa a DATA DO APONTAMENTO (e.date + horário de início), não a data
    // de criação do registro — um apontamento lançado hoje para um dia anterior
    // precisa ordenar/exibir na posição do dia trabalhado.
    timeEntries.forEach(e => {
      const hasEmail = !!e.email_sent_to || e.notify_client === true;
      const apontamentoTimestamp = e.date ? `${e.date}T${e.start_time || "00:00"}:00` : e.created_date;
      // displayDate: formatado direto a partir de date/start_time (sem conversão de fuso,
      // pois já são horário local de Brasília) — formatDateTime faria uma 2ª conversão incorreta.
      const displayDate = e.date
        ? (() => { const [y, m, d] = e.date.slice(0, 10).split("-"); return `${d}/${m}/${y}${e.start_time ? ` às ${e.start_time}` : ""}`; })()
        : null;
      items.push({
        id: `te-${e.id}`, type: "acao", timestamp: apontamentoTimestamp, displayDate,
        category: hasEmail ? "publicas" : "internas",
        author: e.technician_name, authorEmail: e.technician_email,
        entry: e, hasEmail,
        mailMeta: hasEmail ? {
          from: e.technician_email,
          to: e.email_sent_to || ticket.client_email,
          sentAt: e.created_date,
          body: e.description,
        } : null,
      });
    });

    // E-mails do ticket
    emails.forEach(m => {
      items.push({
        id: `em-${m.id}`, type: "email", timestamp: m.created_date,
        category: "mensagens",
        author: m.from_name || m.from_email, authorEmail: m.from_email,
        mail: m, hasEmail: true,
        mailMeta: {
          from: m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email,
          to: (m.to || []).join(", "),
          cc: m.cc?.length ? m.cc.join(", ") : null,
          sentAt: m.created_date,
          body: m.body,
        },
      });
    });

    // Eventos do sistema (time_entry é omitido: já representado pelo apontamento)
    events.forEach(ev => {
      if (ev.type === "time_entry") return;
      const category = ev.type === "comment_internal" ? "internas"
        : ev.type === "comment_client" ? "publicas"
        : "alteracoes";
      items.push({
        id: `ev-${ev.id}`, type: "evento", timestamp: ev.created_date,
        category, author: ev.user_name, authorEmail: ev.user_email,
        event: ev, hasEmail: false,
      });
    });

    // Mensagens WhatsApp
    (chatDetail?.messages || []).forEach((msg, idx) => {
      items.push({
        id: `wa-${idx}`, type: "whatsapp",
        timestamp: msg.utcDhMessage || msg.utcDhMessageUnixTime,
        category: "mensagens",
        author: msg.sender?.isMe ? "Você (WhatsApp)" : (linkedAttendance?.contact_name || "Cliente"),
        text: msg.text || msg.content, hasEmail: false,
      });
    });

    // Contador sequencial cronológico
    items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    items.forEach((it, i) => { it.seq = i + 1; });
    return items.reverse(); // mais recentes primeiro
  }, [timeEntries, emails, events, chatDetail, linkedAttendance, ticket.client_email]);

  const filtered = allItems.filter(it => filters[it.category]);
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  return (
    <div className="space-y-4">
      {/* Filtros por categoria */}
      <div className="flex items-center gap-4 flex-wrap pb-3 border-b border-border">
        {FILTERS.map(f => (
          <label key={f.key} className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox
              checked={filters[f.key]}
              onCheckedChange={(v) => { setFilters(prev => ({ ...prev, [f.key]: !!v })); setVisibleCount(PAGE); }}
            />
            <span className="text-[11px] text-muted-foreground">{f.label}</span>
          </label>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{filtered.length} registros</span>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum registro para os filtros selecionados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => {
            const user = users.find(u => u.email === item.authorEmail);
            return (
              <TimelineRecordCard
                key={item.id}
                item={item}
                avatarUrl={user?.avatar_url || user?.avatar}
                expanded={!!expanded[item.id]}
                onToggle={() => setExpanded(p => ({ ...p, [item.id]: !p[item.id] }))}
                formatDateTime={formatDateTime}
              />
            );
          })}
        </div>
      )}

      {remaining > 0 && (
        <button
          onClick={() => setVisibleCount(c => c + PAGE)}
          className="w-full py-2.5 rounded-lg border border-border text-[12px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
        >
          Carregar mais ({remaining} registros mais antigos)
        </button>
      )}
    </div>
  );
}