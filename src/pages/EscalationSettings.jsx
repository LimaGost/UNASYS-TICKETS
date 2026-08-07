import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUpCircle, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export default function EscalationSettings() {
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [editForm, setEditForm] = useState({});
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ["escalationConfigs"],
    queryFn: () => api.entities.EscalationConfig.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.entities.User.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.EscalationConfig.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalationConfigs"] });
      toast.success("Configuração criada!");
      setSelectedConfig(null);
      setEditForm({});
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.EscalationConfig.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalationConfigs"] });
      toast.success("Configuração atualizada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.EscalationConfig.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalationConfigs"] });
      toast.success("Configuração removida!");
    },
  });

  const handleSave = () => {
    if (selectedConfig) {
      updateMutation.mutate({ id: selectedConfig.id, data: editForm });
    } else {
      createMutation.mutate(editForm);
    }
  };

  const handleEdit = (config) => {
    setSelectedConfig(config);
    setEditForm(config);
  };

  const handleNew = () => {
    setSelectedConfig(null);
    const firstVertical = verticals.find(v => v.active)?.code || "";
    setEditForm({
      vertical: firstVertical,
      auto_escalate_after_hours: 24,
      escalate_to_role: "admin",
      increase_urgency: true,
      new_urgency_level: "alta",
      send_notification: true,
      active: true,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de Escalonamento"
        subtitle="Defina regras automáticas e manuais para escalar tickets"
        action={
          <Button onClick={handleNew} className="gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED]">
            <Plus className="w-4 h-4" /> Nova Configuração
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Configurações */}
        <Card className="lg:col-span-1 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-sm">Configurações Existentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {configs.map((config) => (
              <div
                key={config.id}
                onClick={() => handleEdit(config)}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  selectedConfig?.id === config.id
                    ? "bg-primary/10 border-primary"
                    : "bg-muted/30 hover:bg-muted border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {verticals.find(v => v.code === config.vertical)?.name || config.vertical}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {config.ticket_type || "Todos os tipos"}
                    </p>
                  </div>
                  {!config.active && (
                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">Inativo</span>
                  )}
                </div>
              </div>
            ))}
            {configs.length === 0 && (
              <div className="text-center py-6 px-2">
                <ArrowUpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">Nenhuma regra de escalonamento</p>
                <p className="text-xs text-muted-foreground/70 mb-3">
                  Configure quando e para quem tickets devem ser escalados automaticamente.
                </p>
                <Button
                  onClick={handleNew}
                  size="sm"
                  className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-1.5 text-xs h-7"
                >
                  <Plus className="w-3.5 h-3.5" /> Criar primeira regra
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formulário de Edição */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-primary" />
              {selectedConfig ? "Editar Configuração" : "Nova Configuração"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(editForm).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ArrowUpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Selecione uma configuração ou crie uma nova</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Vertical *</Label>
                    <Select
                      value={editForm.vertical}
                      onValueChange={(v) => setEditForm({ ...editForm, vertical: v })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {verticals.filter(v => v.active).map(v => (
                          <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs">Tipo de Ticket (Opcional)</Label>
                    <Input
                      value={editForm.ticket_type || ""}
                      onChange={(e) => setEditForm({ ...editForm, ticket_type: e.target.value })}
                      className="mt-1"
                      placeholder="Ex: Implantação"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">Auto-escalar após (horas)</Label>
                  <Input
                    type="number"
                    value={editForm.auto_escalate_after_hours || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, auto_escalate_after_hours: Number(e.target.value) })
                    }
                    className="mt-1"
                    placeholder="24"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Escalar automaticamente se não houver resposta neste período
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Escalar para Cargo</Label>
                    <Select
                      value={editForm.escalate_to_role}
                      onValueChange={(v) => setEditForm({ ...editForm, escalate_to_role: v })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs">Usuário Específico (Opcional)</Label>
                    <Select
                      value={editForm.escalate_to_specific_user || ""}
                      onValueChange={(v) =>
                        setEditForm({ ...editForm, escalate_to_specific_user: v })
                      }
                    >
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Nenhum</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.email}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-foreground text-sm">Aumentar Urgência ao Escalar</Label>
                    <p className="text-xs text-muted-foreground">
                      Eleva a urgência automaticamente quando escalar
                    </p>
                  </div>
                  <Switch
                    checked={editForm.increase_urgency}
                    onCheckedChange={(v) => setEditForm({ ...editForm, increase_urgency: v })}
                  />
                </div>

                {editForm.increase_urgency && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Novo Nível de Urgência</Label>
                    <Select
                      value={editForm.new_urgency_level}
                      onValueChange={(v) => setEditForm({ ...editForm, new_urgency_level: v })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-foreground text-sm">Enviar Notificação</Label>
                    <p className="text-xs text-muted-foreground">Notificar o novo responsável</p>
                  </div>
                  <Switch
                    checked={editForm.send_notification}
                    onCheckedChange={(v) => setEditForm({ ...editForm, send_notification: v })}
                  />
                </div>

                {editForm.send_notification && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Template de Notificação (Opcional)</Label>
                    <Textarea
                      value={editForm.notification_template || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, notification_template: e.target.value })
                      }
                      className="mt-1"
                      placeholder="Ticket #{ticket_id} foi escalado para você..."
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-foreground text-sm">Configuração Ativa</Label>
                  </div>
                  <Switch
                    checked={editForm.active}
                    onCheckedChange={(v) => setEditForm({ ...editForm, active: v })}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  {selectedConfig && (
                    <Button
                      variant="outline"
                      onClick={() => deleteMutation.mutate(selectedConfig.id)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </Button>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={!editForm.vertical}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Salvar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}