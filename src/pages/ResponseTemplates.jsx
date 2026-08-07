import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FileText, TrendingUp, Search } from "lucide-react";
import ReactQuill from "react-quill";
import { toast } from "sonner";

export default function ResponseTemplates() {
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    category: "",
    subject: "",
    content: "",
    tags: [],
    vertical: "geral",
    main_type: "geral",
    active: true
  });
  const [tagInput, setTagInput] = useState("");

  const { data: templates = [] } = useQuery({
    queryKey: ["responseTemplates"],
    queryFn: () => api.entities.ResponseTemplate.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.ResponseTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responseTemplates"] });
      setShowModal(false);
      resetForm();
      toast.success("Template criado com sucesso!");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.ResponseTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responseTemplates"] });
      setShowModal(false);
      resetForm();
      toast.success("Template atualizado!");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ResponseTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responseTemplates"] });
      toast.success("Template excluído!");
    }
  });

  const resetForm = () => {
    setForm({
      name: "",
      category: "",
      subject: "",
      content: "",
      tags: [],
      vertical: "geral",
      main_type: "geral",
      active: true
    });
    setEditingTemplate(null);
  };

  const handleEdit = (template) => {
    setForm({
      name: template.name,
      category: template.category || "",
      subject: template.subject || "",
      content: template.content,
      tags: template.tags || [],
      vertical: template.vertical || "geral",
      main_type: template.main_type || "geral",
      active: template.active !== false
    });
    setEditingTemplate(template);
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error("Nome e conteúdo são obrigatórios");
      return;
    }

    const data = { ...form };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) });
  };

  const filteredTemplates = templates.filter(t => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.name?.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query) ||
      t.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const category = template.category || "Sem Categoria";
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates de Resposta"
        subtitle="Crie e gerencie respostas rápidas para perguntas frequentes"
        action={
          <Button onClick={() => { resetForm(); setShowModal(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Template
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Templates Grid */}
      <div className="space-y-6">
        {Object.entries(groupedTemplates).map(([category, temps]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              {category} ({temps.length})
              <div className="h-px flex-1 bg-border" />
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {temps.map(template => (
                <Card key={template.id} className="bg-card border-border hover:border-primary/40 transition-all group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-foreground text-sm line-clamp-1">
                          {template.name}
                        </CardTitle>
                        <CardDescription className="text-gray-500 text-xs mt-1 line-clamp-2">
                          {template.content?.replace(/<[^>]*>/g, '').substring(0, 80)}...
                        </CardDescription>
                      </div>
                      {template.usage_count > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <TrendingUp className="w-3 h-3" />
                          {template.usage_count}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {template.vertical && template.vertical !== "geral" && (
                        <Badge variant="outline" className="text-[9px] h-4">{template.vertical}</Badge>
                      )}
                      {template.main_type && template.main_type !== "geral" && (
                        <Badge className="bg-blue-500/20 text-blue-400 text-[9px] h-4">{template.main_type}</Badge>
                      )}
                      {template.tags?.slice(0, 2).map(tag => (
                       <Badge key={tag} className="bg-primary/10 text-primary text-[9px] h-4">{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(template)}
                        className="flex-1 h-8 text-xs"
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Excluir este template?")) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Nenhum template encontrado</p>
            <p className="text-sm mt-1">Crie seu primeiro template de resposta</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { setShowModal(false); resetForm(); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Template" : "Novo Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Nome do Template *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1"
                  placeholder="Ex: Resposta padrão de boas-vindas"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1"
                  placeholder="Ex: Boas-vindas, Suporte Técnico"
                />
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Assunto (para emails)</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1"
                placeholder="Assunto do email (opcional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Vertical</Label>
                <Select value={form.vertical} onValueChange={(v) => setForm({ ...form, vertical: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    {verticals.filter(v => v.active).map(v => (
                      <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Tipo de Ticket</Label>
                <Select value={form.main_type} onValueChange={(v) => setForm({ ...form, main_type: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    <SelectItem value="chamado">Chamado</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Tags</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  placeholder="Adicionar tag..."
                />
                <Button type="button" onClick={handleAddTag} size="sm">
                  Adicionar
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map(tag => (
                    <Badge key={tag} className="bg-primary/15 text-primary cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-muted-foreground text-xs">Conteúdo *</Label>
              <div className="mt-1">
                <ReactQuill
                  value={form.content}
                  onChange={(value) => setForm({ ...form, content: value })}
                  className="rounded-md"
                  theme="snow"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingTemplate ? "Atualizar" : "Criar"} Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}