import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowUpCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function EscalateButton({ ticket }) {
  const [open, setOpen] = useState(false);
  const [escalateTo, setEscalateTo] = useState("");
  const [reason, setReason] = useState("");
  const [nivel, setNivel] = useState("1");
  const [categoria, setCategoria] = useState("outro");
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["internalUsers"],
    queryFn: async () => {
      const res = await api.functions.invoke("listInternalUsers", {});
      return res?.data?.users || res?.users || [];
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  // Filter users - show only Diretores
  const escalationUsers = users.filter(u =>
    u.cargo?.toLowerCase() === "diretor"
  );

  const escalateMutation = useMutation({
    mutationFn: async () => {
      const targetUser = users.find(u => u.email === escalateTo);
      
      // Update ticket urgency and assignment
      await api.entities.Ticket.update(ticket.id, {
        assigned_to: escalateTo,
        assigned_to_name: targetUser?.full_name || "",
        urgency: ticket.urgency === "critica" ? "critica" : "alta"
      });

      // Create escalation event
      await api.entities.TicketEvent.create({
        ticket_id: ticket.id,
        type: "escalation",
        description: `Ticket escalado de ${currentUser?.full_name} para ${targetUser?.full_name}. Motivo: ${reason}`,
        old_value: ticket.assigned_to,
        new_value: escalateTo,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        visible_to_client: false,
        email_sent: false
      });

      // Registra o escalonamento no módulo de gestão do Diretor
      const esc = await api.entities.Escalation.create({
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        ticket_title: ticket.title,
        client_name: ticket.client_name || "",
        vertical: ticket.vertical || "",
        colaborador_email: ticket.assigned_to || "",
        colaborador_nome: ticket.assigned_to_name || "",
        escalated_by_email: currentUser?.email,
        escalated_by_nome: currentUser?.full_name,
        escalated_to_email: escalateTo,
        escalated_to_nome: targetUser?.full_name || "",
        nivel: parseInt(nivel),
        motivo_categoria: categoria,
        motivo: reason,
        status: "aberto",
        responsavel_tratativa_email: escalateTo,
        responsavel_tratativa_nome: targetUser?.full_name || "",
        ticket_created_date: ticket.created_date,
      });
      await api.entities.EscalationEvent.create({
        escalation_id: esc.id,
        tipo: "criacao",
        descricao: `Escalonamento nível ${nivel} criado. Motivo: ${reason}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
      });

      // Send notification to new assignee
      await api.functions.invoke('createNotification', {
        user_email: escalateTo,
        type: 'ticket_assigned',
        title: `⚠️ Ticket Escalado: ${ticket.title}`,
        message: `Ticket #${ticket.id.slice(0, 8)} foi escalado para você. Motivo: ${reason}`,
        ticket_id: ticket.id,
        ticket_title: ticket.title,
        actor_name: currentUser?.full_name,
        actor_email: currentUser?.email,
        priority: 'high'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticketEvents"] });
      queryClient.invalidateQueries({ queryKey: ["dir-escalations"] });
      toast.success("Ticket escalado com sucesso!");
      setOpen(false);
      setEscalateTo("");
      setReason("");
      setNivel("1");
      setCategoria("outro");
    },
    onError: (error) => {
      toast.error("Erro ao escalar ticket: " + error.message);
    }
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-500/50 gap-2"
      >
        <ArrowUpCircle className="w-4 h-4" />
        Escalar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Escalar Ticket
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-muted-foreground text-xs">Escalar para *</Label>
              <Select value={escalateTo} onValueChange={setEscalateTo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {escalationUsers.map(u => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">Nível</Label>
                <Select value={nivel} onValueChange={setNivel}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Nível 1</SelectItem>
                    <SelectItem value="2">Nível 2</SelectItem>
                    <SelectItem value="3">Nível 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Categoria do Motivo</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="falha_processo">Falha de Processo</SelectItem>
                    <SelectItem value="falha_tecnica">Falha Técnica</SelectItem>
                    <SelectItem value="falha_operacional">Falha Operacional</SelectItem>
                    <SelectItem value="complexidade">Complexidade</SelectItem>
                    <SelectItem value="prazo">Prazo</SelectItem>
                    <SelectItem value="cliente_insatisfeito">Cliente Insatisfeito</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Motivo da Escalação *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo da escalação..."
                className="mt-1 min-h-[100px]"
              />
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <p className="text-xs text-orange-600 dark:text-orange-400">
                <strong>Atenção:</strong> Ao escalar este ticket, a urgência será automaticamente aumentada para "Alta" (se não for crítica) e o responsável anterior será notificado.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => escalateMutation.mutate()}
                disabled={!escalateTo || !reason.trim() || escalateMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {escalateMutation.isPending ? "Escalando..." : "Escalar Ticket"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}