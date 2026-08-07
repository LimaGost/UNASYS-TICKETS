import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "../components/ui/SearchableSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";

export default function DynamicFormConfig() {
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState(null);
  const [fields, setFields] = useState([]);

  const { data: configs = [] } = useQuery({
    queryKey: ["formConfigs"],
    queryFn: () => api.entities.ServiceFormConfig.list(),
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => api.entities.ServiceType.list(),
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: () => api.entities.TicketCustomField.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingConfig?.id) {
        return api.entities.ServiceFormConfig.update(editingConfig.id, data);
      }
      return api.entities.ServiceFormConfig.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formConfigs"] });
      setEditingConfig(null);
      setFields([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ServiceFormConfig.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["formConfigs"] }),
  });

  const addField = (type = "inline") => {
    const newField = {
      source: type,
      required: false,
      order: fields.length,
    };
    
    if (type === "inline") {
      newField.field_name = "";
      newField.field_label = "";
      newField.field_type = "text";
      newField.options = [];
    } else {
      newField.custom_field_key = "";
    }
    
    setFields([...fields, newField]);
  };

  const updateField = (idx, key, value) => {
    const updated = [...fields];
    updated[idx][key] = value;
    setFields(updated);
  };

  const removeField = (idx) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!editingConfig?.service_type || !editingConfig?.vertical) return;
    saveMutation.mutate({
      service_type: editingConfig.service_type,
      vertical: editingConfig.vertical,
      fields_config: fields,
      active: true,
    });
  };

  const startEdit = (config) => {
    setEditingConfig(config);
    setFields(config.fields_config || []);
  };

  const startNew = () => {
    setEditingConfig({ service_type: "", vertical: "" });
    setFields([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formulários Dinâmicos"
        subtitle="Configure campos customizados por serviço e vertical"
        action={
          <Button onClick={startNew} className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-2">
            <Plus className="w-4 h-4" />
            Nova Configuração
          </Button>
        }
      />

      {editingConfig ? (
        <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
          <CardHeader>
            <CardTitle className="text-white text-lg">
              {editingConfig.id ? "Editar Configuração" : "Nova Configuração"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400 text-xs mb-2 block">Tipo de Serviço</Label>
                <SearchableSelect
                  value={editingConfig.service_type}
                  onValueChange={(v) => setEditingConfig({...editingConfig, service_type: v})}
                  options={serviceTypes.map(st => ({ value: st.name, label: st.name }))}
                  placeholder="Selecione o serviço"
                  searchPlaceholder="Buscar serviço..."
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs mb-2 block">Vertical</Label>
                <SearchableSelect
                  value={editingConfig.vertical}
                  onValueChange={(v) => setEditingConfig({...editingConfig, vertical: v})}
                  options={verticals.filter(v => v.active).map(v => ({ value: v.code, label: v.name }))}
                  placeholder="Selecione a vertical"
                  searchPlaceholder="Buscar vertical..."
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-gray-400 text-sm">Campos Customizados</Label>
                <div className="flex gap-2">
                  <Button onClick={() => addField("custom_field")} size="sm" variant="outline" className="border-[rgba(139,92,246,0.2)] text-gray-400 h-8 gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Usar Campo Existente
                  </Button>
                  <Button onClick={() => addField("inline")} size="sm" variant="outline" className="border-[rgba(139,92,246,0.2)] text-gray-400 h-8 gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Criar Campo Novo
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {fields.map((field, idx) => {
                  const selectedCustomField = field.source === "custom_field" && field.custom_field_key
                    ? customFields.find(cf => cf.field_key === field.custom_field_key)
                    : null;
                  
                  return (
                    <div key={idx} className="p-4 bg-[#111322] border border-[rgba(139,92,246,0.1)] rounded-lg space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-[#8B5CF6]/20 text-[#A78BFA]">
                          {field.source === "custom_field" ? "Campo Reutilizável" : "Campo Inline"}
                        </span>
                        <Button onClick={() => removeField(idx)} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {field.source === "custom_field" ? (
                        <>
                          <div>
                             <Label className="text-gray-500 text-xs mb-1.5 block">Selecionar Campo Customizado</Label>
                             <SearchableSelect
                               value={field.custom_field_key || ""}
                               onValueChange={(v) => updateField(idx, "custom_field_key", v)}
                               options={customFields.map(cf => ({ value: cf.field_key, label: `${cf.field_label} (${cf.field_type})` }))}
                               placeholder="Escolha um campo"
                               searchPlaceholder="Buscar campo..."
                             />
                           </div>
                          
                          {selectedCustomField && (
                            <div className="p-3 bg-[#0B0D15]/50 rounded border border-[rgba(139,92,246,0.1)]">
                              <p className="text-xs text-gray-500 mb-1">Preview do campo:</p>
                              <p className="text-sm text-gray-300"><strong>{selectedCustomField.field_label}</strong></p>
                              <p className="text-xs text-gray-500">Tipo: {selectedCustomField.field_type}</p>
                              {selectedCustomField.field_options && selectedCustomField.field_options.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Opções: {selectedCustomField.field_options.map(o => o.label || o.value).join(", ")}
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-gray-500 text-xs mb-1.5 block">Nome do Campo</Label>
                              <Input value={field.field_name || ""} onChange={(e) => updateField(idx, "field_name", e.target.value)}
                                placeholder="dados_fiscais"
                                className="bg-[#0B0D15] border-[rgba(139,92,246,0.15)] text-white h-9 text-sm" />
                            </div>
                            <div>
                              <Label className="text-gray-500 text-xs mb-1.5 block">Label</Label>
                              <Input value={field.field_label || ""} onChange={(e) => updateField(idx, "field_label", e.target.value)}
                                placeholder="Dados Fiscais"
                                className="bg-[#0B0D15] border-[rgba(139,92,246,0.15)] text-white h-9 text-sm" />
                            </div>
                            <div>
                              <Label className="text-gray-500 text-xs mb-1.5 block">Tipo</Label>
                              <Select value={field.field_type || "text"} onValueChange={(v) => updateField(idx, "field_type", v)}>
                                <SelectTrigger className="bg-[#0B0D15] border-[rgba(139,92,246,0.15)] text-white h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                                  <SelectItem value="text" className="text-gray-200">Texto</SelectItem>
                                  <SelectItem value="textarea" className="text-gray-200">Texto Longo</SelectItem>
                                  <SelectItem value="select" className="text-gray-200">Seleção</SelectItem>
                                  <SelectItem value="multiselect" className="text-gray-200">Múltipla Escolha</SelectItem>
                                  <SelectItem value="checkbox" className="text-gray-200">Checkbox</SelectItem>
                                  <SelectItem value="date" className="text-gray-200">Data</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {(field.field_type === "select" || field.field_type === "multiselect") && (
                            <div>
                              <Label className="text-gray-500 text-xs mb-1.5 block">Opções (separadas por vírgula)</Label>
                              <Input value={field.options?.join(", ") || ""} 
                                onChange={(e) => updateField(idx, "options", e.target.value.split(",").map(s => s.trim()))}
                                placeholder="Opção 1, Opção 2, Opção 3"
                                className="bg-[#0B0D15] border-[rgba(139,92,246,0.15)] text-white h-9 text-sm" />
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex items-center">
                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateField(idx, "required", e.target.checked)}
                            className="w-4 h-4 rounded border-[rgba(139,92,246,0.2)] bg-[#0B0D15]" />
                          Campo obrigatório
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(139,92,246,0.1)]">
              <Button variant="outline" onClick={() => { setEditingConfig(null); setFields([]); }}
                className="border-[rgba(139,92,246,0.2)] text-gray-400">
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-[#10B981] hover:bg-[#059669] text-white">
                Salvar Configuração
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {configs.map(config => (
            <Card key={config.id} className="bg-[#161830] border-[rgba(139,92,246,0.15)] hover:border-[#8B5CF6]/30 transition-colors cursor-pointer"
              onClick={() => startEdit(config)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-base">{config.service_type} - {config.vertical}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">{config.fields_config?.length || 0} campos configurados</p>
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