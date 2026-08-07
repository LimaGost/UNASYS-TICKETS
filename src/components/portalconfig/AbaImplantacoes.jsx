import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from "lucide-react";

const S = {
  card: { background: "#161830", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12 },
  input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, width: "100%", outline: "none" },
  label: { color: "#9ca3af", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
};

const statusMeta = {
  aguardando: { label: "Aguardando", color: "#9ca3af" },
  em_andamento: { label: "Em andamento", color: "#a78bfa" },
  concluido: { label: "Concluído", color: "#4ade80" },
  pendencia_critica: { label: "Pendência Crítica", color: "#f87171" },
};

const CAMPOS_EMPRESA = [
  ["CNPJ", "cnpj"], ["Razão Social", "razao_social"], ["Nome Fantasia", "nome_fantasia"],
  ["Código da Loja", "codigo_loja"], ["CEP", "cep"], ["Endereço", "endereco"],
  ["Cidade", "cidade"], ["UF", "uf"], ["Inscrição Estadual", "inscricao_estadual"],
  ["Inscrição Municipal", "inscricao_municipal"], ["Adquirente de Cartão", "adquirente_cartao"],
  ["Chave Pix", "chave_pix"],
];

const CAMPOS_SOCIO = [
  ["Nome", "socio_nome"], ["CPF", "socio_cpf"], ["Telefone", "socio_telefone"], ["E-mail", "socio_email"],
];

const CAMPOS_GESTOR = [
  ["Nome", "gestor_nome"], ["Cargo", "gestor_cargo"], ["E-mail", "gestor_email"], ["Celular", "gestor_celular"],
];

function Secao({ titulo, cor = "#a78bfa" }) {
  return <p className="text-xs font-semibold uppercase tracking-wide mb-3 mt-2" style={{ color: cor }}>{titulo}</p>;
}

