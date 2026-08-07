import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Zap } from "lucide-react";

const triggerOptions = [
  { value: "ticket_created", label: "Ticket Criado" },
  { value: "status_changed", label: "Status Alterado" },
  { value: "sla_warning", label: "Alerta de SLA (80%)" },
  { value: "no_response_timeout", label: "Sem Resposta em X horas" },
  { value: "assignment_changed", label: "Atribuição Alterada" },
  { value: "urgency_changed", label: "Urgência Alterada" }
];

const actionOptions = [
  { value: "assign_to_user", label: "Atribuir para Usuário" },
  { value: "change_status", label: "Mudar Status" },
  { value: "send_email", label: "Enviar Email" },
  { value: "send_notification", label: "Enviar Notificação Interna" },
  { value: "change_urgency", label: "Alterar Urgência" },
  { value: "add_comment", label: "Adicionar Comentário" }
];

export default function AutomationRuleModal({ rule, onClose, userVertical }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: rule?.name || "",
    description: rule?.description || "",
    vertical: rule?.vertical || userVertical || "",
    active: rule?.active ?? true,
    trigger_type: rule?.trigger_type || "",
    trigger_conditions: rule?.trigger_conditions || {},
    actions: rule?.actions || []
  });

  // Fetch data
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.entities.User.list()
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.filter({ active: true })
  });

  const { data: kanbanConfigs = [] } = useQuery({
    queryKey: ["kanbanConfigs", formData.vertical],
    queryFn: () => formData.vertical
      ? api.entities.KanbanConfig.filter({ vertical: formData.vertical, active: true })
      : Promise.resolve([])
  });

  // Get ticket types from kanban configs
  const ticketTypes = [...new Set(kanbanConfigs.map(k => k.ticket_type))];

  // Get main types from kanban configs
  const mainTypes = [...new Set(kanbanConfigs.map(k => k.main_type))];

  // Get columns for selected vertical
  const allColumns = kanbanConfigs.flatMap(k => k.columns || []);
  const columnsWithIds = allColumns.map((col, idx) => ({
    ...col,
    id: `${idx}`
  }));

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (rule?.id) {
        return api.entities.AutomationRule.update(rule.id, data);
      }
      return api.entities.AutomationRule.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automationRules"] });
      onClose();
    }
  });

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { action_type: "", parameters: {} }]
    });
  };

  const removeAction = (index) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index)
    });
  };

  const updateAction = (index, field, value) => {
    const newActions = [...formData.actions];
    if (field === "action_type") {
      newActions[index] = { action_type: value, parameters: {} };
    } else {
      newActions[index].parameters = { ...newActions[index].parameters, [field]: value };
    }
    setFormData({ ...formData, actions: newActions });
  };

  const handleSave = () => {
    if (!formData.name || !formData.vertical || !formData.trigger_type || formData.actions.length === 0) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#161830] border-[rgba(139,92,246,0.15)] max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#8B5CF6]" />
            {rule ? "Editar Regra" : "Nova Regra de Automação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label>Nome da Regra *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Atribuir tickets críticos automaticamente"
                className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
              />
            </div>

            <div>
              <Label>Vertical *</Label>
              <Select value={formData.vertical} onValueChange={(v) => setFormData({ ...formData, vertical: v })}>
                <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                  <SelectValue placeholder="Selecione a vertical" />
                </SelectTrigger>
                <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                  {verticals.map(v => (
                    <SelectItem key={v.id} value={v.code} className="text-gray-200">{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o que esta regra faz"
                rows={2}
                className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
              />
            </div>
          </div>

          {/* Trigger */}
          <Card className="bg-[#0B0D15] border-[rgba(139,92,246,0.15)]">
            <CardHeader>
              <CardTitle className="text-sm text-[#8B5CF6]">Gatilho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Quando *</Label>
                <Select value={formData.trigger_type} onValueChange={(v) => setFormData({ ...formData, trigger_type: v })}>
                  <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                    <SelectValue placeholder="Selecione o gatilho" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                    {triggerOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-gray-200">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Main Type */}
              {formData.trigger_type && (
                <div>
                  <Label>Tipo Principal (Opcional)</Label>
                  <Select
                    value={formData.trigger_conditions.main_type || ""}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      trigger_conditions: { ...formData.trigger_conditions, main_type: v || null }
                    })}
                  >
                    <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                      <SelectItem value={null} className="text-gray-200">Todos</SelectItem>
                      <SelectItem value="chamado" className="text-gray-200">Implantação</SelectItem>
                      <SelectItem value="suporte" className="text-gray-200">Suporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Conditional fields based on trigger */}
              {formData.trigger_type === "status_changed" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>De Status (Opcional)</Label>
                    <Select
                      value={formData.trigger_conditions.from_status_id || ""}
                      onValueChange={(v) => {
                        const col = columnsWithIds.find(c => c.id === v);
                        setFormData({
                          ...formData,
                          trigger_conditions: {
                            ...formData.trigger_conditions,
                            from_status_id: v || null,
                            from_status: col?.title || null
                          }
                        });
                      }}
                    >
                      <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                        <SelectValue placeholder="Qualquer" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                        <SelectItem value={null} className="text-gray-200">Qualquer</SelectItem>
                        {columnsWithIds.map(col => (
                          <SelectItem key={col.id} value={col.id} className="text-gray-200">{col.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Para Status *</Label>
                    <Select
                      value={formData.trigger_conditions.to_status_id || ""}
                      onValueChange={(v) => {
                        const col = columnsWithIds.find(c => c.id === v);
                        setFormData({
                          ...formData,
                          trigger_conditions: {
                            ...formData.trigger_conditions,
                            to_status_id: v,
                            to_status: col?.title
                          }
                        });
                      }}
                    >
                      <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                        {columnsWithIds.map(col => (
                          <SelectItem key={col.id} value={col.id} className="text-gray-200">{col.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {formData.trigger_type === "no_response_timeout" && (
                <div>
                  <Label>Horas sem resposta *</Label>
                  <Input
                    type="number"
                    value={formData.trigger_conditions.hours_threshold || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      trigger_conditions: { ...formData.trigger_conditions, hours_threshold: parseInt(e.target.value) || 0 }
                    })}
                    placeholder="Ex: 4"
                    className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
                  />
                </div>
              )}

              {formData.trigger_type === "sla_warning" && (
                <div>
                  <Label>% do SLA atingido *</Label>
                  <Input
                    type="number"
                    value={formData.trigger_conditions.sla_percentage || 80}
                    onChange={(e) => setFormData({
                      ...formData,
                      trigger_conditions: { ...formData.trigger_conditions, sla_percentage: parseInt(e.target.value) || 80 }
                    })}
                    placeholder="80"
                    className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Ticket (Opcional)</Label>
                  <Select
                    value={formData.trigger_conditions.ticket_type || ""}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      trigger_conditions: { ...formData.trigger_conditions, ticket_type: v || null }
                    })}
                  >
                    <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                      <SelectItem value={null} className="text-gray-200">Todos</SelectItem>
                      {ticketTypes.map(tt => (
                        <SelectItem key={tt} value={tt} className="text-gray-200">{tt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Urgência (Opcional)</Label>
                  <Select
                    value={formData.trigger_conditions.urgency || ""}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      trigger_conditions: { ...formData.trigger_conditions, urgency: v || null }
                    })}
                  >
                    <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                      <SelectItem value={null} className="text-gray-200">Todas</SelectItem>
                      <SelectItem value="critica" className="text-gray-200">Crítica</SelectItem>
                      <SelectItem value="alta" className="text-gray-200">Alta</SelectItem>
                      <SelectItem value="media" className="text-gray-200">Média</SelectItem>
                      <SelectItem value="baixa" className="text-gray-200">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="bg-[#0B0D15] border-[rgba(139,92,246,0.15)]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-[#8B5CF6]">Ações *</CardTitle>
                <Button size="sm" onClick={addAction}>
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar Ação
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.actions.map((action, idx) => (
                <div key={idx} className="p-4 bg-[#161830] rounded-lg border border-[rgba(139,92,246,0.1)] space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label>Tipo de Ação</Label>
                      <Select
                        value={action.action_type}
                        onValueChange={(v) => updateAction(idx, "action_type", v)}
                      >
                        <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                          {actionOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-gray-200">{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAction(idx)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>

                  {/* Action-specific fields */}
                  {action.action_type === "assign_to_user" && (
                    <div>
                      <Label>Atribuir para</Label>
                      <Select
                        value={action.parameters.user_email || ""}
                        onValueChange={(v) => updateAction(idx, "user_email", v)}
                      >
                        <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                          <SelectValue placeholder="Selecione usuário" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                          {users.filter(u => u.tipo_perfil === "interno").map(u => (
                            <SelectItem key={u.email} value={u.email} className="text-gray-200">{u.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {action.action_type === "change_status" && (
                    <div>
                      <Label>Novo Status</Label>
                      <Select
                        value={action.parameters.status_column_id || ""}
                        onValueChange={(v) => {
                          const col = columnsWithIds.find(c => c.id === v);
                          updateAction(idx, "status_column_id", v);
                          updateAction(idx, "status_column_title", col?.title);
                        }}
                      >
                        <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                          <SelectValue placeholder="Selecione status" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                          {columnsWithIds.map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-gray-200">{c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {action.action_type === "send_email" && (
                    <div className="space-y-3">
                      <div>
                        <Label>Para (emails separados por vírgula)</Label>
                        <Input
                          value={action.parameters.to_emails || ""}
                          onChange={(e) => updateAction(idx, "to_emails", e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
                        />
                      </div>
                      <div>
                        <Label>Assunto</Label>
                        <Input
                          value={action.parameters.subject || ""}
                          onChange={(e) => updateAction(idx, "subject", e.target.value)}
                          placeholder="Ex: Novo ticket crítico"
                          className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
                        />
                      </div>
                      <div>
                        <Label>Mensagem</Label>
                        <Textarea
                          value={action.parameters.message || ""}
                          onChange={(e) => updateAction(idx, "message", e.target.value)}
                          placeholder="Use {ticket_title}, {client_name}, {urgency}, {status}, {assigned_to}"
                          rows={3}
                          className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
                        />
                      </div>
                    </div>
                  )}

                  {action.action_type === "send_notification" && (
                    <div className="space-y-3">
                      <div>
                        <Label>Para (emails separados por vírgula)</Label>
                        <Input
                          value={action.parameters.to_emails || ""}
                          onChange={(e) => updateAction(idx, "to_emails", e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
                        />
                      </div>
                      <div>
                        <Label>Mensagem</Label>
                        <Textarea
                          value={action.parameters.message || ""}
                          onChange={(e) => updateAction(idx, "message", e.target.value)}
                          placeholder="Use {ticket_title}, {client_name}, {urgency}, {status}, {assigned_to}"
                          rows={2}
                          className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
                        />
                      </div>
                    </div>
                  )}

                  {action.action_type === "change_urgency" && (
                    <div>
                      <Label>Nova Urgência</Label>
                      <Select
                        value={action.parameters.urgency || ""}
                        onValueChange={(v) => updateAction(idx, "urgency", v)}
                      >
                        <SelectTrigger className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                          <SelectItem value="critica" className="text-gray-200">Crítica</SelectItem>
                          <SelectItem value="alta" className="text-gray-200">Alta</SelectItem>
                          <SelectItem value="media" className="text-gray-200">Média</SelectItem>
                          <SelectItem value="baixa" className="text-gray-200">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {action.action_type === "add_comment" && (
                    <div>
                      <Label>Comentário</Label>
                      <Textarea
                        value={action.parameters.comment || ""}
                        onChange={(e) => updateAction(idx, "comment", e.target.value)}
                        placeholder="Use {ticket_title}, {client_name}, {urgency}, {status}, {assigned_to}"
                        rows={2}
                        className="bg-[#0D0A1E] border-[rgba(139,92,246,0.25)] text-white"
                      />
                    </div>
                  )}
                </div>
              ))}

              {formData.actions.length === 0 && (
                <p className="text-sm text-gray-600 text-center py-6">
                  Nenhuma ação adicionada. Clique em "Adicionar Ação" acima.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar Regra"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}