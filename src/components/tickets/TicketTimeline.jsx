import React from "react";
import { format } from "date-fns";
import {
  PlusCircle, ArrowRightLeft, Clock, MessageSquare, MessageCircle, UserCheck, Edit
} from "lucide-react";

const typeConfig = {
  creation: { icon: PlusCircle, color: "text-[#8B5CF6]", bg: "bg-[#8B5CF6]/15" },
  status_change: { icon: ArrowRightLeft, color: "text-[#3B82F6]", bg: "bg-[#3B82F6]/15" },
  time_entry: { icon: Clock, color: "text-[#10B981]", bg: "bg-[#10B981]/15" },
  comment_internal: { icon: MessageSquare, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/15" },
  comment_client: { icon: MessageCircle, color: "text-[#06B6D4]", bg: "bg-[#06B6D4]/15" },
  assignment: { icon: UserCheck, color: "text-[#A78BFA]", bg: "bg-[#A78BFA]/15" },
  field_change: { icon: Edit, color: "text-gray-400", bg: "bg-gray-500/15" },
};

export default function TicketTimeline({ events }) {
  const sorted = [...events].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="space-y-0">
      {sorted.map((evt, i) => {
        const cfg = typeConfig[evt.type] || typeConfig.field_change;
        const Icon = cfg.icon;
        return (
          <div key={evt.id} className="flex gap-3 relative">
            {/* Line */}
            {i < sorted.length - 1 && (
              <div className="absolute left-[17px] top-10 bottom-0 w-px bg-[rgba(139,92,246,0.1)]" />
            )}
            {/* Icon */}
            <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 z-10`}>
              <Icon className={`w-4 h-4 ${cfg.color}`} />
            </div>
            {/* Content */}
            <div className="flex-1 pb-6">
              <p className="text-sm text-gray-300">{evt.description}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] text-gray-600">
                  {format(new Date(evt.created_date), "dd/MM/yyyy HH:mm")}
                </span>
                {evt.user_name && (
                  <span className="text-[11px] text-gray-500">por {evt.user_name}</span>
                )}
                {evt.email_sent && (
                  <span className="text-[10px] text-[#8B5CF6] bg-[#8B5CF6]/10 px-1.5 py-0.5 rounded">
                    E-mail enviado
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {sorted.length === 0 && (
        <p className="text-sm text-gray-600 text-center py-8">Nenhum evento registrado</p>
      )}
    </div>
  );
}