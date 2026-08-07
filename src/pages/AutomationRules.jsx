import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import AutomationRuleModal from "../components/automation/AutomationRuleModal";
import { Plus, Zap, Edit, Trash2, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const triggerLabels = {
  ticket_created: "Ticket Criado",
  status_changed: "Status Alterado",
  sla_warning: "Alerta de SLA",
  no_response_timeout: "Sem Resposta",
  assignment_changed: "Atribuição Alterada",
  urgency_changed: "Urgência Alterada"
};

const actionLabels = {
  assign_to_user: "Atribuir para Usuário",
  change_status: "Mudar Status",
  send_email: "Enviar Email",
  send_notification: "Enviar Notificação",
  change_urgency: "Alterar Urgência",
  add_comment: "Adicionar Comentário"
};

export default function AutomationRules() {
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me()
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["automationRules", currentUser?.vertical],
    queryFn: async () => {
      if (currentUser?.role === "admin") {
        return api.entities.AutomationRule.list("-created_date");
      }
      return api.entities.AutomationRule.filter({ vertical: currentUser?.vertical }, "-created_date");
    },
    enabled: !!currentUser
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => api.entities.AutomationRule.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automationRules"] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.AutomationRule.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automationRules"] })
  });

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja excluir esta regra?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regras de Automação"
        subtitle="Configure regras para automatizar seu fluxo de trabalho"
        action={
          <Button onClick={() => { setEditingRule(null); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Regra
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{rules.length}</p>
                <p className="text-xs text-muted-foreground">Total de Regras</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{rules.filter(r => r.active).length}</p>
                <p className="text-xs text-muted-foreground">Regras Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {rules.reduce((acc, r) => acc + (r.execution_count || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">Execuções</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <div className="grid gap-4">
        {rules.map((rule) => (
          <Card key={rule.id} className="bg-card border-border">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-foreground">{rule.name}</CardTitle>
                    {rule.active ? (
                      <Badge className="bg-green-500/20 text-green-400">Ativa</Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">Inativa</Badge>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-sm text-muted-foreground mb-3">{rule.description}</p>
                  )}
                  
                  {/* Trigger */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-primary border-primary/30">
                      <Zap className="w-3 h-3 mr-1" />
                      {triggerLabels[rule.trigger_type]}
                    </Badge>
                    {rule.trigger_conditions && Object.keys(rule.trigger_conditions).length > 0 && (
                      <span className="text-xs text-gray-600">
                        {Object.entries(rule.trigger_conditions)
                          .filter(([_, v]) => v)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {rule.actions?.map((action, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {actionLabels[action.action_type]}
                      </Badge>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span>Executada {rule.execution_count || 0}x</span>
                    {rule.last_executed_at && (
                      <span>Última: {format(new Date(rule.last_executed_at), "dd/MM/yyyy HH:mm")}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, active: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(rule)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {rules.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">Nenhuma regra de automação configurada</p>
              <Button onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Regra
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {showModal && (
        <AutomationRuleModal
          rule={editingRule}
          onClose={() => { setShowModal(false); setEditingRule(null); }}
          userVertical={currentUser?.vertical}
        />
      )}
    </div>
  );
}