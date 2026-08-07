import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Clock, MessageCircle, Download } from "lucide-react";
import EmailIframe from "./EmailIframe";

const catStyles = {
  publicas: { label: "Pública", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  internas: { label: "Interna", cls: "bg-muted text-muted-foreground" },
  mensagens: { label: "Mensagem", cls: "bg-primary/10 text-primary" },
  alteracoes: { label: "Alteração", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export default function TimelineRecordCard({ item, avatarUrl, expanded, onToggle, formatDateTime }) {
  const initials = (item.author || "?").split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const cat = catStyles[item.category] || catStyles.internas;

  return (
    <div className="flex gap-3">
      <Avatar className="w-9 h-9 flex-shrink-0 border border-border">
        <AvatarImage src={avatarUrl} alt={item.author} />
        <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-bold">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 rounded-xl border border-border bg-card p-3.5">
        {/* Cabeçalho: autor + data + contador + badges */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <span className="text-[13px] font-semibold text-foreground">{item.author || "Sistema"}</span>
            <span className="text-[11px] text-muted-foreground ml-2">{item.displayDate || formatDateTime(item.timestamp)}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
              Ação #{item.seq}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${cat.cls}`}>{cat.label}</span>
            {item.hasEmail && (
              <button
                onClick={onToggle}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium hover:bg-sky-500/20 transition-colors"
              >
                <Mail className="w-3 h-3" /> E-mail ·
                <span className="underline underline-offset-2">{expanded ? "Ocultar" : "Visualizar"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Apontamento / ação */}
        {item.type === "acao" && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.entry.date} · {item.entry.start_time}–{item.entry.end_time}
              </span>
              {item.entry.normal_hours > 0 && <span>{item.entry.normal_hours.toFixed(1)}h normal</span>}
              {item.entry.extra_hours > 0 && <span>{item.entry.extra_hours.toFixed(1)}h extra</span>}
              {item.entry.hour_type === "interna" && <span>Hora interna</span>}
            </div>
            {item.entry.activities?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.entry.activities.map((a, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a}</span>
                ))}
              </div>
            )}
            {item.entry.description && !expanded && (
              <div
                className="text-sm text-foreground leading-relaxed [&_img]:max-w-full [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: item.entry.description }}
              />
            )}
          </div>
        )}

        {/* Mensagem de e-mail */}
        {item.type === "email" && (
          <div className="mt-2">
            <p className="text-sm font-medium text-foreground">{item.mail.subject}</p>
          </div>
        )}

        {/* Evento / alteração */}
        {item.type === "evento" && (
          <div className="mt-2">
            <p className="text-sm text-foreground">{item.event.description}</p>
            {item.event.old_value && item.event.new_value && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {item.event.old_value} <span className="mx-1">→</span>
                <span className="text-primary font-medium">{item.event.new_value}</span>
              </p>
            )}
          </div>
        )}

        {/* WhatsApp */}
        {item.type === "whatsapp" && (
          <div className="mt-2 flex items-start gap-2">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground whitespace-pre-wrap">{item.text || "[Mídia]"}</p>
          </div>
        )}

        {/* Expansão: metadados do e-mail em texto simples + corpo rich text */}
        {expanded && item.hasEmail && item.mailMeta && (
          <div className="mt-3 border-t border-border pt-3 space-y-2.5">
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <p><span className="font-semibold text-foreground">De:</span> {item.mailMeta.from}</p>
              <p><span className="font-semibold text-foreground">Para:</span> {item.mailMeta.to || "—"}</p>
              {item.mailMeta.cc && <p><span className="font-semibold text-foreground">Cc:</span> {item.mailMeta.cc}</p>}
              <p><span className="font-semibold text-foreground">Enviado em:</span> {formatDateTime(item.mailMeta.sentAt)}</p>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <EmailIframe html={item.mailMeta.body} />
            </div>
            {item.mail?.attachments?.length > 0 && (
              <div className="space-y-1">
                {item.mail.attachments.map((att, i) => (
                  <a key={i} href={att.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-primary hover:underline">
                    <Download className="w-3 h-3" /> {att.file_name}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}