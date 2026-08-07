import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Timer, Save, Check } from "lucide-react";

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: configs = [] } = useQuery({
    queryKey: ["systemConfigs"],
    queryFn: () => api.entities.SystemConfig.list(),
  });

  const [values, setValues] = useState({});

  useEffect(() => {
    const v = {};
    configs.forEach(c => { v[c.key] = c.value; });
    setValues(v);
  }, [configs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const config of configs) {
        if (values[config.key] !== config.value) {
          await api.entities.SystemConfig.update(config.id, { value: values[config.key] });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemConfigs"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const set = (key, value) => setValues(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Configurações" subtitle="Ajuste os parâmetros do sistema" />

      {/* Work hours */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Horário de Expediente</h3>
        </div>
        <p className="text-xs text-muted-foreground">Define o período de horas normais. Fora desse intervalo é hora extra.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground text-xs">Início</Label>
            <Input type="time" value={values.work_start || "08:00"} onChange={(e) => set("work_start", e.target.value)}
              className="mt-1" />
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Fim</Label>
            <Input type="time" value={values.work_end || "18:00"} onChange={(e) => set("work_end", e.target.value)}
              className="mt-1" />
          </div>
        </div>
      </div>

      {/* SLA */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Timer className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">SLA por Urgência (horas)</h3>
        </div>
        <p className="text-xs text-muted-foreground">Tempo máximo para resolução com base na urgência do ticket.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: "sla_baixa", label: "Baixa" },
            { key: "sla_media", label: "Média" },
            { key: "sla_alta", label: "Alta" },
            { key: "sla_critica", label: "Crítica" },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label className="text-muted-foreground text-xs">{label}</Label>
              <Input type="number" value={values[key] || ""} onChange={(e) => set(key, e.target.value)}
                className="mt-1" />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-2">
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? "Salvo!" : saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}