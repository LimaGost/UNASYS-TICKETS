import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";

function SubStatusInput({ onAdd }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(val); setVal(""); } }}
        placeholder="Adicionar sub-status e pressionar Enter"
        className="flex-1 h-8 text-xs px-3 rounded-md bg-muted border border-border text-foreground placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={() => { onAdd(val); setVal(""); }}
        className="px-3 h-8 text-xs rounded-md font-medium"
        style={{ background: 'rgba(139,92,246,0.2)', color: '#A78BFA' }}
      >
        +
      </button>
    </div>
  );
}

export default function KanbanConfig() {
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState(null);
  const [columns, setColumns] = useState([]);

  const { data: configs = [] } = useQuery({
    queryKey: ["kanbanConfigs"],
    queryFn: () => api.entities.KanbanConfig.list(),
  });

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ["ticketTypes"],
    queryFn: () => api.entities.TicketType.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingConfig?.id) {
        return api.entities.KanbanConfig.update(editingConfig.id, data);
      }
      return api.entities.KanbanConfig.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanbanConfigs"] });
      setEditingConfig(null);
      setColumns([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.KanbanConfig.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kanbanConfigs"] }),
  });

  const addColumn = () => {
    setColumns([...columns, {
      title: "",
      color: "#8B5CF6",
      order: columns.length,
      is_final: false,
      pauses_sla: false,
      sla_hours: 24,
      required_fields: [],
      sub_statuses: [],
    }]);
  };

  const updateColumn = (idx, key, value) => {
    const updated = [...columns];
    updated[idx][key] = value;
    setColumns(updated);
  };

  const removeColumn = (idx) => {
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const addSubStatus = (colIdx, value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const updated = [...columns];
    if (!updated[colIdx].sub_statuses) updated[colIdx].sub_statuses = [];
    if (!updated[colIdx].sub_statuses.includes(trimmed)) {
      updated[colIdx].sub_statuses = [...updated[colIdx].sub_statuses, trimmed];
      setColumns(updated);
    }
  };

  const removeSubStatus = (colIdx, ssIdx) => {
    const updated = [...columns];
    updated[colIdx].sub_statuses = updated[colIdx].sub_statuses.filter((_, i) => i !== ssIdx);
    setColumns(updated);
  };

  const handleSave = () => {
    if (!editingConfig?.vertical || !editingConfig?.ticket_type || !editingConfig?.main_type) return;
    saveMutation.mutate({
      main_type: editingConfig.main_type,
      vertical: editingConfig.vertical,
      ticket_type: editingConfig.ticket_type,
      columns: columns,
      active: true,
    });
  };

  const startEdit = (config) => {
    setEditingConfig(config);
    setColumns(config.columns || []);
  };

  const startNew = () => {
    setEditingConfig({ main_type: "implantacao", vertical: "", ticket_type: "" });
    setColumns([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuração de Kanban"
        subtitle="Configure colunas por vertical e tipo de ticket"
        action={
          <Button onClick={startNew} className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-2">
            <Plus className="w-4 h-4" />
            Nova Configuração
          </Button>
        }
      />

      {editingConfig ? (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-lg">
                {editingConfig.id ? "Editar Kanban" : "Novo Kanban"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingConfig(null); setColumns([]); }}
                className="text-muted-foreground hover:text-foreground gap-1.5 h-8"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar para lista
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">Tipo Principal</Label>
                <Select value={editingConfig.main_type} onValueChange={(v) => setEditingConfig({...editingConfig, main_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="implantacao">Implantação</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">Vertical</Label>
                <Select value={editingConfig.vertical} onValueChange={(v) => setEditingConfig({...editingConfig, vertical: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione a vertical" /></SelectTrigger>
                  <SelectContent>
                    {verticals.filter(v => v.active).map(v => (
                      <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">Tipo de Ticket</Label>
                <Select value={editingConfig.ticket_type} onValueChange={(v) => setEditingConfig({...editingConfig, ticket_type: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    {ticketTypes.map(tt => (
                      <SelectItem key={tt.id} value={tt.name}>{tt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-muted-foreground text-sm">Colunas do Kanban</Label>
                <Button onClick={addColumn} size="sm" variant="outline" className="h-8 gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Coluna
                </Button>
              </div>

              <div className="space-y-3">
                {columns.map((col, idx) => (
                  <div key={idx} className="p-4 bg-muted/40 border border-border rounded-lg space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-muted-foreground text-xs mb-1.5 block">Título da Coluna</Label>
                         <Input value={col.title} onChange={(e) => updateColumn(idx, "title", e.target.value)}
                          placeholder="Em Atendimento" className="h-9 text-sm" />
                        </div>
                        <div>
                        <Label className="text-muted-foreground text-xs mb-1.5 block">Cor</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={col.color || "#8B5CF6"}
                            onChange={(e) => updateColumn(idx, "color", e.target.value)}
                            className="w-9 h-9 rounded border border-border cursor-pointer flex-shrink-0"
                          />
                          <Input
                            value={col.color || ""}
                            onChange={(e) => updateColumn(idx, "color", e.target.value)}
                            placeholder="#8B5CF6"
                            className="h-9 text-sm flex-1 font-mono"
                          />
                        </div>
                        </div>
                        <div>
                        <Label className="text-muted-foreground text-xs mb-1.5 block">SLA (horas)</Label>
                        <Input type="number" value={col.sla_hours} onChange={(e) => updateColumn(idx, "sla_hours", parseFloat(e.target.value))}
                          placeholder="24" className="h-9 text-sm" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-muted-foreground text-xs mb-1.5 block">Sub-status (opcional)</Label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(col.sub_statuses || []).map((ss, ssIdx) => (
                          <span key={ssIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs"
                            style={{ background: `${col.color || '#8B5CF6'}20`, color: col.color || '#A78BFA', border: `1px solid ${col.color || '#8B5CF6'}30` }}>
                            {ss}
                            <button type="button" onClick={() => removeSubStatus(idx, ssIdx)} className="text-gray-500 hover:text-red-400 ml-0.5">&times;</button>
                          </span>
                        ))}
                      </div>
                      <SubStatusInput onAdd={(v) => addSubStatus(idx, v)} />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={col.is_final} onChange={(e) => updateColumn(idx, "is_final", e.target.checked)}
                          className="w-4 h-4 rounded border-border" />
                        Coluna final (encerra ticket)
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={col.pauses_sla} onChange={(e) => updateColumn(idx, "pauses_sla", e.target.checked)}
                          className="w-4 h-4 rounded border-border" />
                        Pausa o SLA
                      </label>
                      <Button onClick={() => removeColumn(idx)} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7 ml-auto">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => { setEditingConfig(null); setColumns([]); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Salvar Configuração
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {configs.map(config => (
            <Card key={config.id} className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => startEdit(config)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground text-base">
                      {config.main_type === "suporte" ? "Suporte" : "Implantação"} - {verticals.find(v => v.code === config.vertical)?.name || config.vertical} - {config.ticket_type}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{config.columns?.length || 0} colunas configuradas</p>
                  </div>
                  <Button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(config.id); }}
                    size="sm" variant="ghost" className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}