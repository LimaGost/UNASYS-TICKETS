import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Mail, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function InboxPanel({ userEmail }) {
  // 1. Buscar tickets atribuídos ao colaborador
  const { data: myTickets = [] } = useQuery({
    queryKey: ["inbox-assigned-tickets", userEmail],
    queryFn: () => api.entities.Ticket.filter({ assigned_to: userEmail }, "-updated_date", 200),
    enabled: !!userEmail,
  });

  const myTicketIds = myTickets.map(t => t.id);

  // 2. Buscar emails recebidos (respostas de clientes) nos tickets atribuídos
  const { data: clientEmails = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["inbox-client-replies", myTicketIds.join(",")],
    queryFn: async () => {
      if (myTicketIds.length === 0) return [];
      return api.entities.TicketEmail.filter(
        { direction: "received", ticket_id: { $in: myTicketIds } },
        "-created_date",
        20
      );
    },
    enabled: myTickets.length > 0,
  });

  const ticketMap = Object.fromEntries(myTickets.map(t => [t.id, t]));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-foreground">
          {isLoading ? "..." : `${clientEmails.length} resposta${clientEmails.length !== 1 ? "s" : ""} de clientes`}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      ) : clientEmails.length === 0 ? (
        <div className="text-center py-6">
          <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-xs text-muted-foreground">Nenhuma resposta de cliente nos seus tickets</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {clientEmails.map((email) => {
            const ticket = ticketMap[email.ticket_id];
            return (
              <div
                key={email.id}
                onClick={() => window.open(`/ticket/${email.ticket_id}`, "_self")}
                className="p-3 rounded-lg bg-muted/40 hover:bg-muted border border-border hover:border-primary/30 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate transition-colors">
                      {email.subject}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      De: {email.from_name || email.from_email}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                </div>
                {ticket && (
                  <p className="text-[10px] text-orange-500 truncate">
                    #{ticket.ticket_number} — {ticket.title}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(email.created_date), "dd MMM · HH:mm", { locale: ptBR })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}