import React from "react";
import { Timer, Clock, Plus, User, Mail, Download, Paperclip } from "lucide-react";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

const TZ = "America/Sao_Paulo";
function fmtBR(dateStr) {
  if (!dateStr) return "";
  try {
    // Garante que a string seja interpretada como UTC se não tiver offset explícito
    const normalized = dateStr.endsWith("Z") || dateStr.includes("+") || /[0-9]T[0-9].*[-+][0-9]/.test(dateStr)
      ? dateStr
      : dateStr.replace(" ", "T") + "Z";
    return tzFormat(toZonedTime(new Date(normalized), TZ), "dd/MM/yyyy 'às' HH:mm", { timeZone: TZ });
  } catch { return ""; }
}

// Formata a DATA DO APONTAMENTO (campo TimeEntry.date, ex: "2026-08-04") + horário
// de início informado pelo analista — NÃO a data de criação do registro (created_date).
// Um registro pode ser criado hoje (05/08) apontando horas para ontem (04/08); o que
// deve aparecer na timeline do ticket é o dia trabalhado, não o dia em que foi digitado.
function fmtApontamento(dateStr, startTime) {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const base = `${dd}/${mm}/${y}`;
    return startTime ? `${base} às ${startTime}` : base;
  } catch { return ""; }
}

export default function TimelineItem({ item }) {
  if (item._type === "time") {
    const isEmail = !!item.email_sent_to;
    const totalHours = (item.normal_hours || 0) + (item.extra_hours || 0);

    const formatHourTime = (hours) => {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return `${h}h${m > 0 ? ` ${m}min` : ""}`;
    };

    return (
      <div className="mb-6 pb-6 border-b border-border last:border-0 last:pb-0 last:mb-0">
        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-4 mb-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isEmail ? "bg-amber-500/15" : "bg-emerald-500/15"}`}>
                {isEmail ? <Mail className="w-5 h-5 text-amber-500" /> : <Timer className="w-5 h-5 text-emerald-500" />}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  {item.technician_name || "Sistema"}
                  {isEmail && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-semibold">
                      Email enviado
                    </span>
                  )}
                  {item.hour_type === "interna" && (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                      Hora Interna
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {fmtApontamento(item.date, item.start_time)}
                  </p>
                  {(item.start_time || item.end_time) && (
                    <>
                      <span className="text-muted-foreground/40">•</span>
                      <p className="text-xs text-muted-foreground">
                        {item.start_time} - {item.end_time}
                        {item.start_time2 && item.end_time2 && <> · {item.start_time2} - {item.end_time2}</>}
                      </p>
                    </>
                  )}
                  {item.date && item.date.slice(0, 10) !== (item.created_date || "").slice(0, 10) && (
                    <>
                      <span className="text-muted-foreground/40">•</span>
                      <p className="text-[10px] text-muted-foreground/70" title="Data em que o registro foi lançado no sistema">
                        lançado em {fmtBR(item.created_date)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Hours Breakdown */}
          {item.hour_type !== "interna" && totalHours > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {item.normal_hours > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Normal</p>
                  <p className="text-sm font-bold text-emerald-500">{formatHourTime(item.normal_hours)}</p>
                </div>
              )}
              {item.extra_hours > 0 && (
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Extra</p>
                  <p className="text-sm font-bold text-cyan-500">{formatHourTime(item.extra_hours)}</p>
                </div>
              )}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Total</p>
                <p className="text-sm font-bold text-primary">{formatHourTime(totalHours)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        {item.description && (
          <div className="bg-card rounded-xl p-5 mb-3 border border-border">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {isEmail ? "Comunicação Enviada" : "Descrição da Atividade"}
              </span>
            </div>
            <div
              className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none
                [&_p]:mb-3 [&_p]:last:mb-0
                [&_ul]:mb-3 [&_ul]:ml-4 [&_ul]:list-disc
                [&_ol]:mb-3 [&_ol]:ml-4 [&_ol]:list-decimal
                [&_li]:mb-1
                [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2
                [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-4
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2
                [&_strong]:font-bold
                [&_a]:text-primary [&_a]:underline [&_a]:hover:text-primary/80
                [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:overflow-x-auto
                [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3 [&_img]:border [&_img]:border-border"
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          </div>
        )}

        {/* Attachments */}
        {item.attachments && item.attachments.length > 0 && (
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Anexos ({item.attachments.length})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {item.attachments.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted border border-border hover:border-primary hover:bg-primary/5 transition-all">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Paperclip className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">Anexo {idx + 1}</p>
                    <p className="text-[10px] text-muted-foreground">Clique para abrir</p>
                  </div>
                  <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        {item.email_sent_to && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <Mail className="w-4 h-4 text-emerald-500" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-500">Email Enviado</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Para: {item.email_sent_to}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Event - System History Item
  const eventConfig = {
    creation: { icon: Plus, colorClass: "text-primary", bgClass: "bg-primary/15", label: "Criação" },
    status_change: { icon: Clock, colorClass: "text-blue-500", bgClass: "bg-blue-500/15", label: "Mudança de Status" },
    comment_internal: { icon: User, colorClass: "text-muted-foreground", bgClass: "bg-muted", label: "Nota Interna" },
    comment_client: { icon: Mail, colorClass: "text-amber-500", bgClass: "bg-amber-500/15", label: "Comunicação com Cliente" },
    assignment: { icon: User, colorClass: "text-emerald-500", bgClass: "bg-emerald-500/15", label: "Atribuição" },
    field_change: { icon: Clock, colorClass: "text-muted-foreground", bgClass: "bg-muted", label: "Alteração" },
  }[item.type] || { icon: Clock, colorClass: "text-muted-foreground", bgClass: "bg-muted", label: "Evento" };

  const EventIcon = eventConfig.icon;

  return (
    <div className="mb-4 pb-4 border-b border-border last:border-0 last:pb-0 last:mb-0">
      <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border">
        <div className={`w-8 h-8 rounded-lg ${eventConfig.bgClass} flex items-center justify-center flex-shrink-0`}>
          <EventIcon className={`w-4 h-4 ${eventConfig.colorClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1">
              <p className="text-xs font-bold text-foreground">{eventConfig.label}</p>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                <span>{fmtBR(item.created_date)}</span>
                {item.user_name && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span>{item.user_name}</span>
                  </>
                )}
              </p>
            </div>
            {item.email_sent && (
              <span className="text-[10px] px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-500 font-semibold border border-emerald-500/20 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </span>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}