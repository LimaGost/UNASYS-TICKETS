import React from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from "recharts";
import { BarChart3 } from "lucide-react";

const COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#F97316", "#A78BFA"];

function EmptyChart() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-primary/40" />
      </div>
      Sem dados para exibir
    </div>
  );
}

const hasData = (data) => Array.isArray(data) && data.length > 0 && data.some(d => Number(d.value ?? d.tempo ?? d.total ?? d.tickets ?? d.normal ?? d.cumprido ?? d.resolvidos ?? 0) > 0);

const ChartCard = ({ title, accentColor, children }) => (
  <div className="bg-card border border-border rounded-xl p-5">
    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
      <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: accentColor }} />
      {title}
    </h3>
    <div className="h-[300px]">{children}</div>
  </div>
);

// Tooltip style is computed inline to react to theme changes via CSS vars — recharts needs plain objects
const tooltipStyle = {
  borderRadius: "8px",
  fontSize: "12px",
  padding: "8px 12px",
  fontWeight: "500",
  border: "1px solid rgba(139,92,246,0.3)",
};

export function TicketsByStatusChart({ data }) {
  return (
    <ChartCard title="Tickets por Status" accentColor="#8B5CF6">
      {!hasData(data) ? <EmptyChart /> : (
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function TicketsByUrgencyChart({ data }) {
  const urgencyColors = { "Crítica": "#EF4444", "Alta": "#F97316", "Média": "#F59E0B", "Baixa": "#10B981" };
  return (
    <ChartCard title="Distribuição por Urgência" accentColor="#F97316">
      {!hasData(data) ? <EmptyChart /> : (
        <>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                {data.map((entry, i) => <Cell key={i} fill={urgencyColors[entry.name] || COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-3">
            {data.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: urgencyColors[item.name] || COLORS[i] }} />
                {item.name}: {item.value}
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}

export function TicketTrendChart({ data }) {
  return (
    <ChartCard title="Tendência de Abertura" accentColor="#3B82F6">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="tickets" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorTickets)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function HoursComparisonChart({ data }) {
  return (
    <ChartCard title="Comparativo de Horas" accentColor="#10B981">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }} />
          <Bar dataKey="normal" fill="#10B981" radius={[4, 4, 0, 0]} name="Normal" />
          <Bar dataKey="extra" fill="#06B6D4" radius={[4, 4, 0, 0]} name="Extra" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SLAPerformanceChart({ data }) {
  return (
    <ChartCard title="Performance de SLA" accentColor="#10B981">
      <ResponsiveContainer>
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={80} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }} />
          <Bar dataKey="cumprido" fill="#10B981" radius={[0, 4, 4, 0]} name="Cumprido" />
          <Bar dataKey="estourado" fill="#EF4444" radius={[0, 4, 4, 0]} name="Estourado" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TicketsByClientChart({ data }) {
  return (
    <ChartCard title="Top 10 Clientes" accentColor="#06B6D4">
      <ResponsiveContainer>
        <BarChart data={data.slice(0, 10)} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={120} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill="#06B6D4" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ResolutionTimeByUrgencyChart({ data }) {
  return (
    <ChartCard title="Tempo Médio de Resolução por Urgência" accentColor="#F59E0B">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: 'Horas', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}h`} />
          <Bar dataKey="tempo" fill="#F59E0B" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ResolutionTimeByTypeChart({ data }) {
  return (
    <ChartCard title="Tempo Médio de Resolução por Tipo" accentColor="#A78BFA">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: 'Horas', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}h`} />
          <Bar dataKey="tempo" fill="#A78BFA" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function VolumeByPeriodChart({ data }) {
  return (
    <ChartCard title="Volume de Tickets por Período" accentColor="#06B6D4">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
          <XAxis dataKey="periodo" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="total" stroke="#06B6D4" strokeWidth={2} dot={{ fill: "#06B6D4", r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AnalystPerformanceChart({ data }) {
  return (
    <ChartCard title="Desempenho por Analista" accentColor="#3B82F6">
      <ResponsiveContainer>
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={100} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }} />
          <Bar dataKey="resolvidos" fill="#10B981" radius={[0, 4, 4, 0]} name="Resolvidos" />
          <Bar dataKey="emAndamento" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Em Andamento" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}