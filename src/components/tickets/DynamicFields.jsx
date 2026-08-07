import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function DynamicFields({ config, values, onChange }) {
  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: () => api.entities.TicketCustomField.list(),
  });

  if (!config || !config.fields_config) return null;

  const sortedFields = [...config.fields_config].sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleChange = (fieldName, value) => {
    onChange({ ...values, [fieldName]: value });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-400 border-b border-[rgba(139,92,246,0.1)] pb-2">
        Campos Específicos - {config.service_type} ({config.vertical})
      </h4>
      {sortedFields.map((field) => {
        // Se for campo reutilizável, buscar definição do TicketCustomField
        let fieldDef = field;
        if (field.source === "custom_field" && field.custom_field_key) {
          const customField = customFields.find(cf => cf.field_key === field.custom_field_key);
          if (customField) {
            fieldDef = {
              ...field,
              field_name: customField.field_key,
              field_label: customField.field_label,
              field_type: customField.field_type,
              options: customField.field_options?.map(o => o.label || o.value) || [],
            };
          }
        }

        const value = values?.[fieldDef.field_name] || "";

        switch (fieldDef.field_type) {
          case "text":
            return (
              <div key={fieldDef.field_name}>
                <Label className="text-gray-500 text-xs mb-1.5 block">
                  {fieldDef.field_label} {field.required && <span className="text-red-400">*</span>}
                </Label>
                <Input
                  value={value}
                  onChange={(e) => handleChange(fieldDef.field_name, e.target.value)}
                  className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white"
                  required={field.required}
                />
              </div>
            );

          case "textarea":
            return (
              <div key={fieldDef.field_name}>
                <Label className="text-gray-500 text-xs mb-1.5 block">
                  {fieldDef.field_label} {field.required && <span className="text-red-400">*</span>}
                </Label>
                <Textarea
                  value={value}
                  onChange={(e) => handleChange(fieldDef.field_name, e.target.value)}
                  className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white min-h-[100px]"
                  required={field.required}
                />
              </div>
            );

          case "select":
            return (
              <div key={fieldDef.field_name}>
                <Label className="text-gray-500 text-xs mb-1.5 block">
                  {fieldDef.field_label} {field.required && <span className="text-red-400">*</span>}
                </Label>
                <Select value={value} onValueChange={(v) => handleChange(fieldDef.field_name, v)}>
                  <SelectTrigger className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white">
                    <SelectValue placeholder={`Selecione ${fieldDef.field_label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                    {fieldDef.options?.map(opt => (
                      <SelectItem key={opt} value={opt} className="text-gray-200">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );

          case "checkbox":
            return (
              <div key={fieldDef.field_name} className="flex items-center gap-2">
                <Checkbox
                  checked={value === true || value === "true"}
                  onCheckedChange={(checked) => handleChange(fieldDef.field_name, checked)}
                  className="border-[rgba(139,92,246,0.3)]"
                />
                <Label className="text-gray-400 text-sm cursor-pointer">
                  {fieldDef.field_label}
                </Label>
              </div>
            );

          case "date":
            return (
              <div key={fieldDef.field_name}>
                <Label className="text-gray-500 text-xs mb-1.5 block">
                  {fieldDef.field_label} {field.required && <span className="text-red-400">*</span>}
                </Label>
                <Input
                  type="date"
                  value={value}
                  onChange={(e) => handleChange(fieldDef.field_name, e.target.value)}
                  className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white"
                  required={field.required}
                />
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}