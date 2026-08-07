import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, GripVertical } from "lucide-react";
import { toast } from "sonner";

export default function KnowledgeCategoryConfig() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    vertical: "",
    color: "#8B5CF6",
    icon: "Folder",
    order: 0,
    active: true
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["knowledgeCategories"],
    queryFn: () => api.entities.KnowledgeCategory.list(),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingCategory) {
        return api.entities.KnowledgeCategory.update(editingCategory.id, data);
      }
      return api.entities.KnowledgeCategory.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeCategories"] });
      setShowDialog(false);
      resetForm();
      toast.success(editingCategory ? "Categoria atualizada!" : "Categoria criada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.KnowledgeCategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeCategories"] });
      toast.success("Categoria excluída!");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      vertical: "",
      color: "#8B5CF6",
      icon: "Folder",
      order: 0,
      active: true
    });
    setEditingCategory(null);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData(category);
    setShowDialog(true);
  };

  const handleNew = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.vertical) {
      toast.error("Nome e vertical são obrigatórios");
      return;
    }
    saveMutation.mutate(formData);
  };

  const sortedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias de Conhecimento"
        subtitle="Gerencie as categorias da base de conhecimento"
        action={
          <Button onClick={handleNew} className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-2">
            <Plus className="w-4 h-4" />
            Nova Categoria
          </Button>
        }
      />

      <div className="grid gap-4">
        {sortedCategories.map((category) => (
          <Card
            key={category.id}
            className="bg-[#161830] border-[rgba(139,92,246,0.15)] hover:border-[#8B5CF6]/30 transition-colors"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-white text-base">{category.name}</CardTitle>
                      <Badge className="text-[10px]" style={{ backgroundColor: verticals.find(v => v.code === category.vertical)?.color + '30' }}>
                        {verticals.find(v => v.code === category.vertical)?.name || category.vertical}
                      </Badge>
                    </div>
                    {category.description && (
                      <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(category)}
                    className="text-[#8B5CF6] hover:text-[#A78BFA]"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Excluir categoria "${category.name}"?`)) {
                        deleteMutation.mutate(category.id);
                      }
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {sortedCategories.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Nenhuma categoria criada ainda</p>
            <p className="text-sm mt-2">Clique em "Nova Categoria" para começar</p>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#161830] border-[rgba(139,92,246,0.3)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-400 text-xs mb-2 block">Vertical *</Label>
              <Select value={formData.vertical} onValueChange={(v) => setFormData({ ...formData, vertical: v })}>
                <SelectTrigger className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white">
                  <SelectValue placeholder="Selecione a vertical" />
                </SelectTrigger>
                <SelectContent className="bg-[#161830] border-[rgba(139,92,246,0.2)]">
                  {verticals.filter(v => v.active).map(v => (
                    <SelectItem key={v.id} value={v.code} className="text-gray-200">
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-400 text-xs mb-2 block">Nome da Categoria *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Promoções, Remessas e Retorno"
                className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white"
              />
            </div>

            <div>
              <Label className="text-gray-400 text-xs mb-2 block">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional da categoria"
                className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400 text-xs mb-2 block">Cor</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="bg-[#111322] border-[rgba(139,92,246,0.2)] h-10"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs mb-2 block">Ordem</Label>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                  className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                resetForm();
              }}
              className="border-[rgba(139,92,246,0.2)] text-gray-400"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
            >
              {editingCategory ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}