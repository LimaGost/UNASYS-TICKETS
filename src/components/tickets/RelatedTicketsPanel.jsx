import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { GitBranch, ArrowUpRight } from "lucide-react";

export default function RelatedTicketsPanel({ ticket }) {
  const { data: allTickets = [] } = useQuery({
    queryKey: ["allTickets"],
    queryFn: async () => {
      const tickets = await api.entities.Ticket.list('created_date', 1000);
      return tickets.sort((a, b) =>
        new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
      );
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["childTickets", ticket.id],
    queryFn: () => api.entities.Ticket.filter({ parent_ticket_id: ticket.id }),
  });

  const { data: parent } = useQuery({
    queryKey: ["parentTicket", ticket.parent_ticket_id],
    queryFn: () => api.entities.Ticket.get(ticket.parent_ticket_id),
    enabled: !!ticket.parent_ticket_id,
  });

  const numberOf = (id) => {
    const idx = allTickets.findIndex(t => t.id === id);
    return idx >= 0 ? `#${String(idx + 1).padStart(4, "0")}` : `#${id.slice(0, 8)}`;
  };

  if (!ticket.parent_ticket_id && children.length === 0) return null;

  const TicketRow = ({ t }) => (
    <Link
      to={`/ticket/${t.id}`}
      className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted border border-border hover:border-primary/40 transition-all group"
    >
      <GitBranch className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground truncate font-medium">
          <span className="text-primary font-semibold">{numberOf(t.id)}</span> - {t.title}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{t.status_column_title || "—"}</p>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
    </Link>
  );

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      {ticket.parent_ticket_id && parent && (
        <div>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">Ticket Pai</p>
          <TicketRow t={parent} />
        </div>
      )}

      {children.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">
            Tickets Filhos <span className="text-primary">({children.length})</span>
          </p>
          <div className="space-y-1.5">
            {children.map(c => <TicketRow key={c.id} t={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}