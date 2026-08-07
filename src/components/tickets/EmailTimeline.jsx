import React, { useRef, useEffect, useState } from "react";
import { Mail, Download } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { toZonedTime, format as tzFormat } from "date-fns-tz";
const TZ = "America/Sao_Paulo";
function toUTC(dateStr) {
  if (!dateStr) return null;
  if (dateStr.endsWith("Z") || dateStr.includes("+") || /[0-9]T[0-9].*[-+][0-9]/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr.replace(" ", "T") + "Z");
}
function formatDateTime(dateStr) {
  if (!dateStr) return "";
  try { return tzFormat(toZonedTime(toUTC(dateStr), TZ), "dd/MM/yyyy 'às' HH:mm", { timeZone: TZ }); }
  catch { return ""; }
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

// Renderiza o HTML do email num iframe isolado para preservar estilos originais
function EmailIframe({ html }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(200);

  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0!important;padding:12px!important;background:#ffffff!important;color:#111111!important;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;word-break:break-word;}
  img{max-width:100%!important;height:auto!important;display:block;}
  a{color:#6d28d9;}
  *{box-sizing:border-box;max-width:100%;}
</style></head><body>${html || "<p style='color:#999'>Sem conteúdo</p>"}</body></html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(fullHtml); doc.close();
    const resize = () => {
      try { setHeight(Math.min(Math.max((doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 200) + 20, 80), 1000)); } catch {}
    };
    iframe.onload = () => setTimeout(resize, 150);
    setTimeout(resize, 300);
  }, [html]);

  return (
    <iframe ref={iframeRef} style={{ width: "100%", height, border: "none", borderRadius: "6px", background: "#ffffff", display: "block" }}
      sandbox="allow-same-origin" title="email-body" />
  );
}

export default function EmailTimeline({ emails }) {
  const sorted = [...emails].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="space-y-4">
      {sorted.map((email, i) => {
        const isSent = email.direction === "sent";
        const initials = getInitials(email.from_name || "?");

        return (
          <div key={email.id} className="flex gap-4 relative">
            {i < sorted.length - 1 && (
              <div className="absolute left-[17px] top-10 bottom-0 w-px bg-border" />
            )}

            {/* Icon */}
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0 z-10">
              <Mail className="w-4 h-4 text-cyan-500" />
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 border-2 border-cyan-500/40">
                      <AvatarFallback className="bg-cyan-500/20 text-cyan-600 font-bold text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{isSent ? "Enviado por" : "Recebido de"}</p>
                      <p className="text-sm text-foreground font-medium">{email.from_name || email.from_email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{email.from_email}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded font-medium ${isSent ? "bg-primary/15 text-primary" : "bg-emerald-500/15 text-emerald-500"}`}>
                    {isSent ? "Enviado" : "Recebido"}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Assunto</p>
                  <p className="text-sm text-foreground font-medium">{email.subject}</p>
                </div>

                {email.to?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Destinatários</p>
                    <div className="flex flex-wrap gap-1">
                      {email.to.map((recipient, idx) => (
                        <span key={idx} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{recipient}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <EmailIframe html={email.body} />
                  </div>
                </div>

                {email.attachments?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Anexos</p>
                    <div className="space-y-1">
                      {email.attachments.map((att, idx) => (
                        <a key={idx} href={att.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors">
                          <Download className="w-3 h-3" />
                          {att.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  {formatDateTime(email.created_date)}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {sorted.length === 0 && (
        <div className="text-center py-12">
          <Mail className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum e-mail registrado</p>
        </div>
      )}
    </div>
  );
}