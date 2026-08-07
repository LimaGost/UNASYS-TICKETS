import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, Area, ComposedChart, PieChart, Pie, LabelList
} from "recharts";
import {
  Ticket, Clock, AlertTriangle, CheckCircle2, TrendingUp,
  Activity, Timer, ArrowUpRight, ArrowDownRight, Minus,
  RefreshCw, Zap, BarChart2, Users2, Target, Layers
} from "lucide-react";
import moment from "moment";
import { useVerticalFilter } from "@/hooks/useVerticalFilter";

// ── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  "#7C3AED","#3B82F6","#10B981","#F97316",
  "#EC4899","#F59E0B","#06B6D4","#8B5CF6","#EF4444","#14B8A6"
];
const URGENCY_COLORS = { critica:"#EF4444", alta:"#F97316", media:"#F59E0B", baixa:"#10B981" };

const TT = {
  backgroundColor:"hsl(var(--card))",
  border:"1px solid hsl(var(--border))",
  borderRadius:8,
  color:"hsl(var(--foreground))",
  fontSize:11,
  padding:"8px 12px",
  boxShadow:"0 4px 16px rgba(0,0,0,0.12)",
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, color, delta, icon: Icon, progress }) {
  const isUp = delta > 0, isDown = delta < 0;
  return (
    <div
      className="relative flex flex-col gap-3 rounded-xl p-4 overflow-hidden transition-all duration-200 hover:shadow-md cursor-default"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      {/* colored top stripe */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: color }} />

      <div className="flex items-start justify-between gap-2 pt-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}
        >
          {Icon && <Icon className="w-4 h-4" style={{ color }} />}
        </div>
        {delta !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              isUp ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950"
              : isDown ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950"
              : "text-muted-foreground bg-muted"
            }`}
          >
            {isUp ? <ArrowUpRight className="w-3 h-3"/> : isDown ? <ArrowDownRight className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      <div>
        <p className="text-[28px] font-black leading-none tracking-tight text-foreground tabular-nums">{value}</p>
        <p className="text-[11px] font-medium text-muted-foreground mt-1">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>

      {progress !== undefined && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-1 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(progress, 100)}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, icon: Icon, color = "#8B5CF6" }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-7">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
      </div>
      <span className="text-[13px] font-bold text-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({ title, sub, accent = "#8B5CF6", children, extra, className = "" }) {
  return (
    <div
      className={`rounded-xl flex flex-col overflow-hidden ${className}`}
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      <div className="flex items-start justify-between px-5 py-4 gap-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-[3px] h-5 rounded-full flex-shrink-0" style={{ background: accent }} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">{title}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </div>
        </div>
        {extra && <div className="text-[10px] text-muted-foreground flex-shrink-0">{extra}</div>}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}

// ── List card (flush) ─────────────────────────────────────────────────────────
function ListCard({ title, sub, accent = "#8B5CF6", children }) {
  return (
    <div
      className="rounded-xl flex flex-col overflow-hidden"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="w-[3px] h-5 rounded-full flex-shrink-0" style={{ background: accent }} />
        <div>
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-auto divide-y divide-border">{children}</div>
    </div>
  );
}

// ── Row item ─────────────────────────────────────────────────────────────────
function RowItem({ label, value, pct, color }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <p className="flex-1 text-[12px] text-foreground truncate">{label}</p>
      <div className="w-20 h-1.5 rounded-full flex-shrink-0 bg-muted overflow-hidden">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-[12px] font-bold text-foreground w-7 text-right flex-shrink-0 tabular-nums">{value}</p>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyChart({ h = 180 }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/40" style={{ height: h }}>
      <Activity className="w-7 h-7" />
      <p className="text-[11px]">Sem dados no período</p>
    </div>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────
function FilterPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors duration-150 cursor-pointer"
      style={active
        ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
        : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }
      }
    >{children}</button>
  );
}

// ── Legend dot ────────────────────────────────────────────────────────────────
function LegendItem({ color, label, shape = "rect" }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      {shape === "line"
        ? <span className="w-4 h-[2px] rounded inline-block flex-shrink-0" style={{ background: color }} />
        : <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
      }
      {label}
    </span>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { userVertical } = useVerticalFilter();
  const [selVertical, setSelVertical] = useState("");
  const [timeRange, setTimeRange] = useState("30");

  const { data: allTickets = [], refetch, isFetching } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.entities.Ticket.list(),
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries"],
    queryFn: () => api.entities.TimeEntry.list(),
  });
  const { data: allVerticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });
  const { data: kanbanConfigs = [] } = useQuery({
    queryKey: ["kanbanConfigs"],
    queryFn: () => api.entities.KanbanConfig.list(),
  });

  const tickets   = userVertical ? allTickets.filter(t => t.vertical === userVertical) : allTickets;
  const verticals = userVertical ? allVerticals.filter(v => v.code === userVertical) : allVerticals;

  useEffect(() => {
    if (!selVertical) setSelVertical(userVertical || "all");
  }, [userVertical, selVertical]);

  const filtered = useMemo(() =>
    (selVertical === "all" || !selVertical) ? tickets : tickets.filter(t => t.vertical === selVertical),
    [tickets, selVertical]);

  const rangeTickets = useMemo(() => {
    const cut = moment().subtract(parseInt(timeRange), "days");
    return filtered.filter(t => moment(t.created_date).isAfter(cut));
  }, [filtered, timeRange]);

  const filteredTE = useMemo(() => {
    // Sem filtro de vertical: soma TODOS os apontamentos, inclusive os de
    // tickets já excluídos (antes eram descartados e as horas sumiam da soma)
    const noVerticalFilter = !userVertical && (selVertical === "all" || !selVertical);
    if (noVerticalFilter) return timeEntries;
    const ids = new Set(filtered.map(t => t.id));
    return timeEntries.filter(e => ids.has(e.ticket_id));
  }, [timeEntries, filtered, selVertical, userVertical]);

  const rangeTE = useMemo(() => {
    const cut = moment().subtract(parseInt(timeRange), "days");
    return filteredTE.filter(e => moment(e.date || e.created_date).isAfter(cut));
  }, [filteredTE, timeRange]);

  const finals = useMemo(() => {
    const s = new Set();
    kanbanConfigs.forEach(c => c.columns?.forEach(col => { if (col.is_final) s.add(col.title); }));
    return s;
  }, [kanbanConfigs]);

  // Metrics
  const M = useMemo(() => {
    const open    = filtered.filter(t => !finals.has(t.status_column_title));
    const closed  = filtered.filter(t =>  finals.has(t.status_column_title));
    const overdue = open.filter(t => t.sla_breached);
    const urgent  = open.filter(t => ["critica","alta"].includes(t.urgency));
    const totalH  = filteredTE.reduce((s,e) => s + (e.normal_hours||0) + (e.extra_hours||0), 0);
    const billH   = filteredTE.filter(e => e.hour_type !== "interna").reduce((s,e) => s + (e.normal_hours||0), 0);
    const internH = totalH - billH;
    const resolved = closed.filter(t => t.closed_at && t.created_date);
    const avgRes   = resolved.length
      ? resolved.reduce((s,t) => s + Math.max(0, (new Date(t.closed_at) - new Date(t.created_date)) / 3600000), 0) / resolved.length
      : 0;
    const sla = closed.length ? Math.round((closed.filter(t => !t.sla_breached).length / closed.length) * 100) : 0;
    return {
      total: filtered.length, open: open.length, closed: closed.length,
      overdue: overdue.length, urgent: urgent.length,
      totalH: +totalH.toFixed(1), billH: +billH.toFixed(1), internH: +internH.toFixed(1),
      avgRes: +avgRes.toFixed(1), sla,
    };
  }, [filtered, filteredTE, finals]);

  // Charts data
  const combinedTimeline = useMemo(() => {
    const tM = {}, hM = {};
    rangeTickets.forEach(t => { const d = moment(t.created_date).format("DD/MM"); tM[d] = (tM[d]||0)+1; });
    rangeTE.forEach(e => { const d = moment(e.date||e.created_date).format("DD/MM"); hM[d] = (hM[d]||0)+(e.normal_hours||0)+(e.extra_hours||0); });
    const days = parseInt(timeRange), step = days > 30 ? 3 : 1, res = [];
    for (let i = days-1; i >= 0; i -= step) {
      const d = moment().subtract(i,"days").format("DD/MM");
      res.push({ date: d, tickets: tM[d]||0, horas: +((hM[d]||0).toFixed(1)) });
    }
    return res;
  }, [rangeTickets, rangeTE, timeRange]);

  const byCategory = useMemo(() => {
    const c = {};
    filtered.forEach(t => { const k = t.category || t.ticket_type || "Sem Categoria"; c[k] = (c[k]||0)+1; });
    return Object.entries(c).map(([n,v])=>({name:n,value:v})).sort((a,b)=>b.value-a.value).slice(0,7);
  }, [filtered]);

  const byUrgency = useMemo(() => {
    const ORDER = { critica:0,alta:1,media:2,baixa:3 };
    const c = {};
    filtered.forEach(t => { const u = t.urgency||"media"; c[u]=(c[u]||0)+1; });
    return Object.entries(c)
      .map(([k,v])=>({ key:k, name:k.charAt(0).toUpperCase()+k.slice(1), value:v, fill:URGENCY_COLORS[k]||"#666" }))
      .sort((a,b)=>ORDER[a.key]-ORDER[b.key]);
  }, [filtered]);

  const byStatus = useMemo(() => {
    const c = {};
    filtered.forEach(t => { const s = t.status_column_title||"Sem Status"; c[s]=(c[s]||0)+1; });
    return Object.entries(c).map(([n,v])=>({name:n,value:v})).sort((a,b)=>b.value-a.value).slice(0,8);
  }, [filtered]);

  const byVertical = useMemo(() => {
    const c = {};
    filtered.forEach(t => { const n = verticals.find(v=>v.code===t.vertical)?.name||t.vertical||"—"; c[n]=(c[n]||0)+1; });
    return Object.entries(c).map(([n,v])=>({name:n,value:v})).sort((a,b)=>b.value-a.value);
  }, [filtered, verticals]);

  const byTechnician = useMemo(() => {
    const c = {};
    filteredTE.forEach(e => { const n = e.technician_name||e.technician_email||"N/A"; c[n]=(c[n]||0)+(e.normal_hours||0)+(e.extra_hours||0); });
    return Object.entries(c).map(([n,v])=>({name:n.split(" ")[0], full:n, value:+v.toFixed(1)})).sort((a,b)=>b.value-a.value).slice(0,8);
  }, [filteredTE]);

  const techHoursStacked = useMemo(() => {
    const m = {};
    filteredTE.forEach(e => {
      const n = e.technician_name || e.technician_email || "N/A";
      if (!m[n]) m[n] = { name: n.split(" ")[0], full: n, normal: 0, extra: 0, interna: 0 };
      if (e.hour_type === "interna") m[n].interna += e.normal_hours || 0;
      else m[n].normal += e.normal_hours || 0;
      m[n].extra += e.extra_hours || 0;
    });
    return Object.values(m).map(r => ({ ...r, normal: +r.normal.toFixed(1), extra: +r.extra.toFixed(1), interna: +r.interna.toFixed(1) }))
      .sort((a, b) => (b.normal + b.extra + b.interna) - (a.normal + a.extra + a.interna)).slice(0, 8);
  }, [filteredTE]);

  const openByVertical = useMemo(() => {
    const open = filtered.filter(t => !finals.has(t.status_column_title));
    const c = {};
    open.forEach(t => { const n = verticals.find(v => v.code === t.vertical)?.name || t.vertical || "—"; c[n] = (c[n] || 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name, value, pct: open.length > 0 ? Math.round((value / open.length) * 100) : 0 })).sort((a, b) => b.value - a.value);
  }, [filtered, finals, verticals]);

  const analystProductivity = useMemo(() => {
    const m = {};
    filtered.forEach(t => {
      const key = t.assigned_to || "__none__";
      const name = (t.assigned_to_name || t.assigned_to || "N/A").split(" ")[0];
      if (!m[key]) m[key] = { name, full: t.assigned_to_name || t.assigned_to || "N/A", tickets: 0, resolvidos: 0, horas: 0 };
      m[key].tickets++;
      if (finals.has(t.status_column_title)) m[key].resolvidos++;
    });
    filteredTE.forEach(e => {
      const key = e.technician_email || "__none__";
      if (!m[key]) m[key] = { name: (e.technician_name || e.technician_email || "N/A").split(" ")[0], full: e.technician_name || e.technician_email || "N/A", tickets: 0, resolvidos: 0, horas: 0 };
      m[key].horas += (e.normal_hours || 0) + (e.extra_hours || 0);
    });
    return Object.values(m).filter(r => r.tickets > 0 || r.horas > 0)
      .map(r => ({ ...r, horas: +r.horas.toFixed(1), eficiencia: r.tickets > 0 ? Math.round((r.resolvidos / r.tickets) * 100) : 0 }))
      .sort((a, b) => b.resolvidos - a.resolvidos).slice(0, 10);
  }, [filtered, filteredTE, finals]);

  const byHourType = useMemo(() => {
    const n  = filteredTE.filter(e=>e.hour_type!=="interna").reduce((s,e)=>s+(e.normal_hours||0),0);
    const ex = filteredTE.reduce((s,e)=>s+(e.extra_hours||0),0);
    const i  = filteredTE.filter(e=>e.hour_type==="interna").reduce((s,e)=>s+(e.normal_hours||0),0);
    return [
      {name:"Normal", value:+n.toFixed(1),  fill:"#7C3AED"},
      {name:"Extra",  value:+ex.toFixed(1), fill:"#F97316"},
      {name:"Interna",value:+i.toFixed(1),  fill:"#EC4899"},
    ].filter(d=>d.value>0);
  }, [filteredTE]);

  const slaColor = M.sla >= 80 ? "#10B981" : M.sla >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div className="pb-10 max-w-[1400px]">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <BarChart2 className="w-4 h-4 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Relatório Operacional</span>
          </div>
          <h1 className="text-[22px] font-black text-foreground tracking-tight">Dashboard e Análises</h1>
          <p className="text-[12px] mt-1 text-muted-foreground">
            Atualizado {moment().format("DD/MM/YYYY [às] HH:mm")}
            <span className="mx-2 opacity-40">·</span>
            <span className="text-primary font-semibold">{filtered.length}</span> tickets no escopo
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!userVertical && (
            <Select value={selVertical} onValueChange={setSelVertical}>
              <SelectTrigger className="h-8 text-[11px] font-semibold rounded-lg w-[145px] cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas Verticais</SelectItem>
                {verticals.filter(v=>v.active).map(v=>(
                  <SelectItem key={v.id} value={v.code} className="text-xs">{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1 p-1 rounded-lg bg-muted border border-border">
            {[["7","7d"],["30","30d"],["90","90d"]].map(([v,l])=>(
              <FilterPill key={v} active={timeRange===v} onClick={()=>setTimeRange(v)}>{l}</FilterPill>
            ))}
          </div>
          <button
            onClick={()=>refetch()}
            aria-label="Atualizar dados"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 border border-border bg-muted hover:bg-accent cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isFetching?"animate-spin":""}`}/>
          </button>
        </div>
      </div>

      {/* ── KPI TICKETS ─────────────────────────────────────────────────── */}
      <SectionHeader label="Tickets" icon={Ticket} color="#7C3AED" />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard title="Total"          value={M.total}           color="#8B5CF6" icon={Layers} sub="acumulado" />
        <KpiCard title="Em Aberto"      value={M.open}            color="#3B82F6" icon={Activity} sub={`${M.total>0?Math.round(M.open/M.total*100):0}% do total`} progress={M.total>0?Math.round(M.open/M.total*100):0} />
        <KpiCard title="Concluídos"     value={M.closed}          color="#10B981" icon={CheckCircle2} sub={`${M.total>0?Math.round(M.closed/M.total*100):0}% do total`} progress={M.total>0?Math.round(M.closed/M.total*100):0} />
        <KpiCard title="Conformidade SLA" value={`${M.sla}%`}    color={slaColor} icon={Target} sub="tickets no prazo" progress={M.sla} />
        <KpiCard title="Atrasados"      value={M.overdue}         color="#EF4444" icon={AlertTriangle} sub="SLA violado" />
        <KpiCard title="Alta Urgência"  value={M.urgent}          color="#F97316" icon={Zap} sub="crítica + alta" />
      </div>

      {/* ── KPI HORAS ───────────────────────────────────────────────────── */}
      <SectionHeader label="Horas Trabalhadas" icon={Clock} color="#7C3AED" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total de Horas"  value={`${M.totalH}h`}  color="#7C3AED" icon={Timer} sub="todas as entradas" />
        <KpiCard title="Cobráveis"       value={`${M.billH}h`}   color="#8B5CF6" icon={TrendingUp} sub={`${M.totalH>0?Math.round(M.billH/M.totalH*100):0}% do total`} progress={M.totalH>0?Math.round(M.billH/M.totalH*100):0} />
        <KpiCard title="Internas"        value={`${M.internH}h`} color="#EC4899" icon={Users2} sub="não cobradas" />
        <KpiCard title="Tempo Médio"     value={`${M.avgRes}h`}  color="#F59E0B" icon={Clock} sub="por resolução" />
      </div>

      {/* ── EVOLUÇÃO TEMPORAL ───────────────────────────────────────────── */}
      <SectionHeader label="Evolução Temporal" icon={TrendingUp} color="#8B5CF6" />
      <ChartCard
        title="Visão Geral do Período"
        sub={`Últimos ${timeRange} dias — tickets criados × horas trabalhadas`}
        accent="#8B5CF6"
        extra={
          <div className="flex items-center gap-3">
            <LegendItem color="#8B5CF6" label="Tickets" shape="line" />
            <LegendItem color="#F97316" label="Horas" />
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={combinedTimeline} margin={{top:4,right:8,bottom:0,left:-12}}>
            <defs>
              <linearGradient id="gTickets" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25}/>
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="transparent" tick={{fill:"hsl(var(--muted-foreground))",fontSize:10}} tickLine={false} />
            <YAxis yAxisId="l" stroke="transparent" tick={{fill:"hsl(var(--muted-foreground))",fontSize:10}} tickLine={false} width={22} />
            <YAxis yAxisId="r" orientation="right" stroke="transparent" tick={{fill:"hsl(var(--muted-foreground))",fontSize:10}} tickLine={false} width={22} />
            <Tooltip contentStyle={TT} />
            <Area yAxisId="l" type="monotone" dataKey="tickets" stroke="#8B5CF6" strokeWidth={2} fill="url(#gTickets)" name="Tickets" dot={false} activeDot={{r:4, fill:"#A855F7"}} />
            <Bar yAxisId="r" dataKey="horas" fill="#F97316" fillOpacity={0.65} name="Horas" radius={[3,3,0,0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── DISTRIBUIÇÃO ────────────────────────────────────────────────── */}
      <SectionHeader label="Distribuição" icon={BarChart2} color="#7C3AED" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        <div className="lg:col-span-2">
          <ChartCard title="Tickets por Categoria" accent="#7C3AED" className="h-full">
            {byCategory.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={215}>
                <BarChart data={byCategory} layout="vertical" margin={{left:0,right:20,top:4,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="transparent" tick={{fill:"hsl(var(--muted-foreground))",fontSize:10}} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="transparent" tick={{fill:"hsl(var(--foreground))",fontSize:11}} width={120} tickLine={false} />
                  <Tooltip contentStyle={TT} />
                  <Bar dataKey="value" name="Tickets" radius={[0,4,4,0]} maxBarSize={18}>
                    {byCategory.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]} />)}
                    <LabelList dataKey="value" position="right" style={{fill:"hsl(var(--muted-foreground))", fontSize:10, fontWeight:600}} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ListCard title="Urgência" sub="distribuição por criticidade" accent="#EF4444">
          {byUrgency.length === 0 ? <EmptyChart /> : (
            <>
              {byUrgency.map((d,i)=>(
                <RowItem key={i} label={d.name} value={d.value} pct={M.total>0?(d.value/M.total)*100:0} color={d.fill} />
              ))}
              <div className="p-4">
                <ResponsiveContainer width="100%" height={70}>
                  <BarChart data={byUrgency} margin={{top:0,right:4,left:-16,bottom:0}}>
                    <XAxis dataKey="name" stroke="transparent" tick={{fill:"hsl(var(--muted-foreground))",fontSize:9}} tickLine={false} />
                    <Tooltip contentStyle={TT} />
                    <Bar dataKey="value" radius={[3,3,0,0]} name="Tickets" maxBarSize={32}>
                      {byUrgency.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </ListCard>
      </div>

      {/* ── HORAS & STATUS ──────────────────────────────────────────────── */}
      <SectionHeader label="Horas & Status" icon={Timer} color="#7C3AED" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        <div className="lg:col-span-2">
          <ChartCard title="Horas por Técnico" accent="#7C3AED" className="h-full">
            {byTechnician.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={215}>
                <BarChart data={byTechnician} margin={{top:4,right:8,left:-16,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="transparent" tick={{fill:"hsl(var(--muted-foreground))",fontSize:10}} tickLine={false} />
                  <YAxis stroke="transparent" tick={{fill:"hsl(var(--muted-foreground))",fontSize:10}} tickLine={false} width={28} />
                  <Tooltip contentStyle={TT} formatter={v=>[`${v}h`,"Horas"]} labelFormatter={(_,p)=>p[0]?.payload?.full||""} />
                  <Bar dataKey="value" name="Horas" radius={[4,4,0,0]} maxBarSize={36}>
                    {byTechnician.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Tipo de Hora" accent="#EC4899" className="h-full">
          {byHourType.length === 0 ? <EmptyChart /> : (
            <div className="flex flex-col gap-3">
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie data={byHourType} cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={4} dataKey="value">
                    {byHourType.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                  </Pie>
                  <Tooltip contentStyle={TT} formatter={v=>[`${v}h`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="divide-y divide-border">
                {byHourType.map((d,i)=>(
                  <div key={i} className="flex items-center gap-2.5 py-2.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background:d.fill}}/>
                    <span className="flex-1 text-[12px] text-foreground">{d.name}</span>
                    <span className="text-[12px] font-bold text-foreground tabular-nums">{d.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── TICKETS ABERTOS POR SETOR ────────────────────────────────────── */}
      <SectionHeader label="Tickets Abertos por Setor" icon={Activity} color="#F97316" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Implantações em Aberto por Setor"
            sub={`${M.open} tickets em andamento · distribuição por segmento`}
            accent="#F97316"
          >
            {openByVertical.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={Math.max(openByVertical.length * 40, 140)}>
                <BarChart data={openByVertical} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="transparent" tick={{ fill:"hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill:"hsl(var(--foreground))", fontSize: 11 }} width={120} tickLine={false} />
                  <Tooltip contentStyle={TT} formatter={v => [v, "Em Aberto"]} />
                  <Bar dataKey="value" name="Em Aberto" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {openByVertical.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    <LabelList dataKey="value" position="right" style={{ fill:"hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ListCard title="Distribuição % por Setor" sub="tickets em aberto" accent="#F97316">
          {openByVertical.length === 0 ? <EmptyChart /> :
            openByVertical.map((v, i) => (
              <RowItem key={i} label={v.name} value={v.value} pct={v.pct} color={PALETTE[i % PALETTE.length]} />
            ))
          }
        </ListCard>
      </div>

      {/* ── PRODUTIVIDADE POR ANALISTA ───────────────────────────────────── */}
      <SectionHeader label="Produtividade por Analista" icon={Users2} color="#7C3AED" />
      <ChartCard
        title="Tickets Resolvidos × Horas Trabalhadas"
        sub="por analista responsável · eixo esquerdo = tickets · eixo direito = horas"
        accent="#7C3AED"
        extra={
          <div className="flex items-center gap-3">
            <LegendItem color="#10B981" label="Resolvidos" />
            <LegendItem color="#3B82F6" label="Atribuídos" />
            <LegendItem color="#7C3AED" label="Horas" shape="line" />
          </div>
        }
      >
        {analystProductivity.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={225}>
            <ComposedChart data={analystProductivity} margin={{ top: 4, right: 30, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="transparent" tick={{ fill:"hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
              <YAxis yAxisId="l" stroke="transparent" tick={{ fill:"hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} width={26} />
              <YAxis yAxisId="r" orientation="right" stroke="transparent" tick={{ fill:"hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} width={26} />
              <Tooltip contentStyle={TT} labelFormatter={(_, p) => p[0]?.payload?.full || ""} />
              <Bar yAxisId="l" dataKey="tickets" name="Atribuídos" fill="#3B82F6" fillOpacity={0.5} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar yAxisId="l" dataKey="resolvidos" name="Resolvidos" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Area yAxisId="r" type="monotone" dataKey="horas" name="Horas" stroke="#7C3AED" strokeWidth={2} fill="rgba(124,58,237,0.1)" dot={{ r: 3, fill: "#A855F7" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── HORAS EMPILHADAS ─────────────────────────────────────────────── */}
      <div className="mt-3">
        <ChartCard
          title="Horas por Técnico — Normal · Extra · Interna"
          sub="composição detalhada do tempo trabalhado por analista"
          accent="#8B5CF6"
          extra={
            <div className="flex items-center gap-3">
              <LegendItem color="#7C3AED" label="Normal" />
              <LegendItem color="#F97316" label="Extra" />
              <LegendItem color="#EC4899" label="Interna" />
            </div>
          }
        >
          {techHoursStacked.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={215}>
              <BarChart data={techHoursStacked} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="transparent" tick={{ fill:"hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                <YAxis stroke="transparent" tick={{ fill:"hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} width={28} />
                <Tooltip contentStyle={TT} formatter={(v, n) => [`${v}h`, n]} labelFormatter={(_, p) => p[0]?.payload?.full || ""} />
                <Bar dataKey="normal" name="Normal" stackId="a" fill="#7C3AED" maxBarSize={36} />
                <Bar dataKey="extra" name="Extra" stackId="a" fill="#F97316" maxBarSize={36} />
                <Bar dataKey="interna" name="Interna" stackId="a" fill="#EC4899" radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── STATUS & VERTICAL ───────────────────────────────────────────── */}
      <SectionHeader label="Status & Vertical" icon={BarChart2} color="#10B981" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ListCard title="Status Kanban" sub="tickets por coluna do quadro" accent="#10B981">
          {byStatus.length === 0 ? <EmptyChart /> :
            byStatus.map((s,i)=>(
              <RowItem key={i} label={s.name} value={s.value} pct={M.total>0?(s.value/M.total)*100:0} color={PALETTE[i%PALETTE.length]} />
            ))
          }
        </ListCard>

        <ListCard title="Distribuição por Vertical" sub="tickets por segmento" accent="#F97316">
          {byVertical.length === 0 ? <EmptyChart /> :
            byVertical.map((v,i)=>(
              <RowItem key={i} label={v.name} value={v.value} pct={M.total>0?(v.value/M.total)*100:0} color={PALETTE[i%PALETTE.length]} />
            ))
          }
        </ListCard>
      </div>

      {/* ── RESUMO DE PERFORMANCE ───────────────────────────────────────── */}
      <SectionHeader label="Resumo de Performance" icon={Target} color="#8B5CF6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"Tempo Médio de Resolução", value:`${M.avgRes}h`,  color:"#8B5CF6", icon: Clock },
          { label:"Tickets Resolvidos",        value: M.closed,       color:"#10B981", icon: CheckCircle2 },
          { label:"Tickets Vencidos",          value: M.overdue,      color:"#EF4444", icon: AlertTriangle },
          { label:"Conformidade SLA",          value:`${M.sla}%`,     color: slaColor, icon: Target },
        ].map((item,i)=>{
          const Icon = item.icon;
          return (
            <div key={i} className="rounded-xl px-5 py-4 flex items-center gap-4 bg-card border border-border">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}15` }}>
                <Icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-[24px] font-black leading-none tabular-nums" style={{color:item.color}}>{item.value}</p>
                <p className="text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}