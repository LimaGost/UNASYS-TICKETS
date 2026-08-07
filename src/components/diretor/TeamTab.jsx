import React, { useMemo } from "react";
import { Users, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ChartCard, { tooltipStyle } from "./ChartCard";
import { fmtHoras, fmtDuracao } from "./useDiretorData";

export default function TeamTab({ data }) {
  const { tickets, entries, escalations, internos, reaberturas } = data;

  const stats = useMemo(() => internos.map(u => {
    const meus = tickets.filter(t => t.assigned_to === u.email);
    const concluidos = meus.filter(t => t.closed_at);
    const andamento = meus.filter(t => !t.closed_at);
    const atrasados = meus.filter(t => t.sla_breached && !t.closed_at);
    const breached = meus.filter(t => t.sla_breached).length;

    const tmr = concluidos.length
      ? concluidos.reduce((a, t) => a + (new Date(t.closed_at) - new Date(t.created_date)), 0) / concluidos.length
      : null;

    const meusEntries = entries.filter(e => e.technician_email === u.email);
    const horasTot = meusEntries.reduce((a, e) => a + (e.normal_hours || 0) + (e.extra_hours || 0), 0);
    const horasProd = meusEntries.filter(e => e.hour_type !== "interna")
      .reduce((a, e) => a + (e.normal_hours || 0) + (e.extra_hours || 0), 0);
    const horasImprod = horasTot - horasProd;

    const meusIds = new Set(meus.map(t => t.id));
    const retrab = reaberturas.filter(e => meusIds.has(e.ticket_id)).length;
    const taxaRetrab = meus.length ? Math.round((retrab / meus.length) * 100) : 0;

    const escRecebidos = escalations.filter(e => e.escalated_to_email === u.email).length;
    const escGerados = escalations.filter(e => e.escalated_by_email === u.email || e.colaborador_email === u.email).length;

    const slaInd = meus.length ? Math.round(((meus.length - breached) / meus.length) * 100) : 100;
    const produtividade = meus.length ? Math.round((concluidos.length / meus.length) * 100) : 0;
    const eficiencia = horasTot > 0 ? Math.round((horasProd / horasTot) * 100) : 100;
    const score = meus.length
      ? Math.max(0, Math.round(produtividade - (breached / meus.length) * 30 - taxaRetrab * 0.5))
      : null;

    return {
      ...u, total: meus.length, concluidos: concluidos.length, andamento: andamento.length,
      atrasados: atrasados.length, tmr, horasTot, horasProd, horasImprod, taxaRetrab,
      escRecebidos, escGerados, slaInd, produtividade, eficiencia, score,
    };
  }).filter(u => u.total > 0 || u.horasTot > 0).sort((a, b) => (b.score || 0) - (a.score || 0)), [internos, tickets, entries, escalations, reaberturas]);

  const comparativo = stats.map(u => ({
    name: (u.full_name || u.email).split(" ")[0],
    Concluídos: u.concluidos,
    "Em andamento": u.andamento,
    Horas: +u.horasTot.toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <ChartCard icon={BarChart2} title="Comparativo da Equipe" subtitle="Tickets concluídos, em andamento e horas apontadas">
        {comparativo.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={comparativo}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Concluídos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Em andamento" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Horas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard icon={Users} title="Análise Individual" subtitle="Métricas detalhadas por colaborador no período">
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-2 font-medium">#</th>
                  <th className="text-left py-2 pr-3 font-medium">Colaborador</th>
                  <th className="text-center py-2 px-2 font-medium">Concl.</th>
                  <th className="text-center py-2 px-2 font-medium">Andam.</th>
                  <th className="text-center py-2 px-2 font-medium">Atras.</th>
                  <th className="text-center py-2 px-2 font-medium">T. Resol.</th>
                  <th className="text-center py-2 px-2 font-medium">Horas</th>
                  <th className="text-center py-2 px-2 font-medium">Prod./Improd.</th>
                  <th className="text-center py-2 px-2 font-medium">Retrab.</th>
                  <th className="text-center py-2 px-2 font-medium">Esc. Rec/Ger</th>
                  <th className="text-center py-2 px-2 font-medium">SLA</th>
                  <th className="text-center py-2 px-2 font-medium">Produt.</th>
                  <th className="text-center py-2 px-2 font-medium">Efic.</th>
                  <th className="text-center py-2 pl-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((u, idx) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 pr-2 font-bold text-muted-foreground">{idx + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-foreground whitespace-nowrap">{u.full_name || u.email}</div>
                      <div className="text-[10px] text-muted-foreground">{u.cargo || "Analista"}{u.vertical ? ` · ${u.vertical}` : ""}</div>
                    </td>
                    <td className="text-center px-2 font-semibold text-emerald-500">{u.concluidos}</td>
                    <td className="text-center px-2 font-semibold text-orange-500">{u.andamento}</td>
                    <td className={`text-center px-2 font-semibold ${u.atrasados ? "text-red-500" : "text-muted-foreground"}`}>{u.atrasados}</td>
                    <td className="text-center px-2 text-foreground">{fmtDuracao(u.tmr)}</td>
                    <td className="text-center px-2 font-semibold text-foreground">{fmtHoras(u.horasTot)}</td>
                    <td className="text-center px-2 text-muted-foreground whitespace-nowrap">
                      <span className="text-emerald-500">{fmtHoras(u.horasProd)}</span> / <span className="text-red-400">{fmtHoras(u.horasImprod)}</span>
                    </td>
                    <td className={`text-center px-2 font-semibold ${u.taxaRetrab > 10 ? "text-red-500" : "text-muted-foreground"}`}>{u.taxaRetrab}%</td>
                    <td className="text-center px-2 text-muted-foreground whitespace-nowrap">{u.escRecebidos} / {u.escGerados}</td>
                    <td className={`text-center px-2 font-semibold ${u.slaInd >= 80 ? "text-emerald-500" : "text-red-500"}`}>{u.slaInd}%</td>
                    <td className="text-center px-2 text-foreground">{u.produtividade}%</td>
                    <td className="text-center px-2 text-foreground">{u.eficiencia}%</td>
                    <td className="text-center pl-2">
                      {u.score !== null && (
                        <span className="inline-flex w-8 h-8 rounded-full items-center justify-center text-[11px] font-bold border-2"
                          style={{
                            borderColor: u.score >= 75 ? "#22c55e" : u.score >= 50 ? "#f59e0b" : "#ef4444",
                            color: u.score >= 75 ? "#22c55e" : u.score >= 50 ? "#f59e0b" : "#ef4444",
                          }}>
                          {u.score}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}