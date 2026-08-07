import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Building2, Palette } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";

export default function VerticalConfig() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingVertical, setEditingVertical] = useState(null);
  const [formData, setFormData] = useState({ name: "", code: "", description: "", color: "#8B5CF6" });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingVertical?.id) {
        return api.entities.Vertical.update(editingVertical.id, data);
      }
      return api.entities.Vertical.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verticals"] });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Vertical.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["verticals"] }),
  });

  const handleOpen = (vertical = null) => {
    if (vertical) {
      setEditingVertical(vertical);
      setFormData({
        name: vertical.name,
        code: vertical.code,
        description: vertical.description || "",
        color: vertical.color || "#8B5CF6",
      });
    } else {
      setEditingVertical(null);
      setFormData({ name: "", code: "", description: "", color: "#8B5CF6" });
    }
    setShowDialog(true);
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditingVertical(null);
    setFormData({ name: "", code: "", description: "", color: "#8B5CF6" });
  };

  const handleSave = () => {
    if (!formData.name || !formData.code) return;
    saveMutation.mutate({ ...formData, active: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuração de Verticais"
        subtitle="Gerencie as verticais de negócio do sistema"
        action={
          <Button onClick={() => handleOpen()} className="bg-[#8B5CF6] hover:bg-[#7C3AED] gap-2">
            <Plus className="w-4 h-4" />
            Nova Vertical
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {verticals.map((vertical) => (
          <Card
            key={vertical.id}
            className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => handleOpen(vertical)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${vertical.color}20` }}
                  >
                    <Building2 className="w-5 h-5" style={{ color: vertical.color }} />
                  </div>
                  <div>
                    <CardTitle className="text-foreground text-base">{vertical.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Código: {vertical.code}</p>
                  </div>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Tem certeza que deseja excluir a vertical "${vertical.name}"?`)) {
                      deleteMutation.mutate(vertical.id);
                    }
                  }}
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            {vertical.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{vertical.description}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingVertical ? "Editar Vertical" : "Nova Vertical"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Nome da Vertical</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Retail"
              />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Código Único</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="Ex: retail"
                disabled={!!editingVertical}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usado internamente. Não pode ser alterado após criação.
              </p>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Descrição (opcional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva a vertical..."
                className="min-h-[80px]"
              />
            </div>

            <div>
              <Label className="text-muted-foreground text-xs mb-2 block">Cor de Identificação</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-10 rounded border border-border cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#8B5CF6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {editingVertical ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}