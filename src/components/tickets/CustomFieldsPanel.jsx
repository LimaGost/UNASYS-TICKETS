import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function CustomFieldsPanel({ ticket, serviceType, vertical, isEditing = false, onFieldsChange }) {
  const queryClient = useQueryClient();

  const { data: allCustomFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: () => api.entities.TicketCustomField.list(),
  });

  // Busca todos os registros de dados customizados deste ticket
  const { data: rawCustomData = [], isLoading: loadingData } = useQuery({
    queryKey: ["ticketCustomData", ticket?.id],
    queryFn: () => api.entities.TicketCustomData.filter({ ticket_id: ticket.id }),
    enabled: !!ticket?.id,
  });

  // Monta mapa { field_key → { id, field_value } }
  const dataMap = React.useMemo(() => {
    const map = {};
    (rawCustomData || []).forEach(d => { map[d.field_key] = d; });
    return map;
  }, [rawCustomData]);

  // Filtra campos desta vertical respeitando o serviceType selecionado
  // Se não houver serviceType, não exibe nada
  const applicableFields = !serviceType ? [] : allCustomFields.filter(f => {
    if (!f.active) return false;
    if (f.vertical !== vertical) return false;
    if (f.visible_in_detail === false) return false;
    // Se o campo tem restrição de tipos de serviço, o serviceType atual deve estar na lista
    if (f.apply_to_ticket_types?.length > 0) {
      return f.apply_to_ticket_types.includes(serviceType);
    }
    // Sem restrição = aparece para todos os serviços (desde que haja um selecionado)
    return true;
  }).sort((a, b) => (a.order || 0) - (b.order || 0)).map(f => ({
    ...f,
    field_options: Array.isArray(f.field_options) ? f.field_options : [],
  }));

  const saveMutation = useMutation({
    mutationFn: async ({ fieldKey, value }) => {
      const existing = dataMap[fieldKey];
      const strValue = Array.isArray(value) ? JSON.stringify(value) : (value == null ? "" : String(value));
      if (existing?.id) {
        await api.entities.TicketCustomData.update(existing.id, { field_value: strValue });
      } else {
        await api.entities.TicketCustomData.create({
          ticket_id: ticket.id,
          field_key: fieldKey,
          field_value: strValue,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticketCustomData", ticket?.id] });
    },
  });

  if (!applicableFields.length) return null;

  const fieldsBySection = {};
  applicableFields.forEach(field => {
    const section = field.section || "Informações";
    if (!fieldsBySection[section]) fieldsBySection[section] = [];
    fieldsBySection[section].push(field);
  });

  const getRawValue = (fieldKey) => dataMap[fieldKey]?.field_value ?? "";

  return (
    <div className="space-y-5">
      {Object.entries(fieldsBySection).map(([section, fields]) => (
        <div key={section}>
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-3">{section}</p>
          <div className="grid grid-cols-2 gap-3">
            {fields.map(field => (
              <div key={field.field_key} className={field.column_span === 2 ? "col-span-2" : "col-span-1"}>
                <FieldRenderer
                  field={field}
                  rawValue={getRawValue(field.field_key)}
                  onSave={(v) => saveMutation.mutate({ fieldKey: field.field_key, value: v })}
                  isSaving={saveMutation.isPending}
                  editable={!!ticket?.id}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldRenderer({ field, rawValue, onSave, isSaving, editable }) {
  const [localValue, setLocalValue] = useState(rawValue);

  useEffect(() => {
    setLocalValue(rawValue);
  }, [rawValue]);

  const handleBlurSave = () => {
    if (localValue !== rawValue) onSave(localValue);
  };

  const handleChangeSave = (val) => {
    setLocalValue(val);
    onSave(val);
  };

  const renderInput = () => {
    switch (field.field_type) {
      case "text":
        return (
          <Input
            value={localValue || ""}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlurSave}
            disabled={isSaving}
            className="bg-background border-input text-foreground h-8 text-sm"
            placeholder={field.field_label}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={localValue || ""}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => { if (localValue !== rawValue) onSave(localValue ? Number(localValue) : null); }}
            disabled={isSaving}
            className="bg-background border-input text-foreground h-8 text-sm"
            placeholder={field.field_label}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={localValue || ""}
            onChange={(e) => handleChangeSave(e.target.value)}
            disabled={isSaving}
            className="bg-background border-input text-foreground h-8 text-sm"
          />
        );

      case "select":
        return (
          <Select value={localValue || ""} onValueChange={handleChangeSave} disabled={isSaving}>
            <SelectTrigger className="bg-background border-input text-foreground h-8">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {field.field_options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    {opt.color && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />}
                    {opt.label || opt.value}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect": {
        let selected = [];
        try {
          const parsed = JSON.parse(localValue || "[]");
          selected = Array.isArray(parsed) ? parsed : [];
        } catch { selected = []; }
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 min-h-[28px] p-1.5 bg-background border border-input rounded-md">
              {selected.map(v => {
                const opt = field.field_options?.find(o => o.value === v);
                return (
                  <Badge
                    key={v}
                    className="text-xs cursor-pointer hover:opacity-70"
                    style={{ background: `${opt?.color || "#8B5CF6"}30`, color: opt?.color || "#A78BFA" }}
                    onClick={() => {
                      const next = selected.filter(s => s !== v);
                      handleChangeSave(JSON.stringify(next));
                    }}
                  >
                    {opt?.label || v} ×
                  </Badge>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {field.field_options?.filter(o => !selected.includes(o.value)).map(opt => (
                <Badge
                  key={opt.value}
                  className="text-xs cursor-pointer"
                  style={{ background: `${opt.color || "#8B5CF6"}10`, color: opt.color || "#A78BFA", border: `1px solid ${opt.color || "#8B5CF6"}30` }}
                  onClick={() => {
                    const next = [...selected, opt.value];
                    handleChangeSave(JSON.stringify(next));
                  }}
                >
                  + {opt.label || opt.value}
                </Badge>
              ))}
            </div>
          </div>
        );
      }

      case "badge": {
        const opt = field.field_options?.find(o => o.value === localValue);
        return (
          <Select value={localValue || ""} onValueChange={handleChangeSave} disabled={isSaving}>
            <SelectTrigger className="bg-background border-input h-8" style={{ color: opt?.color || undefined }}>
              <SelectValue placeholder="Selecionar...">
                {opt ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                    {opt.label || opt.value}
                  </span>
                ) : "Selecionar..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {field.field_options?.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.color }} />
                    {o.label || o.value}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case "flag": {
        const opt = field.field_options?.find(o => o.value === localValue);
        return (
          <div className="flex flex-wrap gap-2">
            {field.field_options?.map(o => {
              const active = localValue === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => handleChangeSave(active ? "" : o.value)}
                  disabled={isSaving}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all border"
                  style={active
                    ? { background: `${o.color}30`, color: o.color, borderColor: `${o.color}50` }
                    : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                  }
                >
                  {o.label || o.value}
                </button>
              );
            })}
          </div>
        );
      }

      default:
        return       <span className="text-xs text-muted-foreground">Tipo não suportado</span>;
    }
  };

  // Modo leitura (sem ticket.id)
  if (!editable) {
    let displayValue = rawValue || "—";
    if (field.field_type === "multiselect") {
      try {
        const arr = JSON.parse(rawValue || "[]");
        return (
          <div>
            <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wide">{field.field_label}</label>
            <div className="flex flex-wrap gap-1.5">
              {arr.map(v => {
                const opt = field.field_options?.find(o => o.value === v);
                return <Badge key={v} style={{ background: `${opt?.color || "hsl(var(--primary))"}20`, color: opt?.color || "hsl(var(--primary))" }}>{opt?.label || v}</Badge>;
              })}
            </div>
          </div>
        );
      } catch { }
    }
    if (["badge", "flag", "select"].includes(field.field_type)) {
      const opt = field.field_options?.find(o => o.value === rawValue);
      if (opt) displayValue = <Badge style={{ background: `${opt.color}20`, color: opt.color }}>{opt.label || opt.value}</Badge>;
    }
    return (
      <div>
        <label className="text-[11px] text-muted-foreground mb-1.5 block uppercase tracking-wide">{field.field_label}</label>
        <span className="text-sm text-foreground">{displayValue}</span>
      </div>
    );
  }

  return (
    <div>
      <label className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wide font-medium">
        {field.field_label}
        {field.required && <span className="text-destructive text-xs">*</span>}
        {isSaving && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
      </label>
      {renderInput()}
    </div>
  );
}