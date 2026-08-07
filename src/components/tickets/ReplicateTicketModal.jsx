import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Copy } from "lucide-react";
import { toast } from "sonner";

// Campos que NÃO são herdados pelo ticket filho
const EXCLUDED_KEYS = new Set([
  "id", "created_date", "updated_date", "created_by_id", "created_by", "is_sample",
  "ticket_number", "title", "service_type",
  "status_column_id", "status_column_title", "sub_status",
  "sla_hours", "sla_breached", "expected_resolution", "closed_at",
  "notified", "total_normal_hours", "total_extra_hours",
  "parent_ticket_id", "parent_ticket_number", "parent_ticket_title",
]);

export default function ReplicateTicketModal({ ticket, ticketNumber, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState("");

  useEffect(() => {
    if (open) { setTitle(""); setServiceType(""); }
  }, [open]);

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => api.entities.ServiceType.list(),
    enabled: open,
  });

  const { data: kanbanConfigs = [] } = useQuery({
    queryKey: ["kanbanConfigs"],
    queryFn: () => api.entities.KanbanConfig.list(),
    enabled: open,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["systemConfigs"],
    queryFn: () => api.entities.SystemConfig.list(),
    enabled: open,
  });

  const serviceOptions = serviceTypes
    .filter(s => s.active !== false &&
      (!ticket.vertical || !s.vertical || s.vertical === ticket.vertical) &&
      (!ticket.ticket_type || !s.ticket_type || s.ticket_type === ticket.ticket_type))
    .map(s => ({ value: s.name, label: s.name }));

  const replicateMutation = useMutation({
    mutationFn: async () => {
      const user = await api.auth.me();

      // Herda todos os dados relevantes do ticket original
      const inherited = Object.fromEntries(
        Object.entries(ticket).filter(([k]) => !EXCLUDED_KEYS.has(k))
      );

      // Novo SLA baseado na urgência herdada
      const slaCfg = configs.find(c => c.key === `sla_${ticket.urgency}`);
      const slaHours = slaCfg ? parseInt(slaCfg.value) : 24;
      const expectedRes = new Date();
      expectedRes.setHours(expectedRes.getHours() + slaHours);

      // Novo status inicial: primeira coluna do Kanban
      const config = kanbanConfigs.find(
        c => c.main_type === ticket.main_type && c.vertical === ticket.vertical
      );
      const firstColumn = config?.columns
        ? [...config.columns].sort((a, b) => (a.order || 0) - (b.order || 0))[0]
        : null;

      const child = await api.entities.Ticket.create({
        ...inherited,
        title,
        service_type: serviceType,
        status_column_title: firstColumn?.title || "Novo",
        sla_hours: slaHours,
        sla_breached: false,
        expected_resolution: expectedRes.toISOString(),
        total_normal_hours: 0,
        total_extra_hours: 0,
        notified: false,
        parent_ticket_id: ticket.id,
        parent_ticket_number: ticketNumber || ticket.ticket_number || null,
        parent_ticket_title: ticket.title,
      });

      // Copia dados de campos customizados vinculados ao ticket original
      const customData = await api.entities.TicketCustomData.filter({ ticket_id: ticket.id });
      if (customData.length > 0) {
        await api.entities.TicketCustomData.bulkCreate(
          customData.map(({ id, created_date, updated_date, created_by_id, created_by, is_sample, ...rest }) => ({
            ...rest,
            ticket_id: child.id,
          }))
        );
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR");
      const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const parentLabel = ticketNumber ? `#${String(ticketNumber).padStart(4, "0")}` : `#${ticket.id.slice(0, 8)}`;

      // Histórico no ticket filho
      await api.entities.TicketEvent.create({
        ticket_id: child.id,
        type: "creation",
        description: `Ticket criado através da replicação do Ticket ${parentLabel} - "${ticket.title}".`,
        user_email: user.email,
        user_name: user.full_name,
        visible_to_client: false,
        email_sent: false,
      });

      // Histórico no ticket pai
      await api.entities.TicketEvent.create({
        ticket_id: ticket.id,
        type: "creation",
        description: `Ticket Filho "${title}" criado por ${user.full_name} em ${dateStr} às ${timeStr}.`,
        user_email: user.email,
        user_name: user.full_name,
        visible_to_client: false,
        email_sent: false,
      });

      return child;
    },
    onSuccess: (child) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["allTickets"] });
      queryClient.invalidateQueries({ queryKey: ["childTickets", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["ticketEvents", ticket.id] });
      toast.success("Ticket Filho criado com sucesso");
      onOpenChange(false);
      navigate(`/ticket/${child.id}`);
    },
    onError: () => toast.error("Erro ao replicar o ticket"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg flex items-center gap-2">
            <Copy className="w-4 h-4 text-primary" />
            Replicar Ticket
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-xs text-muted-foreground">
            Um novo Ticket Filho será criado herdando os dados de{" "}
            <span className="text-foreground font-medium">"{ticket.title}"</span>, com novo status, SLA e histórico próprios.
          </p>

          <div>
            <Label className="text-muted-foreground text-xs">Título do novo ticket *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              placeholder="Título do Ticket Filho"
            />
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Serviço *</Label>
            <div className="mt-1">
              <SearchableSelect
                value={serviceType}
                onValueChange={setServiceType}
                options={serviceOptions}
                placeholder="Selecione o serviço"
                searchPlaceholder="Buscar serviço..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => replicateMutation.mutate()}
              disabled={!title.trim() || !serviceType || replicateMutation.isPending}
            >
              {replicateMutation.isPending ? "Criando..." : "Criar Ticket Filho"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}