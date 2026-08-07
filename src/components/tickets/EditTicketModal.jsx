import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditTicketModal({ ticket, open, onClose }) {
  const queryClient = useQueryClient();
  const [op, setOp] = useState("");
  const [cliente, setCliente] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setOp(ticket.external_order_number || "");
    setCliente(ticket.client_name || "");
    setCnpj(ticket.external_customer_code || "");
    setCustomTitle(ticket.title || "");
  }, [ticket]);

  const formattedTitle = `OP:"${op}" CLIENTE:"${cliente}" CNPJ:"${cnpj}"`;

  const mutation = useMutation({
    mutationFn: async () => {
      const title = useCustom ? customTitle : formattedTitle;
      await api.entities.Ticket.update(ticket.id, { title });
      const user = await api.auth.me();
      await api.entities.TicketEvent.create({
        ticket_id: ticket.id, type: "edit",
        description: `Título alterado para: "${title}"`,
        user_email: user.email, user_name: user.full_name, visible_to_client: false,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] }); onClose(); },
  });

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Toggle modo */}
          <div className="flex gap-2">
            <button onClick={() => setUseCustom(false)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-all ${!useCustom ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
              Formato padrão
            </button>
            <button onClick={() => setUseCustom(true)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-all ${useCustom ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
              Título livre
            </button>
          </div>

          {!useCustom ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Número da OP</Label>
                <Input value={op} onChange={e => setOp(e.target.value)} placeholder="Ex: 12345" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Nome do Cliente</Label>
                <Input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Ex: Empresa Ltda" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">CNPJ</Label>
                <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="Ex: 00.000.000/0001-00" />
              </div>
              <div className="bg-muted border border-border rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Pré-visualização do título:</p>
                <p className="text-xs text-primary font-mono break-all">{formattedTitle}</p>
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Título personalizado</Label>
              <Input value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}