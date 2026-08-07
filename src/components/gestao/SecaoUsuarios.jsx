import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Users, Search, Plus, Trash2, ShieldCheck, Eye, Briefcase, UserCheck } from "lucide-react";

const S = {
  card:  { background: "#161830", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12 },
  input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13, width: "100%", outline: "none" },
  label: { color: "#9ca3af", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
};

const TIPO_OPTS = [
  { val: "gestor",       label: "Gestor",       icon: ShieldCheck, desc: "Acesso total ao portal", color: "#a78bfa" },
  { val: "gerente",      label: "Gerente",      icon: Briefcase,   desc: "Visualiza e acompanha",  color: "#60a5fa" },
  { val: "analista",     label: "Analista",     icon: UserCheck,   desc: "Pode interagir",         color: "#4ade80" },
  { val: "visualizador", label: "Visualizador", icon: Eye,         desc: "Somente leitura",        color: "#9ca3af" },
];

export default function SecaoUsuarios({ implantacao }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [tipoSelecionado, setTipoSelecionado] = useState("gestor");
  const [showPicker, setShowPicker] = useState(false);

  // Usuários já vinculados a esta implantação
  const { data: vinculados = [], isLoading: isLoadingVinc } = useQuery({
    queryKey: ["usuarios-implantacao", implantacao.id],
    queryFn: () => api.entities.ImplantacaoUsuario.filter({ cliente_implantacao_id: implantacao.id }),
  });

  // Todos os usuários do sistema
  const { data: todosUsuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => api.entities.User.list(),
  });

  // Usuários ainda não vinculados
  const emailsVinculados = new Set(vinculados.map(v => v.usuario_email));
  const disponíveis = todosUsuarios.filter(u =>
    !emailsVinculados.has(u.email) &&
    (busca === "" ||
      u.full_name?.toLowerCase().includes(busca.toLowerCase()) ||
      u.email?.toLowerCase().includes(busca.toLowerCase()))
  );

  const vincularMutation = useMutation({
    mutationFn: (user) => api.entities.ImplantacaoUsuario.create({
      cliente_implantacao_id: implantacao.id,
      usuario_id: user.id,
      usuario_email: user.email,
      usuario_nome: user.full_name,
      tipo_acesso: tipoSelecionado,
    }),
    onSuccess: () => {
      qc.invalidateQueries(["usuarios-implantacao", implantacao.id]);
      setBusca("");
      setShowPicker(false);
    },
  });

  const alterarTipoMutation = useMutation({
    mutationFn: ({ id, tipo }) => api.entities.ImplantacaoUsuario.update(id, { tipo_acesso: tipo }),
    onSuccess: () => qc.invalidateQueries(["usuarios-implantacao", implantacao.id]),
  });

  const removerMutation = useMutation({
    mutationFn: (id) => api.entities.ImplantacaoUsuario.delete(id),
    onSuccess: () => qc.invalidateQueries(["usuarios-implantacao", implantacao.id]),
  });

  const getTipoMeta = (val) => TIPO_OPTS.find(t => t.val === val) || TIPO_OPTS[0];

  return (
    <div className="space-y-4">

      {/* Info */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
        style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.15)" }}>
        <Users className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#a78bfa" }} />
        <p style={{ color: "#9ca3af" }}>
          Vincule usuários do sistema a esta implantação. Cada um terá acesso ao portal do cliente conforme seu tipo de acesso.
        </p>
      </div>

      {/* Header + botão */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">
          {vinculados.length} usuário{vinculados.length !== 1 ? "s" : ""} com acesso
        </span>
        <button
          onClick={() => { setShowPicker(v => !v); setBusca(""); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: showPicker ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
          <Plus className="w-3.5 h-3.5" />
          {showPicker ? "Cancelar" : "Adicionar usuário"}
        </button>
      </div>

      {/* Picker de usuários */}
      {showPicker && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.04)" }}>
          {/* Tipo de acesso */}
          <div className="p-4 space-y-3" style={{ borderBottom: "1px solid rgba(139,92,246,0.1)" }}>
            <div style={S.label}>Tipo de acesso para novos usuários</div>
            <div className="grid grid-cols-2 gap-2">
              {TIPO_OPTS.map(t => {
                const Icon = t.icon;
                const ativo = tipoSelecionado === t.val;
                return (
                  <button key={t.val} onClick={() => setTipoSelecionado(t.val)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: ativo ? `${t.color}15` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${ativo ? t.color + "40" : "rgba(255,255,255,0.06)"}`,
                    }}>
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: ativo ? t.color : "#4b5563" }} />
                    <div>
                      <div className="text-xs font-semibold" style={{ color: ativo ? t.color : "#9ca3af" }}>{t.label}</div>
                      <div className="text-xs" style={{ color: "#4b5563" }}>{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Busca */}
          <div className="p-3" style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#6b7280" }} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-600"
                autoFocus
              />
            </div>
          </div>

          {/* Lista de usuários disponíveis */}
          <div className="max-h-56 overflow-y-auto">
            {disponíveis.length === 0 ? (
              <div className="py-6 text-center text-sm" style={{ color: "#4b5563" }}>
                {busca ? "Nenhum usuário encontrado" : "Todos os usuários já estão vinculados"}
              </div>
            ) : (
              disponíveis.map(u => (
                <button key={u.id} onClick={() => vincularMutation.mutate(u)}
                  disabled={vincularMutation.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                    {(u.full_name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{u.full_name || "—"}</div>
                    <div className="text-xs truncate" style={{ color: "#6b7280" }}>{u.email}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs flex-shrink-0"
                    style={{ background: `${getTipoMeta(tipoSelecionado).color}15`, color: getTipoMeta(tipoSelecionado).color, padding: "2px 8px", borderRadius: 6 }}>
                    <Plus className="w-3 h-3" />
                    {getTipoMeta(tipoSelecionado).label}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Lista de usuários vinculados */}
      <div className="space-y-2">
        {isLoadingVinc && (
          <div className="text-center py-6 text-sm" style={{ color: "#6b7280" }}>Carregando...</div>
        )}
        {!isLoadingVinc && vinculados.length === 0 && !showPicker && (
          <div className="text-center py-8 rounded-xl text-sm" style={{ color: "#4b5563", border: "1px dashed rgba(139,92,246,0.15)" }}>
            Nenhum usuário vinculado. Adicione usuários para dar acesso ao portal.
          </div>
        )}
        {vinculados.map(vu => {
          const meta = getTipoMeta(vu.tipo_acesso);
          const Icon = meta.icon;
          return (
            <div key={vu.id} className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                {(vu.usuario_nome || vu.usuario_email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">{vu.usuario_nome || "—"}</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>{vu.usuario_email}</div>
              </div>

              {/* Tipo de acesso — select inline */}
              <select
                value={vu.tipo_acesso}
                onChange={e => alterarTipoMutation.mutate({ id: vu.id, tipo: e.target.value })}
                className="text-xs px-2 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: `${meta.color}10`, color: meta.color, border: `1px solid ${meta.color}30`, outline: "none", cursor: "pointer" }}>
                {TIPO_OPTS.map(t => (
                  <option key={t.val} value={t.val}>{t.label}</option>
                ))}
              </select>

              <button
                onClick={() => { if (window.confirm(`Remover acesso de ${vu.usuario_nome || vu.usuario_email}?`)) removerMutation.mutate(vu.id); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors hover:bg-red-500/20"
                style={{ color: "#6b7280" }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}