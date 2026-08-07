import React, { useMemo } from "react";
import { Clock, Users, Building2, Briefcase, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import KpiCard from "./KpiCard";
import ChartCard, { tooltipStyle } from "./ChartCard";
import { fmtHoras } from "./useDiretorData";

export default function HoursTab({ data }) {
  const { tickets, entries, allEntries, ticketById } = data;

  const horasExecutadas = entries.reduce((a, e) => a + (e.normal_hours || 0) + (e.extra_hours || 0), 0);
  const horasFaturaveis = entries.filter(e => e.hour_type !== "interna")
    .reduce((a, e) => a + (e.normal_hours || 0) + (e.extra_hours || 0), 0);
  const horasImprodutivas = horasExecutadas - horasFaturaveis;
  const horasPrevistas = tickets.reduce((a, t) => a + (t.contracted_hours || 0), 0);
  const horasExcedentes = Math.max(0, horasExecutadas - horasPrevistas);

  const agrupar = (keyFn) => {
    const m = {};
    entries.forEach(e => {
      const k = keyFn(e) || "—";
      m[k] = (m[k] || 0) + (e.normal_hours || 0) + (e.extra_hours || 0);
    });
    return Object.entries(m).map(([name, h]) => ({ name: name.slice(0, 20), horas: +h.toFixed(1) }))
      .sort((a, b) => b.horas - a.horas).slice(0, 8);
  };

  const porColab = useMemo(() => agrupar(e => (e.technician_name || e.technician_email || "").split(" ")[0]), [entries]);
  const porCliente = useMemo(() => agrupar(e => ticketById[e.ticket_id]?.client_name), [entries, ticketById]);
  const porProjeto = useMemo(() => agrupar(e => {
    const t = ticketById[e.ticket_id];
    return t ? `#${t.ticket_number || ""} ${t.client_name || t.title}`.trim() : null;
  }), [entries, ticketById]);
  const porDepto = useMemo(() => agrupar(e => (ticketById[e.ticket_id]?.vertical || "").toUpperCase()), [entries, ticketById]);
  const porTipo = useMemo(() => agrupar(e => {
    const t = ticketById[e.ticket_id];
    return t?.main_type === "suporte" ? "Suporte" : "Implantação";
  }), [entries, ticketById]);

  // Evolução mensal (últimos 6 meses, sem filtro de período)
  const mensal = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" });
      let fat = 0, improd = 0;
      allEntries.forEach(e => {
        if ((e.date || "").startsWith(key)) {
          const h = (e.normal_hours || 0) + (e.extra_hours || 0);
          if (e.hour_type === "interna") improd += h; else fat += h;
        }
      });
      months.push({ label, "Faturáveis": +fat.toFixed(1), "Não faturáveis": +improd.toFixed(1) });
    }
    return months;
  }, [allEntries]);

  const Grafico = ({ icon, title, dados, cor = "hsl(var(--primary))", vertical = false }) => (
    <ChartCard icon={icon} title={title} subtitle="Top 8 no período">
      {dados.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Sem apontamentos</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          {vertical ? (
            <BarChart data={dados} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="horas" fill={cor} radius={[0, 4, 4, 0]} />
            </BarChart>
          ) : (
            <BarChart data={dados}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="horas" fill={cor} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </ChartCard>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Horas Previstas" value={fmtHoras(horasPrevistas)} icon={Clock} color="#8b5cf6" sub="Contratadas nos tickets" />
        <KpiCard label="Horas Executadas" value={fmtHoras(horasExecutadas)} icon={TrendingUp} color="#06b6d4" sub={`${entries.length} apontamentos`} />
        <KpiCard label="Horas Excedentes" value={fmtHoras(horasExcedentes)} icon={Clock} color={horasExcedentes > 0 ? "#ef4444" : "#22c55e"} sub="Executadas − previstas" />
        <KpiCard label="Horas Faturáveis" value={fmtHoras(horasFaturaveis)} icon={Clock} color="#22c55e" sub="Tipo normal (cobra)" />
        <KpiCard label="Horas Não Faturáveis" value={fmtHoras(horasImprodutivas)} icon={Clock} color="#f59e0b" sub="Tipo interna" />
        <KpiCard label="Horas Improdutivas" value={horasExecutadas > 0 ? `${Math.round((horasImprodutivas / horasExecutadas) * 100)}%` : "0%"} icon={Clock} color={horasImprodutivas / (horasExecutadas || 1) > 0.2 ? "#ef4444" : "#22c55e"} sub="% do total executado" />
      </div>

      <ChartCard icon={TrendingUp} title="Evolução Mensal de Horas" subtitle="Últimos 6 meses — faturáveis vs não faturáveis">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mensal}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Faturáveis" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Não faturáveis" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Grafico icon={Users} title="Horas por Colaborador" dados={porColab} />
        <Grafico icon={Building2} title="Horas por Cliente" dados={porCliente} cor="#06b6d4" vertical />
        <Grafico icon={Briefcase} title="Horas por Projeto" dados={porProjeto} cor="#f97316" vertical />
        <div className="grid grid-cols-1 gap-6">
          <Grafico icon={Building2} title="Horas por Departamento" dados={porDepto} cor="#22c55e" />
          <Grafico icon={Briefcase} title="Horas por Tipo de Atendimento" dados={porTipo} cor="#8b5cf6" />
        </div>
      </div>
    </div>
  );
}