import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, Clock, RotateCcw, Users, CalendarClock, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { nowBrasilia } from "@/utils/dateUtils";

function fmt(decimalHours) {
  if (!decimalHours && decimalHours !== 0) return "—";
  const total = Math.round(decimalHours * 60);
  const h = Math.floor(Math.abs(total) / 60);
  const m = Math.abs(total) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function Sel({ label, value, onChange, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 px-2 text-[12px] rounded-lg border border-border bg-background text-foreground"
      >
        {children}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 px-2 text-[12px] rounded-lg border border-border bg-background text-foreground"
      />
    </div>
  );
}

// Quick period presets
function getPresetDates(preset) {
  // Datas calculadas no horário de Brasília
  const now = nowBrasilia();
  const todayStr = format(now, "yyyy-MM-dd");
  switch (preset) {
    case "today": return { start: todayStr, end: todayStr };
    case "week": {
      const s = new Date(now); s.setDate(now.getDate() - 6);
      return { start: format(s, "yyyy-MM-dd"), end: todayStr };
    }
    case "month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: format(s, "yyyy-MM-dd"), end: todayStr };
    }
    case "lastmonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: format(s, "yyyy-MM-dd"), end: format(e, "yyyy-MM-dd") };
    }
    case "quarter": {
      const s = new Date(now); s.setMonth(now.getMonth() - 3);
      return { start: format(s, "yyyy-MM-dd"), end: todayStr };
    }
    default: return { start: "", end: "" };
  }
}

const PRESETS = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Esta Semana" },
  { id: "month", label: "Este Mês" },
  { id: "lastmonth", label: "Mês Anterior" },
  { id: "quarter", label: "Trimestre" },
  { id: "custom", label: "Personalizado" },
];

