import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { ChevronDown, ChevronUp, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function GroupedKanbanCard({ groupName, tickets, groupBy }) {
  const [expanded, setExpanded] = useState(true);

  const urgencyCount = {
    critica: tickets.filter(t => t.urgency === "critica").length,
    alta: tickets.filter(t => t.urgency === "alta").length,
    media: tickets.filter(t => t.urgency === "media").length,
    baixa: tickets.filter(t => t.urgency === "baixa").length,
  };

  const overdueCount = tickets.filter(t => t.sla_breached).length;

  return (
    <div className="bg-[#0B0D15] border-2 border-[rgba(139,92,246,0.2)] rounded-xl overflow-hidden mb-3">
      {/* Group Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-[#161830] hover:bg-[#1C1F3A] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center text-white font-bold text-sm">
            {tickets.length}
          </div>
          <div className="text-left">
            <h4 className="text-sm font-semibold text-gray-200">{groupName}</h4>
            <p className="text-xs text-gray-500">
              {groupBy === "client" ? "Cliente" : "Solicitante"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Urgency indicators */}
          <div className="flex items-center gap-1.5">
            {urgencyCount.critica > 0 && (
              <Badge className="bg-[#EF4444]/20 text-[#EF4444] text-xs border border-[#EF4444]/30">
                {urgencyCount.critica}
              </Badge>
            )}
            {urgencyCount.alta > 0 && (
              <Badge className="bg-[#F97316]/20 text-[#F97316] text-xs border border-[#F97316]/30">
                {urgencyCount.alta}
              </Badge>
            )}
            {overdueCount > 0 && (
              <Badge className="bg-[#EF4444] text-white text-xs flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-3 h-3" />
                {overdueCount}
              </Badge>
            )}
          </div>

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Tickets List */}
      {expanded && (
        <div className="p-2 space-y-2">
          {tickets.map(ticket => (
            <Link key={ticket.id} to={createPageUrl("TicketDetail") + `?id=${ticket.id}`}>
              <div className={`
                relative p-3 rounded-lg border-2 cursor-pointer
                hover:border-[#8B5CF6] hover:shadow-lg hover:shadow-[#8B5CF6]/10
                transition-all duration-200 group
                ${ticket.sla_breached
                  ? "bg-[#EF4444]/5 border-[#EF4444]/30"
                  : "bg-[#161830] border-[rgba(139,92,246,0.15)]"
                }
              `}>
                {/* SLA Indicator */}
                {ticket.sla_breached && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#EF4444] rounded-full flex items-center justify-center animate-pulse">
                    <AlertCircle className="w-3 h-3 text-white" />
                  </div>
                )}

                <div className="flex items-start justify-between gap-2 mb-2">
                  <h5 className="text-xs font-semibold text-gray-200 group-hover:text-white line-clamp-1 flex-1">
                    {ticket.title}
                  </h5>
                  <Badge
                    className={`text-[10px] px-1.5 py-0.5 ${
                      ticket.urgency === "critica" ? "bg-[#EF4444]/20 text-[#EF4444]" :
                      ticket.urgency === "alta" ? "bg-[#F97316]/20 text-[#F97316]" :
                      ticket.urgency === "media" ? "bg-[#F59E0B]/20 text-[#F59E0B]" :
                      "bg-[#10B981]/20 text-[#10B981]"
                    }`}
                  >
                    {ticket.urgency}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 truncate">
                    {groupBy === "client" ? ticket.requester : ticket.client_name}
                  </span>
                  {ticket.expected_resolution && (
                    <span className={`flex items-center gap-1 font-semibold ${
                      ticket.sla_breached ? "text-[#EF4444]" : "text-gray-500"
                    }`}>
                      <Clock className="w-3 h-3" />
                      {format(new Date(ticket.expected_resolution), "dd/MM HH:mm")}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}