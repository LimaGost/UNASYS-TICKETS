import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

export default function CustomFieldsRenderer({ ticket, vertical, serviceType }) {
  const queryClient = useQueryClient();

  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields", vertical, serviceType],
    queryFn: () => api.entities.TicketCustomField.list(),
    select: (fields) => fields.filter(f => {
      if (!f.active || f.vertical !== vertical) return false;
      if (f.apply_to_ticket_types?.length > 0) return f.apply_to_ticket_types.includes(serviceType);
      return true;
    }).sort((a, b) => (a.order || 0) - (b.order || 0)).map(f => ({
      ...f,
      field_options: Array.isArray(f.field_options) ? f.field_options : [],
    })),
    enabled: !!vertical && !!serviceType,
  });

  const { data: customData = [] } = useQuery({
    queryKey: ["customData", ticket.id],
    queryFn: () => api.entities.TicketCustomData.filter({ ticket_id: ticket.id }),
    enabled: !!ticket.id,
  });

  const [fieldValues, setFieldValues] = useState({});

  useEffect(() => {
    const values = {};
    customData.forEach(d => {
      values[d.field_key] = d.field_value;
    });
    setFieldValues(values);
  }, [customData]);

  const saveMutation = useMutation({
    mutationFn: async ({ fieldKey, value }) => {
      const existing = customData.find(d => d.field_key === fieldKey);
      if (existing) {
        await api.entities.TicketCustomData.update(existing.id, { field_value: value });
      } else {
        await api.entities.TicketCustomData.create({
          ticket_id: ticket.id,
          field_key: fieldKey,
          field_value: value,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customData", ticket.id] });
    },
  });

  const handleChange = (fieldKey, value) => {
    setFieldValues({ ...fieldValues, [fieldKey]: value });
    saveMutation.mutate({ fieldKey, value });
  };

  if (customFields.length === 0) return null;

  // Group by section
  const sections = {};
  customFields.forEach(field => {
    const section = field.section || "Informações";
    if (!sections[section]) sections[section] = [];
    sections[section].push(field);
  });

  return (
    <>
      {Object.entries(sections).map(([sectionName, fields]) => (
        <div key={sectionName} className="pt-3 border-t border-[rgba(139,92,246,0.1)]">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">{sectionName}</p>
          <div className="space-y-3">
            {fields.map(field => (
              <div key={field.id}>
                <Label className="text-[10px] text-gray-600 mb-1.5">{field.field_label}</Label>
                {field.field_type === "text" && (
                  <Input
                    value={fieldValues[field.field_key] || ""}
                    onChange={(e) => handleChange(field.field_key, e.target.value)}
                    className="bg-[#0B0D15] border-[rgba(139,92,246,0.2)] text-sm h-8"
                  />
                )}
                {field.field_type === "number" && (
                  <Input
                    type="number"
                    value={fieldValues[field.field_key] || ""}
                    onChange={(e) => handleChange(field.field_key, e.target.value)}
                    className="bg-[#0B0D15] border-[rgba(139,92,246,0.2)] text-sm h-8"
                  />
                )}
                {field.field_type === "date" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal h-8 text-sm bg-[#0B0D15] border-[rgba(139,92,246,0.2)]"
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {fieldValues[field.field_key] ? format(new Date(fieldValues[field.field_key]), "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-[#161830]">
                      <Calendar
                        mode="single"
                        selected={fieldValues[field.field_key] ? new Date(fieldValues[field.field_key]) : undefined}
                        onSelect={(date) => handleChange(field.field_key, date?.toISOString())}
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {field.field_type === "select" && (
                  <Select value={fieldValues[field.field_key] || ""} onValueChange={(v) => handleChange(field.field_key, v)}>
                    <SelectTrigger className="bg-[#0B0D15] border-[rgba(139,92,246,0.2)] h-8 text-sm">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                      {field.field_options?.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.field_type === "badge" && (
                  <Select value={fieldValues[field.field_key] || ""} onValueChange={(v) => handleChange(field.field_key, v)}>
                    <SelectTrigger className="bg-[#0B0D15] border-[rgba(139,92,246,0.2)] h-8 text-sm">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                      {field.field_options?.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <Badge style={{ backgroundColor: opt.color + "30", color: opt.color }}>
                            {opt.label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.field_type === "flag" && (
                  <div className="flex flex-wrap gap-2">
                    {field.field_options?.map(opt => {
                      const selected = fieldValues[field.field_key] === opt.value;
                      return (
                        <Badge
                          key={opt.value}
                          onClick={() => handleChange(field.field_key, selected ? "" : opt.value)}
                          style={{ 
                            backgroundColor: selected ? opt.color : opt.color + "20", 
                            color: selected ? "#fff" : opt.color,
                            cursor: "pointer"
                          }}
                          className="text-xs"
                        >
                          {opt.label}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {field.field_type === "multiselect" && (
                  <div className="flex flex-wrap gap-2">
                    {field.field_options?.map(opt => {
                      let selectedValues = [];
                      try { selectedValues = fieldValues[field.field_key] ? JSON.parse(fieldValues[field.field_key]) : []; } catch { selectedValues = []; }
                      const selected = selectedValues.includes(opt.value);
                      return (
                        <Badge
                          key={opt.value}
                          onClick={() => {
                            const newValues = selected 
                              ? selectedValues.filter(v => v !== opt.value)
                              : [...selectedValues, opt.value];
                            handleChange(field.field_key, JSON.stringify(newValues));
                          }}
                          style={{ 
                            backgroundColor: selected ? opt.color : opt.color + "20", 
                            color: selected ? "#fff" : opt.color,
                            cursor: "pointer"
                          }}
                          className="text-xs"
                        >
                          {opt.label}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}