export default function AbaImplantacoes() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});

  const { data: implantacoes = [] } = useQuery({
    queryKey: ["todas-implantacoes"],
    queryFn: () => api.entities.ClienteImplantacao.list("-created_date"),
  });

  const { data: verticais = [] } = useQuery({
    queryKey: ["verticais"],
    queryFn: () => api.entities.Vertical.filter({ active: true }),
  });

  const criarMutation = useMutation({
    mutationFn: (data) => api.entities.ClienteImplantacao.create(data),
    onSuccess: () => { qc.invalidateQueries(["todas-implantacoes"]); setEditando(null); },
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.ClienteImplantacao.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["todas-implantacoes"]); setEditando(null); },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => api.entities.ClienteImplantacao.delete(id),
    onSuccess: () => qc.invalidateQueries(["todas-implantacoes"]),
  });

  const field = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const FormularioCompleto = ({ isNovo }) => (
    <div className="space-y-4 pt-3">
      <Secao titulo="Geral" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {isNovo && (
          <div>
            <label style={S.label}>E-mail do cliente *</label>
            <input value={form.usuario_email || ""} onChange={field("usuario_email")} placeholder="cliente@empresa.com" style={{ ...S.input, marginTop: 6 }} />
          </div>
        )}
        <div>
          <label style={S.label}>Nome da empresa</label>
          <input value={form.nome_empresa || ""} onChange={field("nome_empresa")} style={{ ...S.input, marginTop: 6 }} />
        </div>
        <div>
          <label style={S.label}>Analista responsável</label>
          <input value={form.analista_responsavel || ""} onChange={field("analista_responsavel")} style={{ ...S.input, marginTop: 6 }} />
        </div>
        <div>
          <label style={S.label}>E-mail do analista</label>
          <input value={form.analista_email || ""} onChange={field("analista_email")} style={{ ...S.input, marginTop: 6 }} />
        </div>
        <div>
          <label style={S.label}>Código da loja</label>
          <input value={form.codigo_loja || ""} onChange={field("codigo_loja")} style={{ ...S.input, marginTop: 6 }} />
        </div>
        <div>
          <label style={S.label}>Vertical</label>
          <select value={form.vertical || ""} onChange={field("vertical")} style={{ ...S.input, marginTop: 6 }}>
            <option value="">Selecionar...</option>
            {verticais.map(v => <option key={v.id} value={v.code}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Status geral</label>
          <select value={form.status_geral || "aguardando"} onChange={field("status_geral")} style={{ ...S.input, marginTop: 6 }}>
            {Object.entries(statusMeta).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Progresso (%)</label>
          <input type="number" min={0} max={100} value={form.progresso_percentual || 0}
            onChange={e => setForm(f => ({ ...f, progresso_percentual: Number(e.target.value) }))}
            style={{ ...S.input, marginTop: 6 }} />
        </div>
      </div>

      <Secao titulo="Dados da Empresa" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CAMPOS_EMPRESA.filter(([, k]) => k !== "codigo_loja").map(([label, key]) => (
          <div key={key}>
            <label style={S.label}>{label}</label>
            <input value={form[key] || ""} onChange={field(key)} style={{ ...S.input, marginTop: 6 }} />
          </div>
        ))}
        <div>
          <label style={S.label}>Regime Tributário</label>
          <select value={form.regime_tributario || ""} onChange={field("regime_tributario")} style={{ ...S.input, marginTop: 6 }}>
            <option value="">Selecionar...</option>
            <option value="simples_nacional">Simples Nacional</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="lucro_real">Lucro Real</option>
          </select>
        </div>
      </div>

      <Secao titulo="Sócio / Franqueado" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CAMPOS_SOCIO.map(([label, key]) => (
          <div key={key}>
            <label style={S.label}>{label}</label>
            <input value={form[key] || ""} onChange={field(key)} style={{ ...S.input, marginTop: 6 }} />
          </div>
        ))}
      </div>

      <Secao titulo="Gestor Operacional" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CAMPOS_GESTOR.map(([label, key]) => (
          <div key={key}>
            <label style={S.label}>{label}</label>
            <input value={form[key] || ""} onChange={field(key)} style={{ ...S.input, marginTop: 6 }} />
          </div>
        ))}
      </div>

      <div>
        <label style={S.label}>Observações do analista</label>
        <textarea value={form.observacoes_analista || ""} onChange={field("observacoes_analista")}
          rows={3} style={{ ...S.input, marginTop: 6, resize: "vertical" }} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button size="sm"
          onClick={() => isNovo
            ? form.usuario_email && criarMutation.mutate(form)
            : atualizarMutation.mutate({ id: editando, data: form })
          }
          className="bg-[#8B5CF6] text-white">
          {isNovo ? "Criar" : "Salvar tudo"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditando(null)} className="text-gray-400">Cancelar</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "#9ca3af" }}>Gerencie os registros de implantação dos clientes no portal.</p>
        <Button
          onClick={() => { setEditando("novo"); setForm({ status_geral: "aguardando", progresso_percentual: 0 }); }}
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-2" size="sm">
          <Plus className="w-4 h-4" /> Nova Implantação
        </Button>
      </div>

      {editando === "novo" && (
        <div style={S.card} className="p-4">
          <div className="text-sm font-semibold text-white mb-2">Nova Implantação</div>
          <FormularioCompleto isNovo />
        </div>
      )}

      <div style={S.card} className="overflow-hidden">
        {implantacoes.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: "#4b5563" }}>Nenhuma implantação registrada.</div>
        )}
        <div className="divide-y" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
          {implantacoes.map(imp => {
            const meta = statusMeta[imp.status_geral] || statusMeta.aguardando;
            const isEdit = editando === imp.id;
            return (
              <div key={imp.id} className="overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                    {(imp.nome_empresa || imp.usuario_email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{imp.nome_empresa || imp.usuario_email}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: "#6b7280" }}>{imp.usuario_email}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                      {imp.vertical && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af" }}>{imp.vertical}</span>}
                      <span className="text-xs" style={{ color: "#6b7280" }}>{imp.progresso_percentual || 0}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditando(isEdit ? null : imp.id); setForm({ ...imp }); }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5"
                      style={{ color: isEdit ? "#a78bfa" : "#6b7280" }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deletarMutation.mutate(imp.id)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/10" style={{ color: "#6b7280" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {isEdit && (
                  <div className="px-4 pb-4" style={{ background: "rgba(139,92,246,0.04)", borderTop: "1px solid rgba(139,92,246,0.08)" }}>
                    <FormularioCompleto isNovo={false} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}