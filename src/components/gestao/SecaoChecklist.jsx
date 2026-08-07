import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import {
  CheckCircle2, Circle, AlertCircle, Upload, X, FileText,
  ChevronDown, ChevronUp, Lock, Clock, Zap, Play
} from "lucide-react";

const S = {
  card: { background: "#161830", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12 },
  label: { color: "#9ca3af", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
};

const statusBadges = {
  "obrigatorio": { label: "Obrigatório", color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  "automatico": { label: "Automático", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  "treinamento": { label: "Treinamento", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
};

const respBadges = {
  "cliente": { label: "Cliente", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  "analista": { label: "Analista", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
};

export default function SecaoChecklist({ implantacao, isAnalista }) {
  const qc = useQueryClient();
  const [expandido, setExpandido] = useState(null);
  const [uploading, setUploading] = useState(null);

  const { data: etapas = [] } = useQuery({
    queryKey: ["etapas-checklist"],
    queryFn: () => api.entities.EtapaImplantacao.list("ordem"),
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["itens-checklist"],
    queryFn: () => api.entities.ItemChecklist.list(),
  });

  const { data: progressoItens = [] } = useQuery({
    queryKey: ["progresso-itens", implantacao.id],
    queryFn: () => api.entities.ProgressoItem.filter({ cliente_implantacao_id: implantacao.id }),
  });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const atualizarProgressoMutation = useMutation({
    mutationFn: ({ itemId, data }) => {
      const progresso = progressoItens.find(p => p.item_id === itemId);
      if (progresso) {
        return api.entities.ProgressoItem.update(progresso.id, data);
      }
      return api.entities.ProgressoItem.create({
        cliente_implantacao_id: implantacao.id,
        item_id: itemId,
        ...data,
      });
    },
    onSuccess: () => qc.invalidateQueries(["progresso-itens", implantacao.id]),
  });

  const handleUploadAnexo = async (file, itemId) => {
    if (!file) return;
    setUploading(itemId);
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    await atualizarProgressoMutation.mutateAsync({
      itemId,
      data: {
        anexo_url: file_url,
        anexo_nome: file.name,
      },
    });
    setUploading(null);
  };

  const etapasComItens = etapas.filter(e => {
    const temItens = itens.some(i => i.etapa_id === e.id);
    return temItens;
  }).map(e => ({
    ...e,
    itens: itens.filter(i => i.etapa_id === e.id),
  }));

  const totalItens = itens.length;
  const itensCompletos = progressoItens.filter(p => p.concluido).length;
  const percentualGeral = totalItens > 0 ? Math.round((itensCompletos / totalItens) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* KPI Geral */}
      <div style={S.card} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-white">Progresso Geral</span>
          <span className="text-lg font-bold" style={{ color: "#a78bfa" }}>{percentualGeral}%</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: "rgba(139,92,246,0.15)" }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${percentualGeral}%`, background: "linear-gradient(90deg, #8B5CF6, #a78bfa)" }}
          />
        </div>
        <div className="text-xs mt-2 flex gap-3" style={{ color: "#6b7280" }}>
          <span>{itensCompletos} de {totalItens} itens concluídos</span>
        </div>
      </div>

      {/* Etapas */}
      <div className="space-y-3">
        {etapasComItens.map((etapa, idx) => {
          const isExpandido = expandido === etapa.id;
          const itensEtapa = etapa.itens;
          const itensCompletosEtapa = progressoItens.filter(
            p => itensEtapa.some(i => i.id === p.item_id) && p.concluido
          ).length;
          const percentualEtapa = itensEtapa.length > 0 ? Math.round((itensCompletosEtapa / itensEtapa.length) * 100) : 0;

          return (
            <div key={etapa.id} style={S.card} className="overflow-hidden">
              {/* Header da Etapa */}
              <div
                onClick={() => setExpandido(isExpandido ? null : etapa.id)}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all"
                style={{ background: "rgba(139,92,246,0.05)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa" }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{etapa.titulo}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                    {itensCompletosEtapa} de {itensEtapa.length} itens concluídos
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold" style={{ color: "#a78bfa" }}>{percentualEtapa}%</div>
                    <div className="w-24 h-1 rounded-full mt-0.5" style={{ background: "rgba(139,92,246,0.15)" }}>
                      <div
                        className="h-1 rounded-full"
                        style={{ width: `${percentualEtapa}%`, background: "#a78bfa" }}
                      />
                    </div>
                  </div>
                  {isExpandido ? <ChevronUp className="w-4 h-4" style={{ color: "#6b7280" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#6b7280" }} />}
                </div>
              </div>

              {/* Itens */}
              {isExpandido && (
                <div className="divide-y" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
                  {itensEtapa.map((item, itemIdx) => {
                    const progresso = progressoItens.find(p => p.item_id === item.id);
                    const concluido = !!progresso?.concluido;
                    const podeEditar = isAnalista || (item.responsavel === "cliente" && !isAnalista);
                    const tipoMeta = statusBadges[item.tipo];
                    const respMeta = respBadges[item.responsavel];

                    return (
                      <div key={item.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          {podeEditar ? (
                            <button
                              onClick={() =>
                                atualizarProgressoMutation.mutate({
                                  itemId: item.id,
                                  data: { concluido: !concluido, concluido_em: !concluido ? new Date().toISOString() : null },
                                })
                              }
                              className="mt-0.5 flex-shrink-0 transition-all"
                              style={{ color: concluido ? "#4ade80" : "#4b5563" }}
                            >
                              {concluido ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <Circle className="w-5 h-5" />
                              )}
                            </button>
                          ) : (
                            <div className="mt-0.5 flex-shrink-0" style={{ color: concluido ? "#4ade80" : "#4b5563" }}>
                              {concluido ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </div>
                          )}

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm ${concluido ? "line-through" : ""}`} style={{ color: concluido ? "#6b7280" : "white" }}>
                                {item.titulo}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: tipoMeta.bg, color: tipoMeta.color }}>
                                {tipoMeta.label}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: respMeta.bg, color: respMeta.color }}>
                                {respMeta.label}
                              </span>
                            </div>

                            {item.descricao_ajuda && (
                              <div className="text-xs mt-1" style={{ color: "#6b7280" }}>
                                {item.descricao_ajuda}
                              </div>
                            )}

                            {/* Texto do analista */}
                            {item.texto_analista && (
                              <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
                                <div style={{ color: "#fbbf24", fontWeight: 500 }}>Informação do analista:</div>
                                <div style={{ color: "#9ca3af", marginTop: 4 }}>{item.texto_analista}</div>
                                {item.requer_confirmacao_cliente && !isAnalista && (
                                  <button
                                    onClick={() =>
                                      atualizarProgressoMutation.mutate({
                                        itemId: item.id,
                                        data: { confirmado_cliente: !progresso?.confirmado_cliente },
                                      })
                                    }
                                    className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                                    style={{
                                      background: progresso?.confirmado_cliente ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)",
                                      color: progresso?.confirmado_cliente ? "#4ade80" : "#9ca3af",
                                    }}
                                  >
                                    {progresso?.confirmado_cliente ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                                    {progresso?.confirmado_cliente ? "Confirmado" : "Confirmar leitura"}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Upload de anexo */}
                            {item.permite_anexo && (
                              <div className="mt-2">
                                {progresso?.anexo_url ? (
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
                                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "#4ade80" }} />
                                    <a href={progresso.anexo_url} target="_blank" rel="noreferrer" className="text-xs flex-1 truncate" style={{ color: "#4ade80" }}>
                                      {progresso.anexo_nome || "Arquivo anexado"}
                                    </a>
                                    {podeEditar && (
                                      <button
                                        onClick={() =>
                                          atualizarProgressoMutation.mutate({
                                            itemId: item.id,
                                            data: { anexo_url: null, anexo_nome: null },
                                          })
                                        }
                                        className="text-gray-600 hover:text-red-400"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <label
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                                    style={{
                                      background: "rgba(139,92,246,0.08)",
                                      border: "1px dashed rgba(139,92,246,0.3)",
                                      color: "#a78bfa",
                                    }}
                                  >
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => e.target.files?.[0] && handleUploadAnexo(e.target.files[0], item.id)}
                                      disabled={uploading === item.id}
                                    />
                                    {uploading === item.id ? (
                                      <>
                                        <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs">Enviando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="w-3.5 h-3.5" />
                                        <span className="text-xs">{item.anexo_obrigatorio ? "Anexo obrigatório" : "Clique para anexar arquivo"}</span>
                                      </>
                                    )}
                                  </label>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {etapasComItens.length === 0 && (
        <div className="text-center py-12 text-sm" style={{ color: "#4b5563" }}>
          Nenhum checklist configurado para esta implantação.
        </div>
      )}
    </div>
  );
}