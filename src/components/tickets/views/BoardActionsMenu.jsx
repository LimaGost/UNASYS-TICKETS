import React from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Download } from "lucide-react";
import { toast } from "sonner";

const fmt = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "");

export default function BoardActionsMenu({ tickets, viewName }) {
  const exportCSV = () => {
    const headers = ["Número", "Título", "Cliente", "Solicitante", "Responsável", "Urgência", "Status", "Sub-status", "Vertical", "Criado em", "Previsão", "Encerrado em"];
    const rows = tickets.map(t => [
      t.ticket_number ?? "", t.title, t.client_name, t.requester, t.assigned_to_name,
      t.urgency, t.status_column_title, t.sub_status, t.vertical,
      fmt(t.created_date), fmt(t.expected_resolution), fmt(t.closed_at),
    ]);
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(esc).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tickets_${(viewName || "todos").replace(/\s+/g, "_").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${tickets.length} tickets exportados`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 w-8 p-0" aria-label="Ações do quadro">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={exportCSV} className="text-xs gap-2 cursor-pointer">
          <Download className="w-3.5 h-3.5" /> Exportar tickets (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}