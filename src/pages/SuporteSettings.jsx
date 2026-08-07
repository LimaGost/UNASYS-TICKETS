import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ticket, Save, Clock, Users, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

export default function SuporteSettings() {
  const [selectedVertical, setSelectedVertical] = useState("");
  const [editForm, setEditForm] = useState({});
  const queryClient = useQueryClient();

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["suporteConfigs"],
    queryFn: () => api.entities.SuporteConfig.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.entities.User.list(),
  });

  const currentConfig = configs.find((c) => c.vertical === selectedVertical);

  useEffect(() => {
    if (!selectedVertical && verticals.length > 0) {
      setSelectedVertical(verticals.find(v => v.active)?.code || verticals[0]?.code);
    }
  }, [verticals, selectedVertical]);

  useEffect(() => {
    if (currentConfig) {
      setEditForm(currentConfig);
    } else {
      setEditForm({
        vertical: selectedVertical,
        default_sla_hours: 24,
        urgent_sla_hours: 4,
        critical_sla_hours: 2,
        auto_assign_enabled: false,
        auto_assign_strategy: "round_robin",
        allowed_agents: [],
        require_client_approval: false,
        enable_chat: false,
        enable_phone_support: true,
        business_hours_start: "08:00",
        business_hours_end: "18:00",
        work_days: [1, 2, 3, 4, 5],
        active: true,
      });
    }
  }, [currentConfig, selectedVertical]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (currentConfig) {
        return api.entities.SuporteConfig.update(currentConfig.id, data);
      } else {
        return api.entities.SuporteConfig.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suporteConfigs"] });
      toast.success("Configurações salvas!");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(editForm);
  };

  const toggleWorkDay = (day) => {
    const days = editForm.work_days || [];
    if (days.includes(day)) {
      setEditForm({ ...editForm, work_days: days.filter((d) => d !== day) });
    } else {
      setEditForm({ ...editForm, work_days: [...days, day].sort() });
    }
  };

  const weekDays = [
    { value: 0, label: "Dom" },
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
    { value: 6, label: "Sáb" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de Suporte"
        subtitle="Configure SLA, atribuição automática e horários de atendimento"
      />

      <Tabs value={selectedVertical} onValueChange={setSelectedVertical}>
        <TabsList>
          {verticals.filter(v => v.active).map(v => (
            <TabsTrigger key={v.id} value={v.code}>{v.name}</TabsTrigger>
          ))}
        </TabsList>

        {selectedVertical && (
          <TabsContent value={selectedVertical} className="space-y-6 mt-6">
          {/* SLA Configuration */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Configuração de SLA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">SLA Padrão (horas)</Label>
                  <Input type="number" value={editForm.default_sla_hours || ""}
                    onChange={(e) => setEditForm({ ...editForm, default_sla_hours: Number(e.target.value) })}
                    className="mt-1" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">SLA Urgente (horas)</Label>
                  <Input type="number" value={editForm.urgent_sla_hours || ""}
                    onChange={(e) => setEditForm({ ...editForm, urgent_sla_hours: Number(e.target.value) })}
                    className="mt-1" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">SLA Crítico (horas)</Label>
                  <Input type="number" value={editForm.critical_sla_hours || ""}
                    onChange={(e) => setEditForm({ ...editForm, critical_sla_hours: Number(e.target.value) })}
                    className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Assignment */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Atribuição Automática
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-foreground text-sm">Ativar Atribuição Automática</Label>
                  <p className="text-xs text-muted-foreground">
                    Distribuir tickets automaticamente entre agentes
                  </p>
                </div>
                <Switch
                  checked={editForm.auto_assign_enabled}
                  onCheckedChange={(v) => setEditForm({ ...editForm, auto_assign_enabled: v })}
                />
              </div>

              {editForm.auto_assign_enabled && (
                <>
                  <div>
                    <Label className="text-muted-foreground text-xs">Estratégia de Distribuição</Label>
                    <Select
                      value={editForm.auto_assign_strategy}
                      onValueChange={(v) => setEditForm({ ...editForm, auto_assign_strategy: v })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round_robin">Round Robin (Rodízio)</SelectItem>
                        <SelectItem value="least_busy">Menos Ocupado</SelectItem>
                        <SelectItem value="random">Aleatório</SelectItem>
                        <SelectItem value="by_skill">Por Habilidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs">Agentes Permitidos</Label>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <input
                            type="checkbox"
                            checked={(editForm.allowed_agents || []).includes(user.email)}
                            onChange={(e) => {
                              const agents = editForm.allowed_agents || [];
                              if (e.target.checked) {
                                setEditForm({ ...editForm, allowed_agents: [...agents, user.email] });
                              } else {
                                setEditForm({ ...editForm, allowed_agents: agents.filter((a) => a !== user.email) });
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-foreground">{user.full_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Business Hours */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-amber-500" />
                Horário de Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Início do Expediente</Label>
                  <Input type="time" value={editForm.business_hours_start || ""}
                    onChange={(e) => setEditForm({ ...editForm, business_hours_start: e.target.value })}
                    className="mt-1" />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Fim do Expediente</Label>
                  <Input type="time" value={editForm.business_hours_end || ""}
                    onChange={(e) => setEditForm({ ...editForm, business_hours_end: e.target.value })}
                    className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">Dias Úteis</Label>
                <div className="flex gap-2">
                  {weekDays.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => toggleWorkDay(day.value)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        (editForm.work_days || []).includes(day.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Options */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                Opções Adicionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-foreground text-sm">Exigir Aprovação do Cliente</Label>
                  <p className="text-xs text-muted-foreground">Cliente deve confirmar ao fechar ticket</p>
                </div>
                <Switch
                  checked={editForm.require_client_approval}
                  onCheckedChange={(v) => setEditForm({ ...editForm, require_client_approval: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-foreground text-sm">Habilitar Chat em Tempo Real</Label>
                  <p className="text-xs text-muted-foreground">Permitir conversas instantâneas</p>
                </div>
                <Switch
                  checked={editForm.enable_chat}
                  onCheckedChange={(v) => setEditForm({ ...editForm, enable_chat: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-foreground text-sm">Suporte Telefônico</Label>
                  <p className="text-xs text-muted-foreground">Ativar registro de ligações</p>
                </div>
                <Switch
                  checked={editForm.enable_phone_support}
                  onCheckedChange={(v) => setEditForm({ ...editForm, enable_phone_support: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-foreground text-sm">Configuração Ativa</Label>
                </div>
                <Switch
                  checked={editForm.active}
                  onCheckedChange={(v) => setEditForm({ ...editForm, active: v })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}