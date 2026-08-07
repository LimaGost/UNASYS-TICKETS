import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Clock, Pencil, Trash2, ChevronDown, ChevronRight, ListChecks, GripVertical, X } from "lucide-react";
import { toast } from "sonner";

const FREQ_LABELS = { diaria: "Diária", semanal: "Semanal", mensal: "Mensal", eventual: "Eventual" };
const FREQ_COLORS = { diaria: "text-green-400 bg-green-400/10 border-green-400/20", semanal: "text-blue-400 bg-blue-400/10 border-blue-400/20", mensal: "text-orange-400 bg-orange-400/10 border-orange-400/20", eventual: "text-gray-400 bg-gray-400/10 border-gray-400/20" };

const EMPTY_FORM = { title: "", description: "", frequency: "diaria", category: "", vertical: "", responsible: "", estimated_minutes: "", steps: [] };

export default function DailyRoutinesPanel({ verticals = [] }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expanded, setExpanded] = useState({});
  const [newStep, setNewStep] = useState("");
  const [filterFreq, setFilterFreq] = useState("all");

  const { data: routines = [] } = useQuery({
    queryKey: ["dailyRoutines"],
    queryFn: () => api.entities.DailyRoutine.filter({ active: true }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, estimated_minutes: data.estimated_minutes ? Number(data.estimated_minutes) : undefined, active: true };
      if (editing) await api.entities.DailyRoutine.update(editing.id, payload);
      else await api.entities.DailyRoutine.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries(["dailyRoutines"]);
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setNewStep("");
      toast.success(editing ? "Rotina atualizada!" : "Rotina criada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.DailyRoutine.update(id, { active: false }),
    onSuccess: () => { qc.invalidateQueries(["dailyRoutines"]); toast.success("Rotina removida!"); },
  });

  const handleOpen = (routine = null) => {
    setEditing(routine);
    setForm(routine ? {
      title: routine.title, description: routine.description || "", frequency: routine.frequency || "diaria",
      category: routine.category || "", vertical: routine.vertical || "", responsible: routine.responsible || "",
      estimated_minutes: routine.estimated_minutes || "", steps: routine.steps || []
    } : EMPTY_FORM);
    setNewStep("");
    setShowForm(true);
  };

  const addStep = () => {
    if (!newStep.trim()) return;
    setForm(p => ({ ...p, steps: [...p.steps, { order: p.steps.length + 1, text: newStep.trim() }] }));
    setNewStep("");
  };

  const removeStep = (idx) => {
    setForm(p => ({ ...p, steps: p.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })) }));
  };

  const filtered = filterFreq === "all" ? routines : routines.filter(r => r.frequency === filterFreq);

  const groups = filtered.reduce((acc, r) => {
    const key = r.category || "Geral";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Select value={filterFreq} onValueChange={setFilterFreq}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Frequências</SelectItem>
            {Object.entries(FREQ_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => handleOpen()} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Rotina
        </Button>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma rotina cadastrada</p>
          <p className="text-xs mt-1">Documente processos e rotinas do dia a dia</p>
        </div>
      )}

      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h3>
          <div className="space-y-2">
            {items.map(routine => {
              const isOpen = expanded[routine.id];
              return (
                <div key={routine.id} className="rounded-xl border border-border hover:border-primary/30 transition-all overflow-hidden bg-card">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer"
                    onClick={() => setExpanded(p => ({ ...p, [routine.id]: !p[routine.id] }))}
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{routine.title}</span>
                        <Badge className={`text-[10px] border ${FREQ_COLORS[routine.frequency]}`}>{FREQ_LABELS[routine.frequency]}</Badge>
                        {routine.estimated_minutes && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />{routine.estimated_minutes}min
                          </span>
                        )}
                        {routine.responsible && <span className="text-xs text-muted-foreground">• {routine.responsible}</span>}
                      </div>
                      {routine.description && <p className="text-xs text-muted-foreground mt-1 truncate">{routine.description}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleOpen(routine)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(routine.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && routine.steps && routine.steps.length > 0 && (
                    <div className="border-t border-border px-4 py-3 space-y-2">
                      {routine.steps.sort((a, b) => a.order - b.order).map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 bg-primary/20 text-primary">
                            {step.order}
                          </span>
                          <span className="text-sm text-foreground leading-relaxed">{step.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isOpen && (!routine.steps || routine.steps.length === 0) && (
                    <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                      {routine.description || "Sem passos definidos."}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Modal */}
      <Dialog open={showForm} onOpenChange={() => { setShowForm(false); setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">{editing ? "Editar Rotina" : "Nova Rotina"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); if (!form.title) return toast.error("Título obrigatório"); saveMutation.mutate(form); }} className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Título *</label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Abertura do dia" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Frequência *</label>
                <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Tempo (minutos)</label>
                <Input type="number" value={form.estimated_minutes} onChange={e => setForm(p => ({ ...p, estimated_minutes: e.target.value }))} placeholder="Ex: 30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Categoria</label>
                <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Financeiro, TI..." />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Responsável</label>
                <Input value={form.responsible} onChange={e => setForm(p => ({ ...p, responsible: e.target.value }))} placeholder="Ex: Suporte N1" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Vertical</label>
              <Select value={form.vertical || "none"} onValueChange={v => setForm(p => ({ ...p, vertical: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todas</SelectItem>
                  {verticals.filter(v => v.active).map(v => <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Descrição</label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detalhes da rotina..." className="h-20" />
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Passos / Checklist</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {form.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border">
                    <span className="text-xs font-bold text-primary w-5 text-center">{step.order}</span>
                    <span className="flex-1 text-sm text-foreground">{step.text}</span>
                    <button type="button" onClick={() => removeStep(i)} className="text-gray-500 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newStep}
                  onChange={e => setNewStep(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
                  placeholder="Adicionar passo (Enter para confirmar)"
                  className="text-sm"
                />
                <Button type="button" onClick={addStep} variant="outline" size="sm" className="shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editing ? "Salvar" : "Criar Rotina"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}