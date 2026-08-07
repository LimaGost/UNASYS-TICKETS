import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "../components/ui/SearchableSelect";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Tag, Flag, Hash, ListChecks, Eye, EyeOff, AlertTriangle, GripVertical, Layers, ChevronDown, FolderOpen, Settings2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const fieldTypeLabels = {
  text: "Texto",
  number: "Número",
  date: "Data",
  select: "Seleção Única",
  multiselect: "Seleção Múltipla",
  badge: "Badge",
  flag: "Flag",
};

const fieldTypeIcons = {
  text: Hash,
  select: Tag,
  multiselect: Tag,
  date: Tag,
  number: Hash,
  badge: Tag,
  flag: Flag,
};

const emptyForm = {
  field_key: "",
  field_label: "",
  field_type: "text",
  field_options: [],
  default_value: "",
  required: false,
  visible_in_card: false,
  visible_in_detail: true,
  order: 0,
  section: "Informações",
  column_span: 1,
  icon: "",
  vertical: "",
  apply_to_ticket_types: [],
  active: true,
};

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export default function CustomFieldsConfig() {
  const queryClient = useQueryClient();
  const [selectedVertical, setSelectedVertical] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [optionInput, setOptionInput] = useState({ value: "", label: "", color: "#8B5CF6" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const optionValueRef = useRef(null);

  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: () => api.entities.TicketCustomField.list(),
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["serviceTypes"],
    queryFn: () => api.entities.ServiceType.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const activeVerticals = verticals.filter(v => v.active);

  // Auto-select first vertical
  useEffect(() => {
    if (activeVerticals.length > 0 && !selectedVertical) {
      setSelectedVertical(activeVerticals[0].code);
    }
  }, [activeVerticals, selectedVertical]);

  const filteredFields = customFields.filter(f => f.vertical === selectedVertical);
  const sortedFields = [...filteredFields].sort((a, b) => (a.order || 0) - (b.order || 0));

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.TicketCustomField.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields"] });
      toast.success("Campo criado com sucesso!");
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.TicketCustomField.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields"] });
      toast.success("Campo atualizado!");
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.TicketCustomField.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields"] });
      toast.success("Campo removido!");
      setDeleteConfirm(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => api.entities.TicketCustomField.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customFields"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (items) => {
      await Promise.all(
        items.map((f, i) =>
          (f.order || 0) === i ? null : api.entities.TicketCustomField.update(f.id, { order: i })
        ).filter(Boolean)
      );
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: ["customFields"] });
      const prev = queryClient.getQueryData(["customFields"]);
      const itemIds = new Set(items.map(i => i.id));
      const updated = (prev || []).map(f => {
        if (!itemIds.has(f.id)) return f;
        const newOrder = items.findIndex(i => i.id === f.id);
        return { ...f, order: newOrder };
      });
      queryClient.setQueryData(["customFields"], updated);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["customFields"], ctx.prev);
      toast.error("Erro ao reordenar");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["customFields"] }),
  });

  const handleDragEnd = ({ source, destination }) => {
    if (!destination || source.index === destination.index) return;
    const next = [...sortedFields];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    reorderMutation.mutate(next);
  };

  const openCreateModal = () => {
    setEditingField(null);
    setFormData({ ...emptyForm, vertical: selectedVertical, order: filteredFields.length });
    setOptionInput({ value: "", label: "", color: "#8B5CF6" });
    setModalOpen(true);
  };

  const openEditModal = (field) => {
    setEditingField(field);
    setFormData({
      field_key: field.field_key,
      field_label: field.field_label,
      field_type: field.field_type,
      field_options: field.field_options || [],
      default_value: field.default_value || "",
      required: field.required || false,
      visible_in_card: field.visible_in_card || false,
      visible_in_detail: field.visible_in_detail !== false,
      order: field.order || 0,
      section: field.section || "Informações",
      column_span: field.column_span || 1,
      icon: field.icon || "",
      vertical: field.vertical || selectedVertical,
      apply_to_ticket_types: field.apply_to_ticket_types || [],
      active: field.active !== false,
    });
    setOptionInput({ value: "", label: "", color: "#8B5CF6" });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingField(null);
    setOptionInput({ value: "", label: "", color: "#8B5CF6" });
    setServiceSearch("");
  };

  // Auto-generate key from label (only when creating)
  const handleLabelChange = (label) => {
    const update = { ...formData, field_label: label };
    if (!editingField) {
      update.field_key = slugify(label);
    }
    setFormData(update);
  };

  const handleAddOption = () => {
    if (!optionInput.value.trim()) return;
    const label = optionInput.label.trim() || optionInput.value.trim();
    setFormData({
      ...formData,
      field_options: [...formData.field_options, { value: optionInput.value.trim(), label, color: optionInput.color }],
    });
    setOptionInput({ value: "", label: "", color: "#8B5CF6" });
    setTimeout(() => optionValueRef.current?.focus(), 50);
  };

  const handleOptionKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOption();
    }
  };

  const handleRemoveOption = (index) => {
    setFormData({ ...formData, field_options: formData.field_options.filter((_, i) => i !== index) });
  };

  const handleSave = () => {
    if (!formData.field_key.trim() || !formData.field_label.trim()) {
      toast.error("Preencha o Label do campo!");
      return;
    }
    if (!formData.vertical) {
      toast.error("Selecione uma vertical!");
      return;
    }
    const needsOptions = ["select", "multiselect", "badge", "flag"].includes(formData.field_type);
    if (needsOptions && formData.field_options.length === 0) {
      toast.error("Adicione pelo menos uma opção para este tipo de campo!");
      return;
    }
    if (editingField) {
      updateMutation.mutate({ id: editingField.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const needsOptions = ["select", "multiselect", "badge", "flag"].includes(formData.field_type);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Seções existentes nesta vertical (deduplicated)
  const existingSections = [...new Set(
    sortedFields.map(f => f.section || "Informações").filter(Boolean)
  )];
  if (!existingSections.includes("Informações")) existingSections.unshift("Informações");

  // Agrupamento por seção para exibição
  const fieldsBySection = sortedFields.reduce((acc, f) => {
    const sec = f.section || "Informações";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(f);
    return acc;
  }, {});
  const sectionOrder = [...new Set(sortedFields.map(f => f.section || "Informações"))];

  // Section manager modal state
  const [sectionManagerOpen, setSectionManagerOpen] = useState(false);
  const [editingSections, setEditingSections] = useState([]); // [{name, originalName}]

  const openSectionManager = () => openSectionManagerClean();

  const moveSectionUp = (idx) => {
    if (idx === 0) return;
    const next = [...editingSections];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setEditingSections(next);
  };

  const moveSectionDown = (idx) => {
    if (idx === editingSections.length - 1) return;
    const next = [...editingSections];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setEditingSections(next);
  };

  const deleteSection = (idx) => {
    const secName = editingSections[idx].originalName;
    // Fields of deleted section will go to "Informações"
    setEditingSections(prev => prev.filter((_, i) => i !== idx));
    // Mark deleted so we can reassign fields on save
    setDeletedSections(prev => [...prev, secName]);
  };

  const [deletedSections, setDeletedSections] = useState([]);

  const openSectionManagerClean = () => {
    setEditingSections(sectionOrder.map(s => ({ name: s, originalName: s })));
    setDeletedSections([]);
    setSectionManagerOpen(true);
  };

  const saveSections = async () => {
    const updates = [];
    // Handle deleted sections: move their fields to "Informações"
    deletedSections.forEach(deletedSec => {
      if (deletedSec === "Informações") return;
      sortedFields.filter(f => (f.section || "Informações") === deletedSec).forEach(field => {
        updates.push(api.entities.TicketCustomField.update(field.id, { section: "Informações" }));
      });
    });
    // Handle reorder + rename
    editingSections.forEach((sec, secIdx) => {
      const fieldsInSection = sortedFields.filter(f => (f.section || "Informações") === sec.originalName);
      fieldsInSection.forEach((field, fieldIdx) => {
        const newOrder = secIdx * 1000 + fieldIdx;
        const needsUpdate = sec.name !== sec.originalName || (field.order || 0) !== newOrder;
        if (needsUpdate) {
          updates.push(api.entities.TicketCustomField.update(field.id, { section: sec.name, order: newOrder }));
        }
      });
    });
    if (updates.length > 0) {
      await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: ["customFields"] });
      toast.success("Seções atualizadas!");
    }
    setSectionManagerOpen(false);
  };

  // SectionCombobox state
  const [sectionSearch, setSectionSearch] = useState("");
  const [sectionDropOpen, setSectionDropOpen] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (sectionRef.current && !sectionRef.current.contains(e.target)) setSectionDropOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredSectionOptions = existingSections.filter(s =>
    s.toLowerCase().includes((sectionSearch || formData.section || "").toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campos Customizados"
        subtitle="Configure campos extras, flags e badges para os tickets"
        action={
          <Button onClick={openCreateModal} disabled={!selectedVertical} className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-2">
            <Plus className="w-4 h-4" /> Novo Campo
          </Button>
        }
      />

      {/* Vertical Tabs */}
      <div className="flex gap-2 flex-wrap border-b border-border pb-1">
        {activeVerticals.map((vertical) => {
          const count = customFields.filter(f => f.vertical === vertical.code).length;
          const isActive = selectedVertical === vertical.code;
          return (
            <button
              key={vertical.code}
              onClick={() => setSelectedVertical(vertical.code)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {vertical.name}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive ? "bg-white/20" : "bg-primary/20 text-primary"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Section manager button */}
      {sortedFields.length > 0 && sectionOrder.length > 0 && (
        <div className="flex justify-end -mt-2">
          <Button variant="outline" size="sm" onClick={openSectionManager} className="gap-1.5 text-xs h-7">
            <Settings2 className="w-3.5 h-3.5" /> Gerenciar Seções
          </Button>
        </div>
      )}

      {/* Fields Grid */}
      {sortedFields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-primary" />
          </div>
          <p className="text-foreground font-semibold text-lg mb-1">Nenhum campo configurado</p>
          <p className="text-muted-foreground text-sm mb-5">
            {selectedVertical ? "Crie o primeiro campo customizado para esta vertical." : "Selecione uma vertical para começar."}
          </p>
          {selectedVertical && (
            <Button onClick={openCreateModal} className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-2">
              <Plus className="w-4 h-4" /> Criar Primeiro Campo
            </Button>
          )}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="customFields" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
                {(() => {
                  let lastSection = null;
                  return sortedFields.map((field, idx) => {
                    const sec = field.section || "Informações";
                    const showHeader = sec !== lastSection;
                    lastSection = sec;
                    const Icon = fieldTypeIcons[field.field_type] || Tag;
                    return (
                      <React.Fragment key={field.id}>
                        {showHeader && (
                          <div className={`flex items-center gap-2 ${idx > 0 ? "mt-5" : ""} mb-1.5`}>
                            <FolderOpen className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">{sec}</span>
                            <div className="flex-1 h-px bg-primary/20" />
                            <span className="text-[10px] text-muted-foreground">
                              {sortedFields.filter(f => (f.section || "Informações") === sec).length} campo(s)
                            </span>
                          </div>
                        )}
                        <Draggable draggableId={field.id} index={idx}>
                          {(p, snapshot) => (
                            <div ref={p.innerRef} {...p.draggableProps} className={`select-none ${snapshot.isDragging ? "opacity-80 scale-[1.01] shadow-xl z-50" : ""}`}>
                              <div className={`flex items-center gap-3 bg-card border rounded-xl px-4 py-3 transition-all ${
                                field.active !== false ? "border-border hover:border-primary/40" : "border-border opacity-60"
                              } ${snapshot.isDragging ? "shadow-lg border-primary/60" : ""}`}>
                                <div {...p.dragHandleProps} className="cursor-grab active:cursor-grabbing flex-shrink-0 text-muted-foreground hover:text-foreground p-1 -ml-1">
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <span className="text-[11px] text-muted-foreground font-mono w-5 text-center flex-shrink-0">#{idx + 1}</span>
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Icon className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-shrink-0 w-48">
                                  <span className="text-foreground font-medium text-sm block leading-tight truncate">{field.field_label}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{field.field_key}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                  <Badge variant="outline" className="text-[10px]">{fieldTypeLabels[field.field_type] || field.field_type}</Badge>
                                  {field.required && <span className="text-[10px] text-orange-400 font-medium">Obrigatório</span>}
                                  {field.visible_in_card && <span className="text-[10px] text-green-400 font-medium">No Card</span>}
                                  {field.apply_to_ticket_types?.length > 0 && <span className="text-[10px] text-blue-400">{field.apply_to_ticket_types.length} serviço(s)</span>}
                                  {field.active === false && <span className="text-[10px] text-red-400 font-medium">Inativo</span>}
                                  {field.field_options?.slice(0, 4).map((opt, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: opt.color + "25", color: opt.color }}>
                                      {opt.label || opt.value}
                                    </span>
                                  ))}
                                  {field.field_options?.length > 4 && <span className="text-[10px] text-muted-foreground">+{field.field_options.length - 4}</span>}
                                </div>
                                <div className="flex gap-1 flex-shrink-0 ml-auto">
                                  <Button size="sm" variant="ghost" onClick={() => toggleActiveMutation.mutate({ id: field.id, active: field.active === false })}
                                    className={`h-7 w-7 p-0 ${field.active !== false ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground hover:text-green-400"}`}
                                    title={field.active !== false ? "Desativar" : "Ativar"}>
                                    {field.active !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => openEditModal(field)} className="h-7 w-7 p-0 text-muted-foreground hover:text-primary">
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(field)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      </React.Fragment>
                    );
                  });
                })()}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Excluir campo?
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            O campo <span className="text-foreground font-semibold">"{deleteConfirm?.field_label}"</span> será removido permanentemente. Dados já salvos nos tickets não serão afetados.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? "Removendo..." : "Sim, excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Manager Modal */}
      <Dialog open={sectionManagerOpen} onOpenChange={setSectionManagerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Gerenciar Seções
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1 mb-3">Reordene, renomeie ou exclua seções. Campos de seções excluídas são movidos para "Informações".</p>
          <div className="space-y-2">
            {editingSections.map((sec, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-2">
                <FolderOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <input
                  value={sec.name}
                  onChange={(e) => {
                    const next = [...editingSections];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setEditingSections(next);
                  }}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="Nome da seção"
                />
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {sortedFields.filter(f => (f.section || "Informações") === sec.originalName).length} campo(s)
                </span>
                <div className="flex gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => moveSectionUp(idx)}
                  disabled={idx === 0}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSectionDown(idx)}
                  disabled={idx === editingSections.length - 1}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteSection(idx)}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="Excluir seção (campos vão para Informações)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setSectionManagerOpen(false)}>Cancelar</Button>
            <Button onClick={saveSections} className="bg-[#8B5CF6] hover:bg-[#7C3AED]">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingField ? `Editar: ${editingField.field_label}` : "Novo Campo Customizado"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* Label + Key */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground">Label do Campo *</Label>
                <Input
                  value={formData.field_label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="ex: Prioridade Interna"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">
                  Chave *
                  {!editingField && <span className="text-[10px] text-muted-foreground ml-2">(gerada automaticamente)</span>}
                </Label>
                <Input
                  value={formData.field_key}
                  onChange={(e) => setFormData({ ...formData, field_key: e.target.value })}
                  placeholder="ex: prioridade_interna"
                  disabled={!!editingField}
                  className="disabled:opacity-50 font-mono text-sm"
                />
              </div>
            </div>

            {/* Type + Vertical + Section */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground">Tipo *</Label>
                <Select value={formData.field_type} onValueChange={(v) => setFormData({ ...formData, field_type: v, field_options: [] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(fieldTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">Vertical *</Label>
                <SearchableSelect
                  value={formData.vertical}
                  onValueChange={(v) => setFormData({ ...formData, vertical: v })}
                  options={activeVerticals.map(v => ({ value: v.code, label: v.name }))}
                  placeholder="Selecione..."
                  searchPlaceholder="Buscar vertical..."
                />
              </div>
              <div className="space-y-1.5" ref={sectionRef}>
                <Label className="text-foreground">Seção</Label>
                <div className="relative">
                  <div
                    className="flex items-center justify-between h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => { setSectionSearch(""); setSectionDropOpen(v => !v); }}
                  >
                    <span className={formData.section ? "text-foreground" : "text-muted-foreground"}>
                      {formData.section || "Informações"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </div>
                  {sectionDropOpen && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <input
                          autoFocus
                          value={sectionSearch}
                          onChange={(e) => setSectionSearch(e.target.value)}
                          placeholder="Buscar ou criar seção..."
                          className="w-full bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && sectionSearch.trim()) {
                              setFormData({ ...formData, section: sectionSearch.trim() });
                              setSectionDropOpen(false);
                            }
                          }}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto py-1">
                        {filteredSectionOptions.map(sec => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => { setFormData({ ...formData, section: sec }); setSectionDropOpen(false); setSectionSearch(""); }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted transition-colors ${formData.section === sec ? "text-primary font-medium" : "text-foreground"}`}
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            {sec}
                            {formData.section === sec && <span className="ml-auto text-[10px] text-primary">✓</span>}
                          </button>
                        ))}
                        {sectionSearch.trim() && !existingSections.includes(sectionSearch.trim()) && (
                          <button
                            type="button"
                            onClick={() => { setFormData({ ...formData, section: sectionSearch.trim() }); setSectionDropOpen(false); setSectionSearch(""); }}
                            className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-primary hover:bg-primary/5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                            Criar "{sectionSearch.trim()}"
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Options (for select/multiselect/badge/flag) */}
            {needsOptions && (
              <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
                <Label className="text-foreground font-semibold">Opções</Label>
                
                {/* Add option row */}
                <div className="flex gap-2">
                  <Input
                    ref={optionValueRef}
                    value={optionInput.value}
                    onChange={(e) => setOptionInput({ ...optionInput, value: e.target.value, label: optionInput.label || e.target.value })}
                    onKeyDown={handleOptionKeyDown}
                    placeholder="Valor (ex: alta)"
                    className="flex-1 text-sm"
                  />
                  <Input
                    value={optionInput.label}
                    onChange={(e) => setOptionInput({ ...optionInput, label: e.target.value })}
                    onKeyDown={handleOptionKeyDown}
                    placeholder="Label (ex: Alta)"
                    className="flex-1 text-sm"
                  />
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <input
                      type="color"
                      value={optionInput.color}
                      onChange={(e) => setOptionInput({ ...optionInput, color: e.target.value })}
                      className="w-full h-full rounded-lg cursor-pointer border border-[rgba(139,92,246,0.2)]"
                      style={{ padding: "2px" }}
                    />
                  </div>
                  <Button size="sm" onClick={handleAddOption} className="bg-[#8B5CF6] hover:bg-[#7C3AED] h-10 px-3 flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Pressione Enter ou clique + para adicionar</p>

                {/* Options list */}
                {formData.field_options.length > 0 && (
                  <div className="space-y-1.5">
                    {formData.field_options.map((opt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-card rounded-lg border border-border group">
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                          <span className="text-sm font-medium" style={{ color: opt.color }}>{opt.label || opt.value}</span>
                          {opt.value !== opt.label && (
                            <span className="text-[10px] text-muted-foreground font-mono">{opt.value}</span>
                          )}
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => handleRemoveOption(idx)}
                          className="h-6 w-6 p-0 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Apply to service types */}
            {(() => {
              const availableServices = serviceTypes.filter(st => st.active && (!formData.vertical || st.vertical === formData.vertical));
              if (availableServices.length === 0) return null;
              const filteredServices = availableServices.filter(st =>
                st.name.toLowerCase().includes(serviceSearch.toLowerCase())
              );
              const selectedCount = formData.apply_to_ticket_types?.length || 0;
              return (
                <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground font-semibold flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-[#8B5CF6]" />
                      Tipos de Serviço
                      <span className="text-[10px] text-muted-foreground font-normal">(vazio = todos)</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      {selectedCount > 0 && (
                        <span className="text-[10px] text-[#A78BFA] font-semibold">{selectedCount} selecionado(s)</span>
                      )}
                      {selectedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, apply_to_ticket_types: [] })}
                          className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder="Buscar tipo de serviço..."
                      className="w-full bg-background border border-border focus:border-primary focus:outline-none rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {filteredServices.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-1">Nenhum serviço encontrado</p>
                    ) : (
                      filteredServices.map(service => {
                        const selected = formData.apply_to_ticket_types?.includes(service.name);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => {
                              const current = formData.apply_to_ticket_types || [];
                              setFormData({
                                ...formData,
                                apply_to_ticket_types: selected
                                  ? current.filter(s => s !== service.name)
                                  : [...current, service.name],
                              });
                            }}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                              selected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                          >
                            {service.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "required", label: "Obrigatório", desc: "Impede salvar sem preencher" },
                { key: "visible_in_card", label: "Visível no Card", desc: "Aparece no Kanban" },
                { key: "active", label: "Campo Ativo", desc: "Campo disponível nos tickets" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-medium">{label}</span>
                    <Switch
                      checked={formData[key]}
                      onCheckedChange={(v) => setFormData({ ...formData, [key]: v })}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
              ))}

              {/* Largura do campo */}
              <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm font-medium">Largura Inteira</span>
                  <Switch
                    checked={formData.column_span === 2}
                    onCheckedChange={(v) => setFormData({ ...formData, column_span: v ? 2 : 1 })}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">{formData.column_span === 2 ? "Ocupa a linha toda" : "Divide com outro campo"}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#8B5CF6] hover:bg-[#7C3AED] min-w-[120px]">
              {isSaving ? "Salvando..." : editingField ? "Salvar Alterações" : "Criar Campo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}