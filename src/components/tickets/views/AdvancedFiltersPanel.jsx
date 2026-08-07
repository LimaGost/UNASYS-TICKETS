import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { ChevronDown, ChevronRight, Eraser } from "lucide-react";
import { emptyAdvanced } from "./filterUtils";

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border pb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 py-2 text-left"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-[12px] font-semibold text-foreground">{title}</span>
      </button>
      {open && <div className="space-y-3 pt-1">{children}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-muted-foreground font-medium">{label}</label>
      {children}
    </div>
  );
}

function DateRange({ label, fromKey, toKey, adv, set }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input type="date" value={adv[fromKey]} onChange={e => set(fromKey, e.target.value)} className="h-8 text-xs" />
        <span className="text-[11px] text-muted-foreground">até</span>
        <Input type="date" value={adv[toKey]} onChange={e => set(toKey, e.target.value)} className="h-8 text-xs" />
      </div>
    </Field>
  );
}

function RadioRow({ label, value, options, onChange }) {
  return (
    <Field label={label}>
      <RadioGroup value={value} onValueChange={onChange} className="flex items-center gap-4">
        {options.map(o => (
          <div key={o.value} className="flex items-center gap-1.5">
            <RadioGroupItem value={o.value} id={`${label}-${o.value}`} />
            <Label htmlFor={`${label}-${o.value}`} className="text-[11px] font-normal cursor-pointer">{o.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </Field>
  );
}

export default function AdvancedFiltersPanel({ open, onOpenChange, adv, setAdv, categories = [], statuses = [] }) {
  const set = (key, value) => setAdv(prev => ({ ...prev, [key]: value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px] overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">Filtros avançados</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-1 mt-2">
          <Section title="Por conteúdo">
            <Field label="Número do ticket">
              <Input value={adv.ticketNumber} onChange={e => set("ticketNumber", e.target.value)} placeholder="Ex.: 42" className="h-8 text-xs" />
            </Field>
            <Field label="Assunto / título">
              <Input value={adv.subject} onChange={e => set("subject", e.target.value)} placeholder="Contém..." className="h-8 text-xs" />
            </Field>
            <Field label="Texto da descrição">
              <Input value={adv.description} onChange={e => set("description", e.target.value)} placeholder="Contém..." className="h-8 text-xs" />
            </Field>
          </Section>

          <Section title="Por pessoas envolvidas">
            <Field label="Solicitante">
              <Input value={adv.requester} onChange={e => set("requester", e.target.value)} placeholder="Nome do solicitante" className="h-8 text-xs" />
            </Field>
            <Field label="Cliente">
              <Input value={adv.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Nome do cliente" className="h-8 text-xs" />
            </Field>
          </Section>

          <Section title="Por datas" defaultOpen={false}>
            <DateRange label="Data de abertura" fromKey="createdFrom" toKey="createdTo" adv={adv} set={set} />
            <DateRange label="Previsão de solução" fromKey="expectedFrom" toKey="expectedTo" adv={adv} set={set} />
            <DateRange label="Data de encerramento" fromKey="closedFrom" toKey="closedTo" adv={adv} set={set} />
          </Section>

          <Section title="Por classificação" defaultOpen={false}>
            <Field label="Categoria">
              <SearchableSelect
                value={adv.category}
                onValueChange={v => set("category", v || "")}
                options={categories.map(c => ({ value: c, label: c }))}
                placeholder="Todas"
                className="[&>button]:h-8 [&>button]:text-xs"
              />
            </Field>
            <Field label="Status / etapa">
              <SearchableSelect
                value={adv.status}
                onValueChange={v => set("status", v || "")}
                options={statuses.map(s => ({ value: s, label: s }))}
                placeholder="Todos"
                className="[&>button]:h-8 [&>button]:text-xs"
              />
            </Field>
            <RadioRow
              label="SLA"
              value={adv.slaStatus}
              onChange={v => set("slaStatus", v)}
              options={[
                { value: "all", label: "Todos" },
                { value: "breached", label: "Vencido" },
                { value: "ok", label: "Em dia" },
              ]}
            />
            <RadioRow
              label="Cliente notificado"
              value={adv.notified}
              onChange={v => set("notified", v)}
              options={[
                { value: "all", label: "Todos" },
                { value: "yes", label: "Sim" },
                { value: "no", label: "Não" },
              ]}
            />
          </Section>
        </div>

        <div className="flex items-center gap-2 pt-4 mt-auto">
          <Button variant="outline" onClick={() => setAdv({ ...emptyAdvanced })} className="h-8 text-xs gap-1.5 flex-1">
            <Eraser className="w-3.5 h-3.5" /> Limpar todos
          </Button>
          <Button onClick={() => onOpenChange(false)} className="h-8 text-xs flex-1">
            Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}