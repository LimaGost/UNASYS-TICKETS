import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { MOTIVO_LABELS, ESC_STATUS, fmtDuracao } from "./useDiretorData";

const EVENT_COLORS = {
  criacao: "#f97316", comentario: "#94a3b8", alteracao: "#8b5cf6",
  transferencia: "#f59e0b", decisao: "#06b6d4", solucao: "#22c55e", encerramento: "#ef4444",
};
const EVENT_LABELS = {
  criacao: "Motivo Inicial", comentario: "Comentário", alteracao: "Alteração",
  transferencia: "Transferência", decisao: "Decisão", solucao: "Solução", encerramento: "Encerramento",
};

export default function EscalationDetailModal({ escalation, ticket, internos, onClose }) {
  const qc = useQueryClient();
  const [comentario, setComentario] = useState("");
  const [tipoComentario, setTipoComentario] = useState("comentario");
  const [form, setForm] = useState({
    status: escalation.status || "aberto",
    responsavel_tratativa_email: escalation.responsavel_tratativa_email || "",
    plano_acao: escalation.plano_acao || "",
    causa_raiz: escalation.causa_raiz || "",
    licoes_aprendidas: escalation.licoes_aprendidas || "",
    acoes_preventivas: escalation.acoes_preventivas || "",
    necessidade_treinamento: escalation.necessidade_treinamento || false,
    tipo_falha: escalation.tipo_falha || "nenhuma",
    solucao_aplicada: escalation.solucao_aplicada || "",
    resultado_final: escalation.resultado_final || "",
  });

  const { data: currentUser } = useQuery({ queryKey: ["currentUser"], queryFn: () => api.auth.me() });
  const { data: eventos = [] } = useQuery({
    queryKey: ["esc-events", escalation.id],
    queryFn: () => api.entities.EscalationEvent.filter({ escalation_id: escalation.id }, "created_date", 200),
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      await api.entities.EscalationEvent.create({
        escalation_id: escalation.id,
        tipo: tipoComentario,
        descricao: comentario,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
      });
    },
    onSuccess: () => {
      setComentario("");
      qc.invalidateQueries({ queryKey: ["esc-events", escalation.id] });
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const responsavel = internos.find(u => u.email === form.responsavel_tratativa_email);
      const encerrando = ["resolvido", "encerrado"].includes(form.status) && !escalation.encerrado_em;
      await api.entities.Escalation.update(escalation.id, {
        ...form,
        responsavel_tratativa_nome: responsavel?.full_name || escalation.responsavel_tratativa_nome || "",
        ...(encerrando ? { encerrado_em: new Date().toISOString() } : {}),
      });
      const mudouStatus = form.status !== escalation.status;
      await api.entities.EscalationEvent.create({
        escalation_id: escalation.id,
        tipo: encerrando ? "encerramento" : mudouStatus ? "decisao" : "alteracao",
        descricao: encerrando
          ? `Tratativa encerrada com status "${ESC_STATUS[form.status]?.label}". ${form.resultado_final ? "Resultado: " + form.resultado_final : ""}`
          : mudouStatus
            ? `Status alterado de "${ESC_STATUS[escalation.status]?.label}" para "${ESC_STATUS[form.status]?.label}"`
            : "Tratativa atualizada (plano de ação / causa raiz / registros)",
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
      });
    },
    onSuccess: () => {
      toast.success("Tratativa salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["dir-escalations"] });
      qc.invalidateQueries({ queryKey: ["esc-events", escalation.id] });
      onClose();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const tempoAte = escalation.ticket_created_date ? new Date(escalation.created_date) - new Date(escalation.ticket_created_date) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            Escalonamento — #{escalation.ticket_number || ""} {escalation.ticket_title}
          </DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/40 border border-border rounded-lg p-3">
          <div><span className="text-muted-foreground block">Cliente</span><strong>{escalation.client_name || "—"}</strong></div>
          <div><span className="text-muted-foreground block">Nível</span><strong>Nível {escalation.nivel || 1}</strong></div>
          <div><span className="text-muted-foreground block">Categoria</span><strong>{MOTIVO_LABELS[escalation.motivo_categoria] || "Outro"}</strong></div>
          <div><span className="text-muted-foreground block">Tempo até escalonar</span><strong>{fmtDuracao(tempoAte)}</strong></div>
          <div><span className="text-muted-foreground block">Escalado por</span><strong>{escalation.escalated_by_nome || "—"}</strong></div>
          <div><span className="text-muted-foreground block">Escalado para</span><strong>{escalation.escalated_to_nome || "—"}</strong></div>
          <div><span className="text-muted-foreground block">Responsável (ticket)</span><strong>{escalation.colaborador_nome || "—"}</strong></div>
          <div>
            <span className="text-muted-foreground block">Ticket</span>
            {ticket ? (
              <Link to={`/ticket/${ticket.id}`} className="text-primary hover:underline inline-flex items-center gap-1 font-medium">
                Abrir <ExternalLink className="w-3 h-3" />
              </Link>
            ) : "—"}
          </div>
        </div>
        <div className="text-xs bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
          <span className="text-muted-foreground block mb-0.5">Motivo do escalonamento</span>
          {escalation.motivo}
        </div>

        {/* Timeline */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Linha do Tempo</h3>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {eventos.map(ev => (
              <div key={ev.id} className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: EVENT_COLORS[ev.tipo] || "#94a3b8" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    <span className="font-semibold" style={{ color: EVENT_COLORS[ev.tipo] || undefined }}>{EVENT_LABELS[ev.tipo] || ev.tipo}</span>
                    <span className="text-muted-foreground"> · {ev.user_name || ev.user_email || "Sistema"} · {new Date(ev.created_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-xs text-foreground mt-0.5">{ev.descricao}</div>
                </div>
              </div>
            ))}
            {eventos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento registrado</p>}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Select value={tipoComentario} onValueChange={setTipoComentario}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["comentario", "decisao", "transferencia", "solucao"].map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{EVENT_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Registrar comentário, decisão, transferência ou solução..." className="min-h-[36px] h-9 text-xs flex-1 resize-none" />
            <Button size="sm" className="h-9" disabled={!comentario.trim() || addEvent.isPending}
              onClick={() => addEvent.mutate()}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Tratativa */}
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Tratativa</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <Label className="text-xs text-muted-foreground">Situação atual</Label>
              <Select value={form.status} onValueChange={set("status")}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ESC_STATUS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Responsável pela tratativa</Label>
              <Select value={form.responsavel_tratativa_email} onValueChange={set("responsavel_tratativa_email")}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {internos.map(u => <SelectItem key={u.id} value={u.email} className="text-xs">{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tipo de falha</Label>
              <Select value={form.tipo_falha} onValueChange={set("tipo_falha")}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma" className="text-xs">Nenhuma</SelectItem>
                  <SelectItem value="processo" className="text-xs">Falha de Processo</SelectItem>
                  <SelectItem value="tecnica" className="text-xs">Falha Técnica</SelectItem>
                  <SelectItem value="operacional" className="text-xs">Falha Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ["plano_acao", "Plano de ação"],
              ["causa_raiz", "Causa raiz"],
              ["licoes_aprendidas", "Lições aprendidas"],
              ["acoes_preventivas", "Ações preventivas"],
              ["solucao_aplicada", "Solução aplicada"],
              ["resultado_final", "Resultado final"],
            ].map(([k, l]) => (
              <div key={k}>
                <Label className="text-xs text-muted-foreground">{l}</Label>
                <Textarea value={form[k]} onChange={e => set(k)(e.target.value)} className="mt-1 min-h-[60px] text-xs" />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <Checkbox checked={form.necessidade_treinamento} onCheckedChange={set("necessidade_treinamento")} />
            <span className="text-xs text-foreground">Necessidade de treinamento identificada</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar Tratativa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}