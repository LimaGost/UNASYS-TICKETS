import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { BellRing, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import ChartCard from "./ChartCard";
import { fmtHoras } from "./useDiretorData";

const SEV = {
  critica: { color: "#ef4444", label: "Crítico" },
  alta: { color: "#f97316", label: "Alto" },
  media: { color: "#f59e0b", label: "Atenção" },
};

export default function AlertsTab({ data }) {
  const { tickets, entries, escalations, allEscalations, internos, events, reaberturas, ticketById, cutoff } = data;

  const alertas = useMemo(() => {
    const list = [];
    const now = new Date();

    // 1. SLA em risco / violado
    tickets.filter(t => t.sla_breached && !t.closed_at).forEach(t =>
      list.push({ sev: "critica", titulo: `SLA violado: #${t.ticket_number || ""} ${t.title}`, detalhe: `${t.client_name || ""} · ${t.assigned_to_name || "Não atribuído"}`, link: `/ticket/${t.id}` })
    );

    // 2. Tickets críticos sem movimentação (>48h sem eventos)
    tickets.filter(t => t.urgency === "critica" && !t.closed_at).forEach(t => {
      const ultimo = events.filter(e => e.ticket_id === t.id)
        .reduce((a, e) => Math.max(a, new Date(e.created_date).getTime()), new Date(t.created_date).getTime());
      const horasParado = (now - ultimo) / 3.6e6;
      if (horasParado > 48) {
        list.push({ sev: "critica", titulo: `Ticket crítico parado há ${Math.round(horasParado / 24)}d: #${t.ticket_number || ""} ${t.title}`, detalhe: `${t.client_name || ""} · sem movimentação`, link: `/ticket/${t.id}` });
      }
    });

    // 3. Tickets parados por longos períodos (>7 dias sem eventos, não críticos)
    const parados = tickets.filter(t => !t.closed_at && t.urgency !== "critica").filter(t => {
      const ultimo = events.filter(e => e.ticket_id === t.id)
        .reduce((a, e) => Math.max(a, new Date(e.created_date).getTime()), new Date(t.created_date).getTime());
      return (now - ultimo) / 8.64e7 > 7;
    });
    if (parados.length > 0) {
      list.push({ sev: "alta", titulo: `${parados.length} ticket(s) sem movimentação há mais de 7 dias`, detalhe: parados.slice(0, 3).map(t => `#${t.ticket_number || ""} ${t.client_name || t.title}`).join(" · ") });
    }

    // 4. Aumento anormal de escalonamentos (2ª metade do período vs 1ª)
    const meio = new Date((cutoff.getTime() + now.getTime()) / 2);
    const esc1 = escalations.filter(e => new Date(e.created_date) < meio).length;
    const esc2 = escalations.filter(e => new Date(e.created_date) >= meio).length;
    if (esc2 > esc1 * 1.5 && esc2 >= 3) {
      list.push({ sev: "alta", titulo: `Tendência de aumento de escalonamentos`, detalhe: `${esc1} → ${esc2} entre a primeira e a segunda metade do período` });
    }

    // 5. Colaborador com alto retrabalho
    internos.forEach(u => {
      const meus = tickets.filter(t => t.assigned_to === u.email);
      if (meus.length < 3) return;
      const ids = new Set(meus.map(t => t.id));
      const retrab = reaberturas.filter(e => ids.has(e.ticket_id)).length;
      if (retrab / meus.length > 0.2) {
        list.push({ sev: "alta", titulo: `Alto índice de retrabalho: ${u.full_name || u.email}`, detalhe: `${retrab} reaberturas em ${meus.length} tickets (${Math.round((retrab / meus.length) * 100)}%)` });
      }
    });

    // 6. Colaborador sobrecarregado (> 8 tickets abertos)
    internos.forEach(u => {
      const abertos = tickets.filter(t => t.assigned_to === u.email && !t.closed_at).length;
      if (abertos > 8) {
        list.push({ sev: "media", titulo: `Colaborador sobrecarregado: ${u.full_name || u.email}`, detalhe: `${abertos} tickets abertos atribuídos` });
      }
    });

    // 7. Cliente com excesso de chamados (>5 no período)
    const porCliente = {};
    tickets.forEach(t => { const k = t.client_name; if (k) porCliente[k] = (porCliente[k] || 0) + 1; });
    Object.entries(porCliente).filter(([, n]) => n > 5).forEach(([c, n]) =>
      list.push({ sev: "media", titulo: `Cliente com excesso de chamados: ${c}`, detalhe: `${n} tickets no período` })
    );

    // 8. Projeto consumindo mais horas que o previsto
    const horasPorTicket = {};
    entries.forEach(e => { horasPorTicket[e.ticket_id] = (horasPorTicket[e.ticket_id] || 0) + (e.normal_hours || 0) + (e.extra_hours || 0); });
    Object.entries(horasPorTicket).forEach(([tid, h]) => {
      const t = ticketById[tid];
      if (t?.contracted_hours > 0 && h > t.contracted_hours) {
        list.push({ sev: "alta", titulo: `Projeto estourou horas contratadas: #${t.ticket_number || ""} ${t.client_name || t.title}`, detalhe: `${fmtHoras(h)} executadas de ${fmtHoras(t.contracted_hours)} contratadas`, link: `/ticket/${t.id}` });
      }
    });

    // 9. Escalonamentos abertos sem tratativa
    const escSemTratativa = allEscalations.filter(e => e.status === "aberto");
    if (escSemTratativa.length > 0) {
      list.push({ sev: "alta", titulo: `${escSemTratativa.length} escalonamento(s) aguardando tratativa`, detalhe: escSemTratativa.slice(0, 3).map(e => `#${e.ticket_number || ""} ${e.client_name || ""}`).join(" · ") });
    }

    const ordem = { critica: 0, alta: 1, media: 2 };
    return list.sort((a, b) => ordem[a.sev] - ordem[b.sev]);
  }, [tickets, entries, escalations, allEscalations, internos, events, reaberturas, ticketById, cutoff]);

  return (
    <ChartCard icon={BellRing} title="Alertas Inteligentes" subtitle={`${alertas.length} situações detectadas automaticamente no período filtrado`}>
      {alertas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Nenhuma situação crítica detectada
        </p>
      ) : (
        <div className="space-y-2">
          {alertas.map((a, i) => {
            const s = SEV[a.sev];
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border"
                style={{ borderColor: `${s.color}33`, background: `${s.color}0d` }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: s.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: `${s.color}22`, color: s.color }}>{s.label}</span>
                    <span className="text-sm font-medium text-foreground truncate">{a.titulo}</span>
                  </div>
                  {a.detalhe && <div className="text-xs text-muted-foreground mt-1">{a.detalhe}</div>}
                </div>
                {a.link && (
                  <Link to={a.link} className="text-xs text-primary flex items-center gap-0.5 hover:underline flex-shrink-0 mt-0.5">
                    Ver <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}