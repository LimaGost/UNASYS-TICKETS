import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";

export default function MultiSelectCombo({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);

  const toggle = (value) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-[11px] font-medium text-muted-foreground" id={`msc-${label}`}>{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-labelledby={`msc-${label}`}
            className="h-9 justify-between text-[12px] font-normal w-full"
          >
            <span className="truncate">
              {selected.length === 0 ? "Todos" : `${selected.length} selecionado${selected.length > 1 ? "s" : ""}`}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {selected.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5">{selected.length}</Badge>}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} className="text-[12px]" />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)} className="text-[12px] cursor-pointer">
                    <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary flex-shrink-0 ${selected.includes(opt) ? "bg-primary text-primary-foreground" : "opacity-40"}`}>
                      {selected.includes(opt) && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}