import React from "react";
import { Mail, MessageCircle, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CommunicationTimeline({ events = [] }) {
  const communicationEvents = events.filter(e => 
    ["comment_client", "comment_internal", "email_sent"].includes(e.type)
  );

  const getEventIcon = (type) => {
    switch (type) {
      case "email_sent":
        return <Mail className="w-4 h-4" />;
      case "comment_client":
        return <MessageCircle className="w-4 h-4" />;
      case "comment_internal":
        return <MessageCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getEventBg = (type) => {
    switch (type) {
      case "email_sent":
        return "bg-blue-900/20 border-blue-700/30";
      case "comment_client":
        return "bg-green-900/20 border-green-700/30";
      case "comment_internal":
        return "bg-purple-900/20 border-purple-700/30";
      default:
        return "bg-gray-900/20 border-gray-700/30";
    }
  };

  const getEventLabel = (type) => {
    switch (type) {
      case "email_sent":
        return "Email enviado";
      case "comment_client":
        return "Mensagem ao cliente";
      case "comment_internal":
        return "Nota interna";
      default:
        return "Comunicação";
    }
  };

  if (communicationEvents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma comunicação registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {communicationEvents.map((event, idx) => (
        <div
          key={idx}
          className={`border rounded-lg p-4 ${getEventBg(event.type)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {getEventIcon(event.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm text-white">
                  {getEventLabel(event.type)}
                </h4>
                {event.visible_to_client && (
                  <span className="text-xs px-2 py-1 bg-green-900/40 text-green-300 rounded">
                    Visível ao cliente
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-2">
                {format(new Date(event.created_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                {event.user_name && ` • ${event.user_name}`}
              </p>

              {event.description && (
                <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                  {event.description}
                </p>
              )}

              {event.email_sent && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  Email enviado para: {event.email_sent_to}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}