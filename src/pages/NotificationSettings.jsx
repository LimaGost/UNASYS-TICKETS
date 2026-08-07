import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bell, Mail, Volume2, Clock } from "lucide-react";

export default function NotificationSettings() {
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ["notificationConfig", currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return null;
      const configs = await api.entities.NotificationConfig.filter({ user_email: currentUser.email });
      return configs[0] || {
        user_email: currentUser.email,
        enable_browser_notifications: true,
        enable_toast_notifications: true,
        enable_email_notifications: false,
        notify_on_assignment: true,
        notify_on_status_change: true,
        notify_on_comments: true,
        notify_on_mention: true,
        notify_on_sla_warning: true,
        quiet_hours_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      };
    },
    enabled: !!currentUser,
  });

  const [formData, setFormData] = useState(config || {});

  React.useEffect(() => {
    if (config) setFormData(config);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (config?.id) {
        await api.entities.NotificationConfig.update(config.id, data);
      } else {
        await api.entities.NotificationConfig.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationConfig"] });
      toast.success("Configurações salvas com sucesso!");
    },
  });

  const requestBrowserPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Permissão para notificações concedida!");
      } else {
        toast.error("Permissão negada. Habilite nas configurações do navegador.");
      }
    }
  };

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de Notificações"
        subtitle="Personalize como e quando você deseja ser notificado"
      />

      {/* Canais de Notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Canais de Notificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex-1">
              <Label className="text-sm font-medium">Notificações do Navegador</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Receba alertas mesmo quando a aba estiver em segundo plano
              </p>
              {Notification?.permission === "default" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={requestBrowserPermission}
                  className="mt-2 text-xs"
                >
                  Permitir notificações
                </Button>
              )}
              {Notification?.permission === "denied" && (
                <p className="text-xs text-destructive mt-2">
                  Permissão negada. Habilite nas configurações do navegador.
                </p>
              )}
            </div>
            <Switch
              checked={formData.enable_browser_notifications}
              onCheckedChange={(v) => setFormData({ ...formData, enable_browser_notifications: v })}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex-1">
              <Label className="text-sm font-medium">Toast (Pop-up na Aplicação)</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Exibir notificações no canto da tela enquanto usa o sistema
              </p>
            </div>
            <Switch
              checked={formData.enable_toast_notifications}
              onCheckedChange={(v) => setFormData({ ...formData, enable_toast_notifications: v })}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Notificações por Email
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Enviar resumo diário de notificações por email
              </p>
            </div>
            <Switch
              checked={formData.enable_email_notifications}
              onCheckedChange={(v) => setFormData({ ...formData, enable_email_notifications: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tipos de Eventos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-primary" />
            Tipos de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { label: "Quando atribuído a um ticket", key: "notify_on_assignment" },
            { label: "Mudanças de status", key: "notify_on_status_change" },
            { label: "Novos comentários e apontamentos", key: "notify_on_comments" },
            { label: "Quando mencionado (@você)", key: "notify_on_mention" },
            { label: "Alertas de SLA", key: "notify_on_sla_warning" },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
              <Label className="text-sm text-foreground cursor-pointer">{label}</Label>
              <Switch
                checked={formData[key]}
                onCheckedChange={(v) => setFormData({ ...formData, [key]: v })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Horário Silencioso */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Horário Silencioso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex-1">
              <Label className="text-sm font-medium">Ativar Modo Silencioso</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Pausar notificações durante horários específicos
              </p>
            </div>
            <Switch
              checked={formData.quiet_hours_enabled}
              onCheckedChange={(v) => setFormData({ ...formData, quiet_hours_enabled: v })}
            />
          </div>

          {formData.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border border-border">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Início</Label>
                <Input
                  type="time"
                  value={formData.quiet_hours_start || "22:00"}
                  onChange={(e) => setFormData({ ...formData, quiet_hours_start: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Fim</Label>
                <Input
                  type="time"
                  value={formData.quiet_hours_end || "08:00"}
                  onChange={(e) => setFormData({ ...formData, quiet_hours_end: e.target.value })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(formData)}
          className="px-8"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}