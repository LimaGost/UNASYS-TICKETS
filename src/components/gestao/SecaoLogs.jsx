import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import {
  CheckCircle2, Upload, UserCheck, AlertTriangle, Star,
  ClipboardCheck, Activity, Clock, User
} from "lucide-react";

const tipoMeta = {
  item_concluido:      { icon: CheckCircle2, color: "#4ade80",  label: "Item concluído" },
  item_reaberto:       { icon: Activity,     color: "#f87171",  label: "Item reaberto" },
  anexo_enviado:       { icon: Upload,       color: "#60a5fa",  label: "Anexo enviado" },
  confirmacao_cliente: { icon: UserCheck,    color: "#fbbf24",  label: "Confirmado pelo cliente" },
  etapa_concluida:     { icon: ClipboardCheck,color: "#a78bfa", label: "Etapa concluída" },
  status_alterado:     { icon: AlertTriangle, color: "#fb923c", label: "Status alterado" },
  nota_adicionada:     { icon: Star,         color: "#fbbf24",  label: "Nota adicionada" },
};

function formatDate(dt) {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const S = {
  card: { background: "#161830", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12 },
};

export default function SecaoLogs({ implantacao }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["implantacao-logs", implantacao.id],
    queryFn: () => api.entities.ImplantacaoLog.filter(
      { cliente_implantacao_id: implantacao.id },
      "-created_date",
      100
    ),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="w-12 h-12 mb-3" style={{ color: "#1f2937" }} />
        <p className="text-sm font-medium" style={{ color: "#4b5563" }}>Nenhum evento registrado ainda</p>
        <p className="text-xs mt-1" style={{ color: "#374151" }}>
          As alterações em etapas e itens do checklist aparecerão aqui.
        </p>
      </div>
    );
  }

  // Agrupar por data
  const grupos = logs.reduce((acc, log) => {
    const data = log.created_date ? new Date(log.created_date).toLocaleDateString("pt-BR") : "—";
    if (!acc[data]) acc[data] = [];
    acc[data].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.15)" }}>
        <Activity className="w-4 h-4 flex-shrink-0" style={{ color: "#a78bfa" }} />
        <p style={{ color: "#9ca3af" }}>
          Registro completo de todas as alterações feitas por analistas e pelo cliente durante a implantação.
        </p>
      </div>

      {Object.entries(grupos).map(([data, eventos]) => (
        <div key={data}>
          {/* Label de data */}
          <div className="flex items-center gap-3 mb-3">
            <div className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
              {data}
            </div>
            <div className="flex-1 h-px" style={{ background: "rgba(139,92,246,0.1)" }} />
            <span className="text-xs" style={{ color: "#4b5563" }}>{eventos.length} evento{eventos.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Linha do tempo */}
          <div className="relative pl-6">
            {/* Linha vertical */}
            <div className="absolute left-2.5 top-0 bottom-0 w-px" style={{ background: "rgba(139,92,246,0.15)" }} />

            <div className="space-y-3">
              {eventos.map((log) => {
                const meta = tipoMeta[log.tipo] || { icon: Activity, color: "#6b7280", label: log.tipo };
                const Icon = meta.icon;

                return (
                  <div key={log.id} className="relative">
                    {/* Ponto na linha */}
                    <div className="absolute -left-6 top-3 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: `${meta.color}20`, border: `2px solid ${meta.color}40` }}>
                      <Icon className="w-2.5 h-2.5" style={{ color: meta.color }} />
                    </div>

                    <div className="rounded-xl p-3 transition-all hover:opacity-90"
                      style={{ background: "#161830", border: "1px solid rgba(139,92,246,0.1)" }}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          {/* Tipo badge */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: `${meta.color}15`, color: meta.color }}>
                              {meta.label}
                            </span>
                            {log.etapa_titulo && (
                              <span className="text-xs px-2 py-0.5 rounded"
                                style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>
                                Etapa: {log.etapa_titulo}
                              </span>
                            )}
                          </div>

                          {/* Descrição */}
                          <p className="text-sm text-white">{log.descricao}</p>

                          {/* Item vinculado */}
                          {log.item_titulo && (
                            <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                              Item: {log.item_titulo}
                            </p>
                          )}

                          {/* Mudança de valor */}
                          {log.valor_anterior && log.valor_novo && (
                            <div className="flex items-center gap-2 mt-1.5 text-xs">
                              <span className="px-2 py-0.5 rounded line-through"
                                style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>
                                {log.valor_anterior}
                              </span>
                              <span style={{ color: "#4b5563" }}>→</span>
                              <span className="px-2 py-0.5 rounded"
                                style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                                {log.valor_novo}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Quem + quando */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                          {(log.usuario_nome || log.usuario_email) && (
                            <div className="flex items-center gap-1 text-xs"
                              style={{ color: "#6b7280" }}>
                              <User className="w-3 h-3" />
                              <span>{log.usuario_nome || log.usuario_email}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs" style={{ color: "#4b5563" }}>
                            <Clock className="w-3 h-3" />
                            {log.created_date
                              ? new Date(log.created_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}