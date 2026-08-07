import React, { useMemo, useState } from "react";
import { TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import KpiCard from "./KpiCard";
import ChartCard from "./ChartCard";
import EscalationDetailModal from "./EscalationDetailModal";
import { fmtDuracao, MOTIVO_LABELS, ESC_STATUS } from "./useDiretorData";

export default function EscalationsTab({ data }) {
  const { escalations, ticketById, internos, users } = data;
  const [selecionado, setSelecionado] = useState(null);

  const abertos = escalations.filter(e => e.status === "aberto").length;
  const emTratativa = escalations.filter(e => e.status === "em_tratativa").length;
  const resolvidos = escalations.filter(e => ["resolvido", "encerrado"].includes(e.status)).length;

  const tempoMedioAte = useMemo(() => {
    const ds = escalations.filter(e => e.ticket_created_date)
      .map(e => new Date(e.created_date) - new Date(e.ticket_created_date)).filter(d => d >= 0);
    return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
  }, [escalations]);

  const tempoMedioResolucao = useMemo(() => {
    const ds = escalations.filter(e => e.encerrado_em)
      .map(e => new Date(e.encerrado_em) - new Date(e.created_date)).filter(d => d >= 0);
    return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
  }, [escalations]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Escalonamentos" value={escalations.length} icon={TrendingUp} color="#f97316" sub="No período" />
        <KpiCard label="Abertos" value={abertos} icon={TrendingUp} color="#ef4444" sub="Aguardando tratativa" />
        <KpiCard label="Em Tratativa" value={emTratativa} icon={Clock} color="#f59e0b" />
        <KpiCard label="Resolvidos" value={resolvidos} icon={CheckCircle2} color="#22c55e" />
        <KpiCard label="Tempo até Escalonar" value={fmtDuracao(tempoMedioAte)} icon={Clock} color="#06b6d4" sub="Média criação → escalonamento" />
        <KpiCard label="Tempo de Tratativa" value={fmtDuracao(tempoMedioResolucao)} icon={Clock} color="#8b5cf6" sub="Média até encerramento" />
      </div>

      <ChartCard icon={TrendingUp} title="Gestão de Escalonamentos" subtitle="Clique em um escalonamento para ver a timeline e registrar a tratativa">
        {escalations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhum escalonamento registrado no período</p>
        ) : (
          <div className="space-y-2">
            {escalations.map(esc => {
              const ticket = ticketById[esc.ticket_id];
              const st = ESC_STATUS[esc.status] || ESC_STATUS.aberto;
              const tempoAte = esc.ticket_created_date ? new Date(esc.created_date) - new Date(esc.ticket_created_date) : null;
              const tempoResol = esc.encerrado_em ? new Date(esc.encerrado_em) - new Date(esc.created_date) : null;
              const tempoApos = ticket?.closed_at ? new Date(ticket.closed_at) - new Date(esc.created_date) : null;
              return (
                <button key={esc.id} onClick={() => setSelecionado(esc)}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border hover:border-primary/40 transition-all">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                    style={{ background: `${st.color}22`, color: st.color }}>
                    {st.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      #{esc.ticket_number || (ticket?.ticket_number ?? "")} — {esc.ticket_title || ticket?.title || "Ticket"}
                      <span className="ml-2 text-[10px] font-semibold text-orange-500">Nível {esc.nivel || 1}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {MOTIVO_LABELS[esc.motivo_categoria] || "Outro"}: {esc.motivo}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      <span>Cliente: <strong className="text-foreground">{esc.client_name || "—"}</strong></span>
                      <span>De: <strong>{esc.escalated_by_nome || "—"}</strong></span>
                      <span>Para: <strong>{esc.escalated_to_nome || "—"}</strong></span>
                      <span>Tratativa: <strong>{esc.responsavel_tratativa_nome || "—"}</strong></span>
                      <span>{new Date(esc.created_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      <span>Até escalonar: <strong className="text-foreground">{fmtDuracao(tempoAte)}</strong></span>
                      <span>Tratativa: <strong className="text-foreground">{fmtDuracao(tempoResol)}</strong></span>
                      <span>Pós-escalonamento: <strong className="text-foreground">{fmtDuracao(tempoApos)}</strong></span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ChartCard>

      {selecionado && (
        <EscalationDetailModal
          escalation={selecionado}
          ticket={ticketById[selecionado.ticket_id]}
          internos={users}
          onClose={() => setSelecionado(null)}
        />
      )}
    </div>
  );
}