export default function HoursReport() {
  const { user: currentUser } = useAuth();
  // Relatórios são sempre pessoais: todo usuário vê só os próprios apontamentos.
  const agentFilter = currentUser?.email || "";
  // Mesma fonte filtrada no servidor usada em Reports.jsx (queryKey igual =
  // reaproveita o cache do react-query, sem 2ª chamada de rede).
  const { data: reportsData } = useQuery({
    queryKey: ["reportsData"],
    queryFn: () => api.functions.invoke("getMyReportsData").then(r => r.data),
  });
  const allEntries = reportsData?.timeEntries || [];
  const allTickets = reportsData?.tickets || [];

  const ticketMap = useMemo(() => {
    const m = {};
    allTickets.forEach(t => { m[t.id] = t; });
    return m;
  }, [allTickets]);

  // Local filters
  const todayStr = format(nowBrasilia(), "yyyy-MM-dd");
  const firstOfMonth = format(new Date(nowBrasilia().getFullYear(), nowBrasilia().getMonth(), 1), "yyyy-MM-dd");

  const [preset, setPreset] = useState("month");
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [typeFilter, setTypeFilter] = useState(""); // "" | "normal" | "extra"
  const [groupBy, setGroupBy] = useState("agent"); // "agent" | "date" | "flat"
  const [expandedGroups, setExpandedGroups] = useState({});

  const handlePreset = (p) => {
    setPreset(p);
    if (p !== "custom") {
      const { start, end } = getPresetDates(p);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const handleReset = () => {
    setPreset("month");
    const { start, end } = getPresetDates("month");
    setStartDate(start);
    setEndDate(end);
    setTypeFilter("");
    setGroupBy("agent");
  };

  // Unique agents from all entries
  const uniqueAgents = useMemo(() => {
    const seen = new Map();
    allEntries.forEach(e => {
      if (e.technician_email && !seen.has(e.technician_email)) {
        seen.set(e.technician_email, e.technician_name || e.technician_email);
      }
    });
    return Array.from(seen.entries()).map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allEntries]);

  // Apply all filters to get working entries
  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      const dateStr = e.date ? e.date.split("T")[0] : null;
      if (startDate && dateStr && dateStr < startDate) return false;
      if (endDate && dateStr && dateStr > endDate) return false;
      if (agentFilter && e.technician_email !== agentFilter) return false;
      if (typeFilter === "normal" && !((e.normal_hours || 0) > 0)) return false;
      if (typeFilter === "extra" && !((e.extra_hours || 0) > 0)) return false;
      return true;
    }).map(e => ({ ...e, ticket: ticketMap[e.ticket_id] || null }));
  }, [allEntries, startDate, endDate, agentFilter, typeFilter, ticketMap]);

  const totalNormal = filtered.reduce((s, e) => s + (e.normal_hours || 0), 0);
  const totalExtra = filtered.reduce((s, e) => s + (e.extra_hours || 0), 0);

  // Group entries
  const groups = useMemo(() => {
    if (groupBy === "flat") return [{ key: "all", label: "Todos os Apontamentos", entries: filtered }];
    const map = {};
    filtered.forEach(e => {
      let key, label;
      if (groupBy === "agent") {
        key = e.technician_email || "__none__";
        label = e.technician_name || e.technician_email || "Sem responsável";
      } else {
        key = e.date ? e.date.split("T")[0] : "sem-data";
        label = key !== "sem-data"
          ? format(new Date(key + "T12:00:00"), "EEEE, dd/MM/yyyy", { locale: ptBR })
          : "Sem data";
      }
      if (!map[key]) map[key] = { key, label, entries: [] };
      map[key].entries.push(e);
    });
    const sorted = Object.values(map);
    if (groupBy === "date") sorted.sort((a, b) => b.key.localeCompare(a.key));
    else sorted.sort((a, b) => a.label.localeCompare(b.label));
    return sorted;
  }, [filtered, groupBy]);

  const toggleGroup = (key) => setExpandedGroups(p => ({ ...p, [key]: p[key] === false ? true : false }));
  const isExpanded = (key) => expandedGroups[key] !== false;

  const TH = ({ children, className = "" }) => (
    <th className={`px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
  const TD = ({ children, className = "" }) => (
    <td className={`px-3 py-2 text-[11px] border-b border-border/30 whitespace-nowrap ${className}`}>{children}</td>
  );

  const stripHtml = (html) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  };

  const EntryRow = ({ e }) => {
    const hasNormal = (e.normal_hours || 0) > 0;
    const hasExtra = (e.extra_hours || 0) > 0;
    const typeLabel = hasNormal && hasExtra ? "Normal + Extra" : hasExtra ? "Extra" : "Normal";
    const typeBg = hasExtra && hasNormal ? "bg-purple-500/10 text-purple-500" : hasExtra ? "bg-orange-500/10 text-orange-500" : "bg-primary/10 text-primary";
    const dateStr = e.date ? e.date.split("T")[0] : null;
    return (
      <tr className="hover:bg-muted/20 transition-colors">
        <TD>
          <div>
            <p className="text-[11px] font-semibold text-foreground">{e.technician_name || "—"}</p>
            {e.technician_email && <p className="text-[9px] text-muted-foreground">{e.technician_email}</p>}
          </div>
        </TD>
        <TD className="text-muted-foreground">
          {dateStr ? format(new Date(dateStr + "T12:00:00"), "dd/MM/yyyy") : "—"}
        </TD>
        <TD>
          {e.ticket ? (
            <span className="text-[10px] font-mono font-bold text-primary">
              #{String(e.ticket.ticket_number || "").padStart(4, "0")}
            </span>
          ) : <span className="text-muted-foreground/30">—</span>}
        </TD>
        <TD className="max-w-[160px]">
          <p className="truncate text-muted-foreground" title={e.ticket_title || e.ticket?.title || ""}>{e.ticket_title || e.ticket?.title || "—"}</p>
        </TD>
        <TD>
          <p className="truncate text-muted-foreground max-w-[120px]" title={e.ticket?.client_name || ""}>{e.ticket?.client_name || "—"}</p>
        </TD>
        <TD>
          {e.ticket?.ticket_type
            ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{e.ticket.ticket_type}</span>
            : <span className="text-muted-foreground/30">—</span>}
        </TD>
        <TD className="max-w-[200px]">
          {e.activities && e.activities.length > 0 ? (
            <p className="truncate text-muted-foreground" title={e.activities.join(", ")}>{e.activities.join(", ")}</p>
          ) : (
            <p className="truncate text-muted-foreground" title={stripHtml(e.description)}>{stripHtml(e.description) || "—"}</p>
          )}
        </TD>
        <TD className="font-mono text-muted-foreground">{e.start_time || "—"}</TD>
        <TD className="font-mono text-muted-foreground">{e.end_time || "—"}</TD>
        <TD><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeBg}`}>{typeLabel}</span></TD>
        <TD><span className="font-semibold text-primary tabular-nums">{fmt(e.normal_hours)}</span></TD>
        <TD><span className="font-semibold text-orange-500 tabular-nums">{fmt(e.extra_hours)}</span></TD>
        <TD><span className="font-bold text-foreground tabular-nums">{fmt((e.normal_hours || 0) + (e.extra_hours || 0))}</span></TD>
      </tr>
    );
  };

  return (
    <div className="space-y-4">

      {/* ── Filters ── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <span className="text-[13px] font-bold text-foreground">Filtros de Apontamentos</span>
          </div>
          <button onClick={handleReset} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3 h-3" /> Limpar
          </button>
        </div>

        {/* "Meus apontamentos" removido: relatório já é sempre pessoal, botão ficaria redundante */}

        {/* Period presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => handlePreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                preset === p.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:text-foreground"
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Date inputs — always visible */}
        <div className="flex flex-wrap gap-3 items-end">
          <DateInput label="Data Início" value={startDate} onChange={v => { setStartDate(v); setPreset("custom"); }} />
          <DateInput label="Data Fim" value={endDate} onChange={v => { setEndDate(v); setPreset("custom"); }} />

          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Responsável</label>
            <div className="h-8 px-2 rounded-lg border border-border bg-muted/40 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Lock className="w-3 h-3" /> Somente você
            </div>
          </div>

          <Sel label="Tipo de Hora" value={typeFilter} onChange={setTypeFilter}>
            <option value="">Normal + Extra</option>
            <option value="normal">Apenas Normal</option>
            <option value="extra">Apenas Extra</option>
          </Sel>

          <Sel label="Agrupar por" value={groupBy} onChange={setGroupBy}>
            <option value="agent">Responsável</option>
            <option value="date">Data</option>
            <option value="flat">Sem agrupamento</option>
          </Sel>

          <div className="flex flex-col justify-end ml-auto">
            <span className="text-[11px] text-muted-foreground">{filtered.length} apontamento{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      {filtered.length > 0 && groupBy === "agent" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {groups.map(g => {
            const gNormal = g.entries.reduce((s, e) => s + (e.normal_hours || 0), 0);
            const gExtra = g.entries.reduce((s, e) => s + (e.extra_hours || 0), 0);
            return (
              <div key={g.key} className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-primary-foreground bg-primary flex-shrink-0">
                    {g.label.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-[12px] font-semibold text-foreground truncate">{g.label}</p>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Normal</span>
                  <span className="font-bold text-primary tabular-nums">{fmt(gNormal)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Extra</span>
                  <span className="font-bold text-orange-500 tabular-nums">{fmt(gExtra)}</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-border pt-1 mt-0.5">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-emerald-500 tabular-nums">{fmt(gNormal + gExtra)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{g.entries.length} apontamentos</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <p className="text-[13px] font-bold text-foreground">Apontamentos</p>
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {fmt(totalNormal)} normais · {fmt(totalExtra)} extras · {fmt(totalNormal + totalExtra)} total
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground space-y-2">
            <Clock className="w-8 h-8 mx-auto opacity-20" />
            <p className="text-sm">Nenhum apontamento encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40">
                <tr>
                  <TH>Responsável</TH>
                  <TH>Data</TH>
                  <TH>Ticket</TH>
                  <TH>Título</TH>
                  <TH>Cliente</TH>
                  <TH>Tipo Ticket</TH>
                  <TH>Descrição</TH>
                  <TH>Início</TH>
                  <TH>Fim</TH>
                  <TH>Tipo</TH>
                  <TH>H. Normais</TH>
                  <TH>H. Extras</TH>
                  <TH>Total</TH>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const gNormal = g.entries.reduce((s, e) => s + (e.normal_hours || 0), 0);
                  const gExtra = g.entries.reduce((s, e) => s + (e.extra_hours || 0), 0);
                  const expanded = isExpanded(g.key);
                  const showGroupRow = groupBy !== "flat";

                  return (
                    <React.Fragment key={g.key}>
                      {showGroupRow && (
                        <tr
                          className="bg-muted/60 cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => toggleGroup(g.key)}
                        >
                          <td colSpan={10} className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {expanded
                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                              <span className="text-[12px] font-bold text-foreground capitalize">{g.label}</span>
                              <span className="text-[10px] text-muted-foreground ml-1">
                                · {g.entries.length} apontamento{g.entries.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] font-bold text-primary tabular-nums">{fmt(gNormal)}</td>
                          <td className="px-3 py-2.5 text-[11px] font-bold text-orange-500 tabular-nums">{fmt(gExtra)}</td>
                          <td className="px-3 py-2.5 text-[11px] font-bold text-emerald-500 tabular-nums">{fmt(gNormal + gExtra)}</td>
                        </tr>
                      )}
                      {(expanded || groupBy === "flat") && g.entries
                        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
                        .map((e, idx) => <EntryRow key={e.id || idx} e={e} />)}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/80 border-t-2 border-border">
                <tr>
                  <td colSpan={10} className="px-3 py-3 text-[11px] font-bold text-foreground">
                    TOTAL GERAL
                  </td>
                  <td className="px-3 py-3 text-[13px] font-bold text-primary tabular-nums">{fmt(totalNormal)}</td>
                  <td className="px-3 py-3 text-[13px] font-bold text-orange-500 tabular-nums">{fmt(totalExtra)}</td>
                  <td className="px-3 py-3 text-[13px] font-bold text-emerald-500 tabular-nums">{fmt(totalNormal + totalExtra)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}