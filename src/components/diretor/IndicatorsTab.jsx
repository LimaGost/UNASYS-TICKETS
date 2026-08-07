import React, { useMemo } from "react";
import { Activity, TrendingUp, Building2, PieChart as PieIcon, Clock, RefreshCw, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import ChartCard, { tooltipStyle } from "./ChartCard";
import { MOTIVO_LABELS } from "./useDiretorData";

const URGENCY_COLORS = { baixa: "#22c55e", media: "#f59e0b", alta: "#f97316", critica: "#ef4444" };
const URGENCY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#22c55e", "#ef4444", "#f97316", "#94a3b8"];

export default function IndicatorsTab({ data }) {
  const { tickets, allTickets, allEscalations, escalations, entries, reaberturas, ticketById } = data;

  // Evolução mensal (últimos 6 meses)
  const mensal = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" });
      const monthTickets = allTickets.filter(t => (t.created_date || "").startsWith(key));
      const esc = allEscalations.filter(e => (e.created_date || "").startsWith(key)).length;
      const breached = monthTickets.filter(t => t.sla_breached).length;
      const sla = monthTickets.length ? Math.round(((monthTickets.length - breached) / monthTickets.length) * 100) : 100;
      months.push({ label, Tickets: monthTickets.length, Escalonamentos: esc, "SLA %": sla });
    }
    return months;
  }, [allTickets, allEscalations]);

  const topClientes = useMemo(() => {
    const m = {};
    tickets.forEach(t => { const k = t.client_name || "—"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([name, total]) => ({ name: name.slice(0, 20), total }))
      .sort((a, b) => b.total - a.total).slice(0, 8);
  }, [tickets]);

  const topProjetosHoras = useMemo(() => {
    const m = {};
    entries.forEach(e => {
      const t = ticketById[e.ticket_id];
      if (!t) return;
      const k = `#${t.ticket_number || ""} ${t.client_name || t.title}`.trim().slice(0, 22);
      m[k] = (m[k] || 0) + (e.normal_hours || 0) + (e.extra_hours || 0);
    });
    return Object.entries(m).map(([name, h]) => ({ name, horas: +h.toFixed(1) }))
      .sort((a, b) => b.horas - a.horas).slice(0, 8);
  }, [entries, ticketById]);

  const motivosEsc = useMemo(() => {
    const m = {};
    escalations.forEach(e => { const k = MOTIVO_LABELS[e.motivo_categoria] || "Outro"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [escalations]);

  const porUrgencia = useMemo(() => {
    const m = { baixa: 0, media: 0, alta: 0, critica: 0 };
    tickets.forEach(t => { if (m[t.urgency] !== undefined) m[t.urgency]++; });
    return Object.entries(m).map(([k, v]) => ({ name: URGENCY_LABELS[k], value: v, color: URGENCY_COLORS[k] }));
  }, [tickets]);

  const porCategoria = useMemo(() => {
    const m = {};
    tickets.forEach(t => { const k = t.category || t.ticket_type || "Sem categoria"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name: name.slice(0, 18), value }))
      .sort((a, b) => b.value - a.value).slice(0, 7);
  }, [tickets]);

  const tempoPorTipo = useMemo(() => {
    const m = {};
    tickets.filter(t => t.closed_at).forEach(t => {
      const k = t.ticket_type || (t.main_type === "suporte" ? "Suporte" : "Implantação");
      if (!m[k]) m[k] = { sum: 0, n: 0 };
      m[k].sum += new Date(t.closed_at) - new Date(t.created_date);
      m[k].n++;
    });
    return Object.entries(m).map(([name, { sum, n }]) => ({ name: name.slice(0, 18), horas: +((sum / n) / 3.6e6).toFixed(1) }))
      .sort((a, b) => b.horas - a.horas);
  }, [tickets]);

  const retrabPorColab = useMemo(() => {
    const m = {};
    reaberturas.forEach(e => {
      const t = ticketById[e.ticket_id];
      const k = (t?.assigned_to_name || t?.assigned_to || "—").split(" ")[0];
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [reaberturas, ticketById]);

  const BarH = ({ dados, dataKey = "total", cor = "hsl(var(--primary))" }) => (
    dados.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">Sem dados no período</p> :
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={dados} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={130} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={dataKey} fill={cor} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const PieG = ({ dados }) => (
    dados.length === 0 || dados.every(d => !d.value) ? <p className="text-xs text-muted-foreground text-center py-6">Sem dados no período</p> :
    <>
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie data={dados} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
            {dados.map((e, i) => <Cell key={i} fill={e.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 justify-center mt-1">
        {dados.map((item, i) => (
          <span key={item.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: item.color || PIE_COLORS[i % PIE_COLORS.length] }} />
            {item.name}: <strong className="text-foreground">{item.value}</strong>
          </span>
        ))}
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <ChartCard icon={Activity} title="Evolução Mensal" subtitle="Tickets, escalonamentos e SLA — últimos 6 meses">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mensal}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Tickets" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Escalonamentos" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="SLA %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard icon={Building2} title="Clientes com Maior Volume" subtitle="Top 8 por chamados">
          <BarH dados={topClientes} cor="#06b6d4" />
        </ChartCard>
        <ChartCard icon={Clock} title="Projetos com Maior Consumo de Horas" subtitle="Top 8">
          <BarH dados={topProjetosHoras} dataKey="horas" cor="#f97316" />
        </ChartCard>
        <ChartCard icon={TrendingUp} title="Motivos de Escalonamento" subtitle="Mais frequentes no período">
          <PieG dados={motivosEsc} />
        </ChartCard>
        <ChartCard icon={PieIcon} title="Distribuição por Prioridade" subtitle="No período">
          <PieG dados={porUrgencia} />
        </ChartCard>
        <ChartCard icon={PieIcon} title="Distribuição por Categoria" subtitle="Tipos de incidentes recorrentes">
          <PieG dados={porCategoria} />
        </ChartCard>
        <ChartCard icon={Clock} title="Tempo Médio por Tipo de Ticket" subtitle="Horas até resolução">
          <BarH dados={tempoPorTipo} dataKey="horas" cor="#f59e0b" />
        </ChartCard>
        <ChartCard icon={RefreshCw} title="Retrabalho por Colaborador" subtitle="Reaberturas no período">
          <BarH dados={retrabPorColab} cor="#ef4444" />
        </ChartCard>
        <ChartCard icon={Shield} title="Evolução do SLA" subtitle="% de cumprimento mensal">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mensal}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="SLA %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}