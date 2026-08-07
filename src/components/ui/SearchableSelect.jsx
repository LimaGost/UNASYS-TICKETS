import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SearchableSelect — dropdown com busca por digitação.
 *
 * Props:
 *   value        — valor selecionado (string)
 *   onValueChange — callback(value)
 *   options       — [{ value, label, color?, searchTerms? }] ou string[]
 *                   searchTerms: string[] com termos extras (ex: cnpj, email)
 *   placeholder  — texto quando vazio
 *   searchPlaceholder — placeholder do input de busca
 *   disabled
 *   className    — classes extras no trigger
 *   emptyText    — texto quando não há resultados
 */

// Remove tudo que não é dígito para comparar CNPJs com ou sem formatação
const onlyDigits = (str) => (str || "").replace(/\D/g, "");

export default function SearchableSelect({
  value,
  onValueChange,
  options = [],
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  disabled = false,
  className = "",
  emptyText = "Nenhum resultado encontrado.",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize options to [{value, label}]
  const normalized = options.map(o =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  const filtered = normalized.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const qDigits = onlyDigits(q);

    // Busca no label
    if (o.label.toLowerCase().includes(q)) return true;

    // Busca nos termos extras (ex: cnpj, email)
    if (Array.isArray(o.searchTerms)) {
      for (const term of o.searchTerms) {
        if (!term) continue;
        if (term.toLowerCase().includes(q)) return true;
        // Comparação numérica (CNPJ sem formatação)
        if (qDigits.length >= 3 && onlyDigits(term).includes(qDigits)) return true;
      }
    }
    return false;
  });

  const selected = normalized.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus input when open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleSelect = (val) => {
    onValueChange?.(val);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onValueChange?.("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 h-9 rounded-md border text-sm transition-colors",
          "bg-background border-input text-foreground",
          "hover:border-primary/50 focus:outline-none focus:border-primary",
          open && "border-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.color && (
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: selected.color }} />
              )}
              {selected.label}
            </span>
          ) : placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border shadow-xl overflow-hidden bg-popover">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              style={{ textTransform: "none" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground text-center">{emptyText}</li>
            ) : (
              filtered.map((o) => (
                <li
                  key={o.value}
                  onClick={() => handleSelect(o.value)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors",
                    value === o.value
                      ? "text-primary bg-primary/10"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {o.color && (
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.color }} />
                  )}
                  <span className="flex-1 truncate">{o.label}</span>
                  {value === o.value && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}