import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "../components/ui/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function CategoryConfig() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newForm, setNewForm] = useState({ name: "", vertical: "", color: "#8B5CF6", active: true });
  const [showNew, setShowNew] = useState(false);
  const [filterVertical, setFilterVertical] = useState("all");

  const { data: categories = [] } = useQuery({
    queryKey: ["serviceCategories"],
    queryFn: () => api.entities.ServiceCategory.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.ServiceCategory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceCategories"] });
      setNewForm({ name: "", vertical: "", color: "#8B5CF6", active: true });
      setShowNew(false);
      toast.success("Categoria criada!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.ServiceCategory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceCategories"] });
      setEditingId(null);
      toast.success("Categoria atualizada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.ServiceCategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceCategories"] });
      toast.success("Categoria removida!");
    },
  });

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditForm({ name: cat.name, vertical: cat.vertical, color: cat.color || "#8B5CF6", active: cat.active });
  };

  const filtered = filterVertical === "all"
    ? categories
    : categories.filter(c => c.vertical === filterVertical);

  const activeVerticals = verticals.filter(v => v.active !== false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        subtitle="Gerencie as categorias de chamados e suporte"
        action={
          <Button
            onClick={() => setShowNew(true)}
            className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Categoria
          </Button>
        }
      />

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Filtrar por vertical:</span>
        <Select value={filterVertical} onValueChange={setFilterVertical}>
          <SelectTrigger className="w-48 bg-[#161830] border-[rgba(139,92,246,0.2)] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
            <SelectItem value="all">Todas</SelectItem>
            {activeVerticals.map(v => (
              <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* New category form */}
      {showNew && (
        <Card className="bg-[#161830] border-[#8B5CF6]/40">
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-[#A78BFA] mb-3">Nova Categoria</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-gray-400 mb-1 block">Nome *</label>
                <Input
                  placeholder="Ex: Rede, Software..."
                  value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  className="bg-[#0B0D15] border-[rgba(139,92,246,0.2)] text-white"
                />
              </div>
              <div className="min-w-[160px]">
                <label className="text-xs text-gray-400 mb-1 block">Vertical *</label>
                <SearchableSelect
                  value={newForm.vertical}
                  onValueChange={v => setNewForm(f => ({ ...f, vertical: v }))}
                  options={activeVerticals.map(v => ({ value: v.code, label: v.name }))}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar vertical..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Cor</label>
                <input
                  type="color"
                  value={newForm.color}
                  onChange={e => setNewForm(f => ({ ...f, color: e.target.value }))}
                  className="h-9 w-14 rounded cursor-pointer border border-[rgba(139,92,246,0.2)] bg-[#0B0D15]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-1"
                  disabled={!newForm.name || !newForm.vertical}
                  onClick={() => createMutation.mutate(newForm)}
                >
                  <Check className="w-4 h-4" /> Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNew(false)} className="text-gray-400">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-10">Nenhuma categoria encontrada.</p>
        )}
        {filtered.map(cat => {
          const verticalName = verticals.find(v => v.code === cat.vertical)?.name || cat.vertical;
          const isEditing = editingId === cat.id;

          return (
            <Card key={cat.id} className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
              <CardContent className="py-3 px-4">
                {isEditing ? (
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <Input
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="bg-[#0B0D15] border-[rgba(139,92,246,0.3)] text-white"
                      />
                    </div>
                    <div className="min-w-[160px]">
                      <SearchableSelect
                        value={editForm.vertical}
                        onValueChange={v => setEditForm(f => ({ ...f, vertical: v }))}
                        options={activeVerticals.map(v => ({ value: v.code, label: v.name }))}
                        placeholder="Selecione"
                        searchPlaceholder="Buscar vertical..."
                      />
                    </div>
                    <input
                      type="color"
                      value={editForm.color || "#8B5CF6"}
                      onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                      className="h-9 w-14 rounded cursor-pointer border border-[rgba(139,92,246,0.2)] bg-[#0B0D15]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-1"
                        onClick={() => updateMutation.mutate({ id: cat.id, data: editForm })}>
                        <Check className="w-4 h-4" /> Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-gray-400">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color || "#8B5CF6" }}
                      />
                      <span className="text-white font-medium">{cat.name}</span>
                      <Badge className="text-xs bg-[#0B0D15] text-gray-400 border-[rgba(139,92,246,0.2)]">
                        {verticalName}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(cat)}
                        className="h-7 w-7 text-gray-400 hover:text-[#A78BFA]">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        onClick={() => { if (confirm(`Remover "${cat.name}"?`)) deleteMutation.mutate(cat.id); }}
                        className="h-7 w-7 text-gray-400 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}