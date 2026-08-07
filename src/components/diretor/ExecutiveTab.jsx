import React, { useMemo } from "react";
import {
  Ticket, CheckCircle2, Clock, AlertTriangle, TrendingUp, Shield,
  Timer, RefreshCw, Gauge, Award, Users as UsersIcon, BarChart2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import KpiCard from "./KpiCard";
import ChartCard, { tooltipStyle } from "./ChartCard";
import { fmtHoras, fmtDuracao } from "./useDiretorData";

export default function ExecutiveTab({ data }) {
  const { tickets, entries, escalations, internos, reaberturas, ticketById } = data;

  const abertos = tickets.filter(t => !t.closed_at);
  const emAndamento = abertos.filter(t => t.assigned_to);
  const concluidos = tickets.filter(t => t.closed_at);
  const atrasados = tickets.filter(t => t.sla_breached && !t.closed_at);
  const taxaSLA = tickets.length ? Math.round(((tickets.length - tickets.filter(t => t.sla_breached).length) / tickets.length) * 100) : 100;

  // Tempo médio de resolução
  const tmr = useMemo(() => {
    const f = concluidos.filter(t => t.created_date);
    if (!f.length) return null;
    return f.reduce((a, t) => a + (new Date(t.closed_at) - new Date(t.created_date)), 0) / f.length;
  }, [concluidos]);

  // Tempo médio de atendimento (criação → primeiro apontamento)
  const tma = useMemo(() => {
    const byTicket = {};
    entries.forEach(e => {
      const cur = byTicket[e.ticket_id];
      if (!cur || new Date(e.created_date) < new Date(cur)) byTicket[e.ticket_id] = e.created_date;
    });
    const diffs = Object.entries(byTicket)
      .map(([tid, first]) => {
        const t = ticketById[tid];
        return t ? new Date(first) - new Date(t.created_date) : null;
      })
      .filter(d => d != null && d >= 0);
    if (!diffs.length) return null;
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }, [entries, ticketById]);

  const totalHoras = entries.reduce((a, e) => a + (e.normal_hours || 0) + (e.extra_hours || 0), 0);
  const produtividade = tickets.length ? Math.round((concluidos.length / tickets.length) * 100) : 0;
  const retrabalho = tickets.length ? Math.round((reaberturas.length / tickets.length) * 100) : 0;

  // Horas por colaborador
  const horasPorColab = useMemo(() => {
    const m = {};
    entries.forEach(e => {
      const k = e.technician_name || e.technician_email || "—";
      m[k] = (m[k] || 0) + (e.normal_hours || 0) + (e.extra_hours || 0);
    });
    return Object.entries(m).map(([name, h]) => ({ name: name.split(" ")[0], horas: +h.toFixed(1) }))
      .sort((a, b) => b.horas - a.horas).slice(0, 8);
  }, [entries]);

  // Horas por cliente
  const horasPorCliente = useMemo(() => {
    const m = {};
    entries.forEach(e => {
      const t = ticketById[e.ticket_id];
      const k = t?.client_name || "—";
      m[k] = (m[k] || 0) + (e.normal_hours || 0) + (e.extra_hours || 0);
    });
    return Object.entries(m).map(([name, h]) => ({ name: name.slice(0, 18), horas: +h.toFixed(1) }))
      .sort((a, b) => b.horas - a.horas).slice(0, 8);
  }, [entries, ticketById]);

  // Ranking colaboradores
  const ranking = useMemo(() => internos.map(u => {
    const meus = tickets.filter(t => t.assigned_to === u.email);
    const fechados = meus.filter(t => t.closed_at).length;
    const breached = meus.filter(t => t.sla_breached).length;
    const horas = entries.filter(e => e.technician_email === u.email)
      .reduce((a, e) => a + (e.normal_hours || 0) + (e.extra_hours || 0), 0);
    const score = meus.length
      ? Math.max(0, Math.round((fechados / meus.length) * 100 - (breached / meus.length) * 30))
      : null;
    return { ...u, total: meus.length, fechados, horas, score };
  }).filter(u => u.total > 0 || u.horas > 0).sort((a, b) => (b.score || 0) - (a.score || 0)), [internos, tickets, entries]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiCard label="Tickets Abertos" value={abertos.length} icon={Ticket} color="#8b5cf6" sub={`${emAndamento.length} em andamento`} />
        <KpiCard label="Concluídos" value={concluidos.length} icon={CheckCircle2} color="#22c55e" sub={`${produtividade}% do período`} />
        <KpiCard label="Atrasados (SLA)" value={atrasados.length} icon={AlertTriangle} color={atrasados.length ? "#ef4444" : "#22c55e"} sub="Abertos com SLA violado" />
        <KpiCard label="Escalonados" value={escalations.length} icon={TrendingUp} color="#f97316" sub="No período filtrado" />
        <KpiCard label="SLA Cumprido" value={`${taxaSLA}%`} icon={Shield} color={taxaSLA >= 80 ? "#22c55e" : "#ef4444"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiCard label="Tempo Médio de Atendimento" value={fmtDuracao(tma)} icon={Timer} color="#06b6d4" sub="Criação → 1º apontamento" />
        <KpiCard label="Tempo Médio de Resolução" value={fmtDuracao(tmr)} icon={Clock} color="#f59e0b" sub="Criação → encerramento" />
        <KpiCard label="Horas Trabalhadas" value={fmtHoras(totalHoras)} icon={Gauge} color="#8b5cf6" sub={`${entries.length} apontamentos`} />
        <KpiCard label="Índice de Retrabalho" value={`${retrabalho}%`} icon={RefreshCw} color={retrabalho > 10 ? "#ef4444" : "#22c55e"} sub={`${reaberturas.length} reaberturas`} />
        <KpiCard label="Produtividade da Equipe" value={`${produtividade}%`} icon={Award} color="#22c55e" sub="Concluídos / total" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard icon={UsersIcon} title="Horas por Colaborador" subtitle="Top 8 no período">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={horasPorColab}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard icon={BarChart2} title="Horas por Cliente" subtitle="Top 8 no período">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={horasPorCliente} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="horas" fill="#06b6d4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard icon={Award} title="Ranking dos Colaboradores" subtitle="Score = taxa de conclusão penalizada por violações de SLA">
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado no período</p>
        ) : (
          <div className="space-y-2">
            {ranking.map((u, idx) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{ background: idx === 0 ? "#f59e0b22" : "hsl(var(--muted))", color: idx === 0 ? "#f59e0b" : "hsl(var(--muted-foreground))" }}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{u.full_name || u.email}</div>
                  <div className="text-[11px] text-muted-foreground">{u.cargo || "Analista"}{u.vertical ? ` · ${u.vertical}` : ""}</div>
                </div>
                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                  <div className="text-center"><div className="font-semibold text-foreground">{u.total}</div><div className="text-muted-foreground">tickets</div></div>
                  <div className="text-center"><div className="font-semibold text-emerald-500">{u.fechados}</div><div className="text-muted-foreground">fechados</div></div>
                  <div className="text-center"><div className="font-semibold text-foreground">{fmtHoras(u.horas)}</div><div className="text-muted-foreground">horas</div></div>
                  {u.score !== null && (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2"
                      style={{
                        borderColor: u.score >= 75 ? "#22c55e" : u.score >= 50 ? "#f59e0b" : "#ef4444",
                        color: u.score >= 75 ? "#22c55e" : u.score >= 50 ? "#f59e0b" : "#ef4444",
                      }}>
                      {u.score}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}