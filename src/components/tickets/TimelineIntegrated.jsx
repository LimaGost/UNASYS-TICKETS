import React, { useMemo, useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { MessageCircle, FileText, CheckCircle, Clock, AlertCircle, User, Mail, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, format as tzFormat } from "date-fns-tz";
const TZ = "America/Sao_Paulo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function formatTime(dateStr) {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

function toUTC(dateStr) {
  if (!dateStr) return null;
  if (dateStr.endsWith("Z") || dateStr.includes("+") || /[0-9]T[0-9].*[-+][0-9]/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr.replace(" ", "T") + "Z");
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  try {
    return tzFormat(toZonedTime(toUTC(dateStr), TZ), "dd/MM/yyyy 'às' HH:mm", { timeZone: TZ });
  } catch {
    return "";
  }
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function EmailIframe({ html }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(200);

  const fullHtml = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0 !important; padding: 12px !important;
      background: #ffffff !important; color: #111111 !important;
      font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;
      word-break: break-word;
    }
    img { max-width: 100% !important; height: auto !important; display: block; }
    a { color: #6d28d9; }
    * { box-sizing: border-box; max-width: 100%; }
    [style*="color: white"], [style*="color:#fff"], [style*="color: #fff"],
    [style*="color:white"], [style*="color: transparent"], [style*="color:transparent"] {
      color: #111111 !important;
    }
  </style>
</head><body>${html || "<p style='color:#999'>Sem conteúdo</p>"}</body></html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(fullHtml); doc.close();
    const resize = () => {
      try {
        const h = doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 200;
        setHeight(Math.min(Math.max(h + 20, 80), 1000));
      } catch {}
    };
    iframe.onload = () => setTimeout(resize, 150);
    setTimeout(resize, 300);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      style={{ width: "100%", height, border: "none", borderRadius: "6px", background: "#ffffff", display: "block" }}
      sandbox="allow-same-origin"
      title="email-body"
    />
  );
}

const EventIcon = ({ type, isPlatform }) => {
  if (isPlatform) return <Mail className="w-4 h-4 text-blue-400" />;
  
  switch (type) {
    case "creation":
      return <FileText className="w-4 h-4 text-green-400" />;
    case "status_change":
      return <CheckCircle className="w-4 h-4 text-purple-400" />;
    case "time_entry":
      return <Clock className="w-4 h-4 text-yellow-400" />;
    case "comment_client":
      return <MessageCircle className="w-4 h-4 text-blue-400" />;
    case "comment_internal":
      return <FileText className="w-4 h-4 text-gray-400" />;
    case "assignment":
      return <User className="w-4 h-4 text-cyan-400" />;
    case "field_change":
      return <AlertCircle className="w-4 h-4 text-orange-400" />;
    case "whatsapp_message":
      return <MessageCircle className="w-4 h-4 text-green-400" />;
    default:
      return <FileText className="w-4 h-4 text-gray-400" />;
  }
};

export default function TimelineIntegrated({ ticket }) {
  // Buscar eventos do ticket com refresh automático
  const { data: events = [] } = useQuery({
    queryKey: ["ticket-events", ticket.id],
    queryFn: async () => {
      try {
        return await api.entities.TicketEvent.filter({ ticket_id: ticket.id });
      } catch {
        return [];
      }
    },
    enabled: !!ticket.id,
    refetchInterval: 3000, // Atualizar a cada 3 segundos
    refetchOnWindowFocus: true,
  });

  // Buscar mensagens WhatsApp vinculadas
  const { data: linkedAttendance } = useQuery({
    queryKey: ["whatsapp-attendance", ticket.id],
    queryFn: async () => {
      const attendances = await api.entities.WhatsAppAtendimentoVinculado.filter({
        ticket_id: ticket.id,
      });
      return attendances[0] || null;
    },
    enabled: !!ticket.id,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const { data: chatDetail } = useQuery({
    queryKey: ["whatsapp-chat-detail", linkedAttendance?.attendance_id],
    queryFn: async () => {
      const res = await api.functions.invoke("fetchMetabotChats", {
        action: "chat",
        chat_id: linkedAttendance.attendance_id,
      });
      return res.data?.data;
    },
    enabled: !!linkedAttendance?.attendance_id,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const { data: client } = useQuery({
    queryKey: ["client", ticket.client_id],
    queryFn: async () => {
      try {
        return await api.entities.Client.get(ticket.client_id);
      } catch {
        return null;
      }
    },
    enabled: !!ticket.client_id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        return await api.entities.User.list();
      } catch {
        return [];
      }
    },
  });

  // Buscar e-mails do ticket
  const { data: emails = [] } = useQuery({
    queryKey: ["ticketEmails", ticket.id],
    queryFn: async () => {
      try {
        return await api.entities.TicketEmail.filter({ ticket_id: ticket.id });
      } catch {
        return [];
      }
    },
    enabled: !!ticket.id,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  // Combinar e ordenar eventos cronologicamente, agrupados por data
  const timeline = useMemo(() => {
    const items = [];

    // Adicionar eventos do sistema
    events.forEach((event) => {
      items.push({
        id: `event-${event.id}`,
        type: "event",
        timestamp: event.created_date,
        event,
      });
    });

    // Adicionar e-mails
    emails.forEach((email) => {
      items.push({
        id: `email-${email.id}`,
        type: "email",
        timestamp: email.created_date,
        email,
      });
    });

    // Adicionar mensagens WhatsApp
    if (chatDetail?.messages) {
      chatDetail.messages.forEach((msg, idx) => {
        items.push({
          id: `whatsapp-${idx}`,
          type: "whatsapp",
          timestamp: msg.utcDhMessage || msg.utcDhMessageUnixTime,
          msg,
        });
      });
    }

    // Ordenar por data (mais recentes primeiro)
    items.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    // Agrupar por data (fuso Brasília)
    const grouped = {};
    items.forEach((item) => {
      const dateKey = tzFormat(toZonedTime(toUTC(item.timestamp), TZ), "dd/MM/yyyy", { timeZone: TZ });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    });

    return { items, grouped };
  }, [events, chatDetail, emails]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Linha do Tempo
          <span className="ml-3 inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title="Atualizando em tempo real"></span>
        </h3>
        <p className="text-sm text-muted-foreground">
          {timeline.items.length} atividades desde a criação do ticket
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {timeline.items.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma atividade registrada</p>
          </div>
        ) : (
          Object.entries(timeline.grouped).map(([dateKey, dayItems]) => (
            <div key={dateKey} className="space-y-4">
              {/* Data separadora */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-[1px] bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3">
                  {dateKey}
                </span>
                <div className="flex-1 h-[1px] bg-border" />
              </div>

              {/* Itens do dia */}
              <div className="space-y-4">
                {dayItems.map((item, idx) => (
            <div key={item.id} className="flex gap-4 relative">
               {/* Linha conectora */}
               {idx < dayItems.length - 1 && (
                 <div className="absolute left-6 top-12 bottom-0 w-[1px] bg-border" />
               )}

              {/* Evento do Sistema */}
              {item.type === "event" && (() => {
                const user = users.find(u => u.email === item.event.user_email);
                const initials = getInitials(item.event.user_name || user?.full_name || "?");
                return (
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    {/* Avatar do usuário */}
                    <div className="relative z-10 flex-shrink-0">
                      <Avatar className="w-12 h-12 border-2 border-primary">
                        <AvatarImage src={user?.avatar} alt={item.event.user_name} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 bg-card rounded-lg p-4 border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground text-sm">
                            {item.event.user_name || user?.full_name || "Sistema"}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.event.user_email || "sistema"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDateTime(item.event.created_date)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(item.event.created_date)}
                        </span>
                      </div>

                      <p className="text-sm text-foreground leading-relaxed">
                        {item.event.description}
                      </p>

                      {item.event.old_value && item.event.new_value && (
                        <div className="mt-3 text-xs bg-muted rounded p-2 border border-border">
                          <span className="text-muted-foreground">
                            {item.event.old_value}
                          </span>
                          <span className="text-muted-foreground mx-2">→</span>
                          <span className="text-primary">{item.event.new_value}</span>
                        </div>
                      )}

                      {item.event.visible_to_client && (
                        <div className="mt-2 inline-block">
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded">
                            ✓ Visível ao cliente
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* E-mail */}
              {item.type === "email" && (() => {
                const user = users.find(u => u.email === item.email.from_email);
                const initials = getInitials(item.email.from_name || user?.full_name || "?");
                const isSent = item.email.direction === "sent";

                return (
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative z-10 flex-shrink-0">
                        <Avatar className="w-12 h-12 border-2 border-cyan-500">
                          <AvatarImage src={user?.avatar} alt={item.email.from_name} />
                          <AvatarFallback className="bg-cyan-500 text-white font-bold text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 bg-card rounded-lg p-4 border border-border">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-cyan-500" />
                              <h4 className="font-semibold text-foreground text-sm">
                                {isSent ? `Enviado por ${item.email.from_name}` : `Recebido de ${item.email.from_name}`}
                              </h4>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.email.from_email}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDateTime(item.email.created_date)}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-1 rounded font-medium ${
                            isSent
                              ? "bg-primary/15 text-primary"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {isSent ? "Enviado" : "Recebido"}
                          </span>
                        </div>

                        {/* Assunto */}
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Assunto</p>
                          <p className="text-sm text-foreground font-medium">{item.email.subject}</p>
                        </div>

                        {/* Destinatários */}
                        {item.email.to?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-muted-foreground mb-1">Destinatários</p>
                            <div className="flex flex-wrap gap-1">
                              {item.email.to.map((recipient, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-muted text-foreground px-2 py-0.5 rounded"
                                >
                                  {recipient}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Corpo do e-mail */}
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                          <div className="border border-border rounded-lg overflow-hidden">
                            <EmailIframe html={item.email.body} />
                          </div>
                        </div>

                        {/* Anexos */}
                        {item.email.attachments?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-muted-foreground mb-2">Anexos</p>
                            <div className="space-y-1">
                              {item.email.attachments.map((att, idx) => (
                                <a
                                  key={idx}
                                  href={att.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  {att.file_name}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CC e BCC */}
                        <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground">
                          {item.email.cc?.length > 0 && (
                            <span>CC: {item.email.cc.length}</span>
                          )}
                          {item.email.bcc?.length > 0 && (
                            <span>· CCO: {item.email.bcc.length}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Mensagem WhatsApp */}
              {item.type === "whatsapp" && (
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    {/* Avatar do contato */}
                    <div className="relative z-10 flex-shrink-0">
                      <Avatar className="w-12 h-12 border-2 border-[#25D366]">
                        <AvatarImage
                          src={linkedAttendance?.contact_image}
                          alt={linkedAttendance?.contact_name}
                        />
                        <AvatarFallback className="bg-[#25D366] text-white font-bold">
                          {linkedAttendance?.contact_name?.charAt(0) || "C"}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Conteúdo */}
                    <div
                      className={`flex-1 rounded-lg p-4 border ${
                        item.msg.sender?.isMe
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground text-sm">
                            {item.msg.sender?.isMe
                              ? "Você (via WhatsApp)"
                              : linkedAttendance?.contact_name || "Cliente"}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDateTime(item.msg.utcDhMessage)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(item.msg.utcDhMessage)}
                        </span>
                      </div>

                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {item.msg.text || item.msg.content || "[Mídia]"}
                      </p>

                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <MessageCircle className="w-3 h-3 text-emerald-500" />
                        <span>WhatsApp</span>
                        {item.msg.sender?.isMe && (
                          <>
                            <span>•</span>
                            <span>Enviado</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
               ))}
              </div>
              </div>
              ))
              )}
              </div>
              </div>
              );
              }