import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp } from "lucide-react";
import MultiSelectCombo from "./MultiSelectCombo";

export default function ReportFiltersSection({
  config, collapsed, onToggleCollapse,
  dateStart, dateEnd, onDateStart, onDateEnd, dateError,
  radioValue, onRadioChange,
  multiValues, onMultiChange, multiOptions,
  checkboxValue, onCheckboxChange,
}) {
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 gap-3">
        <div>
          <h1 className="text-[16px] font-bold text-foreground">{config.title}</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">{config.description}</p>
        </div>
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir filtros" : "Recolher filtros"}
          aria-expanded={!collapsed}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border border-border bg-muted hover:bg-accent transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
          {/* Período */}
          <div>
            <p className="text-[12px] font-semibold text-foreground mb-2">{config.dateLabel || "Período"}</p>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rep-date-start" className="text-[11px] text-muted-foreground">Início</Label>
                <Input id="rep-date-start" type="date" value={dateStart} onChange={(e) => onDateStart(e.target.value)} className="h-9 w-[160px] text-[12px]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rep-date-end" className="text-[11px] text-muted-foreground">Fim</Label>
                <Input id="rep-date-end" type="date" value={dateEnd} onChange={(e) => onDateEnd(e.target.value)} className="h-9 w-[160px] text-[12px]" />
              </div>
              <p className={`text-[11px] self-end pb-2 ${dateError ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {dateError || "Consulta deve ser igual a um ano ou menor"}
              </p>
            </div>
          </div>

          {/* Radio group */}
          {config.radio && (
            <div>
              <p className="text-[12px] font-semibold text-foreground mb-2">{config.radio.label}</p>
              <RadioGroup value={radioValue} onValueChange={onRadioChange} className="flex flex-wrap gap-4">
                {config.radio.options.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <RadioGroupItem value={opt.value} id={`radio-${opt.value}`} />
                    <Label htmlFor={`radio-${opt.value}`} className="text-[12px] font-normal cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Outros filtros */}
          {config.filters?.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold text-foreground mb-2">Outros filtros</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {config.filters.map((f) => (
                  <MultiSelectCombo
                    key={f.key}
                    label={f.label}
                    options={multiOptions[f.key] || []}
                    selected={multiValues[f.key] || []}
                    onChange={(vals) => onMultiChange(f.key, vals)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Checkbox complementar */}
          {config.checkbox && (
            <div className="flex items-center gap-2">
              <Checkbox id="rep-checkbox" checked={checkboxValue} onCheckedChange={onCheckboxChange} />
              <Label htmlFor="rep-checkbox" className="text-[12px] font-normal cursor-pointer">{config.checkbox.label}</Label>
            </div>
          )}
        </div>
      )}
    </section>
  );
}