import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, GripVertical, Columns3, Tag, Wrench } from "lucide-react";
import { useVerticalFilter } from "@/hooks/useVerticalFilter";

function AdminSection({ title, icon: Icon, items, onAdd, onEdit, onDelete, nameField = "name", extraField }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#8B5CF6]" />
          <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        </div>
        <Button size="sm" onClick={onAdd} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-1.5 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id}
            className="flex items-center gap-3 px-3 py-2.5 bg-[#111322] rounded-lg border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.2)] transition-colors group">
            {item.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />}
            <span className="text-sm text-gray-300 flex-1">{item[nameField]}</span>
            {extraField && <span className="text-xs text-gray-600">{item[extraField]}</span>}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(item)} className="p-1 hover:text-[#8B5CF6] text-gray-600 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(item.id)} className="p-1 hover:text-[#EF4444] text-gray-600 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-600 text-center py-4">Nenhum item</p>}
      </div>
    </div>
  );
}

export default function Admin() {
  const queryClient = useQueryClient();
  const { filterByVertical } = useVerticalFilter();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  const { data: allColumns = [] } = useQuery({ queryKey: ["kanbanColumns"], queryFn: () => api.entities.KanbanColumn.list() });
  const { data: allCategories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => api.entities.ServiceCategory.list() });
  const { data: allServiceTypes = [] } = useQuery({ queryKey: ["serviceTypes"], queryFn: () => api.entities.ServiceType.list() });

  // Aplicar filtro de vertical
  const columns = filterByVertical(allColumns);
  const categories = filterByVertical(allCategories);
  const serviceTypes = filterByVertical(allServiceTypes);

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  const openForm = (type, item = null) => {
    setFormType(type);
    setEditingItem(item);
    if (type === "column") {
      setFormData(item ? { title: item.title, color: item.color || "#8B5CF6", order: item.order } : { title: "", color: "#8B5CF6", order: columns.length + 1 });
    } else {
      setFormData(item ? { name: item.name, color: item.color || "" } : { name: "", color: "" });
    }
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entityMap = { column: "KanbanColumn", category: "ServiceCategory", serviceType: "ServiceType" };
      const entity = api.entities[entityMap[formType]];
      if (editingItem) {
        await entity.update(editingItem.id, formData);
      } else {
        await entity.create(formData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }) => {
      const entityMap = { column: "KanbanColumn", category: "ServiceCategory", serviceType: "ServiceType" };
      await api.entities[entityMap[type]].delete(id);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Administração" subtitle="Configure o comportamento do sistema" />

      <Tabs defaultValue="columns" className="space-y-6">
        <TabsList className="bg-[#161830] border border-[rgba(139,92,246,0.15)]">
          <TabsTrigger value="columns" className="data-[state=active]:bg-[#8B5CF6]/20 data-[state=active]:text-[#A78BFA]">
            <Columns3 className="w-4 h-4 mr-1.5" /> Colunas Kanban
          </TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-[#8B5CF6]/20 data-[state=active]:text-[#A78BFA]">
            <Tag className="w-4 h-4 mr-1.5" /> Categorias
          </TabsTrigger>
          <TabsTrigger value="serviceTypes" className="data-[state=active]:bg-[#8B5CF6]/20 data-[state=active]:text-[#A78BFA]">
            <Wrench className="w-4 h-4 mr-1.5" /> Tipos de Serviço
          </TabsTrigger>
        </TabsList>

        <TabsContent value="columns">
          <div className="bg-[#161830] border border-[rgba(139,92,246,0.15)] rounded-xl p-6">
            <AdminSection
              title="Colunas do Kanban"
              icon={Columns3}
              items={sortedColumns}
              nameField="title"
              extraField="order"
              onAdd={() => openForm("column")}
              onEdit={(item) => openForm("column", item)}
              onDelete={(id) => deleteMutation.mutate({ type: "column", id })}
            />
          </div>
        </TabsContent>

        <TabsContent value="categories">
          <div className="bg-[#161830] border border-[rgba(139,92,246,0.15)] rounded-xl p-6">
            <AdminSection
              title="Categorias"
              icon={Tag}
              items={categories}
              onAdd={() => openForm("category")}
              onEdit={(item) => openForm("category", item)}
              onDelete={(id) => deleteMutation.mutate({ type: "category", id })}
            />
          </div>
        </TabsContent>

        <TabsContent value="serviceTypes">
          <div className="bg-[#161830] border border-[rgba(139,92,246,0.15)] rounded-xl p-6">
            <AdminSection
              title="Tipos de Serviço"
              icon={Wrench}
              items={serviceTypes}
              onAdd={() => openForm("serviceType")}
              onEdit={(item) => openForm("serviceType", item)}
              onDelete={(id) => deleteMutation.mutate({ type: "serviceType", id })}
            />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-[#161830] border-[rgba(139,92,246,0.2)] text-gray-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingItem ? "Editar" : "Adicionar"} {formType === "column" ? "Coluna" : formType === "category" ? "Categoria" : "Tipo de Serviço"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 mt-2">
            <div>
              <Label className="text-gray-400 text-xs">{formType === "column" ? "Título" : "Nome"} *</Label>
              <Input
                value={formType === "column" ? formData.title || "" : formData.name || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, [formType === "column" ? "title" : "name"]: e.target.value }))}
                required
                className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white mt-1"
              />
            </div>
            {(formType === "column" || formType === "category") && (
              <div>
                <Label className="text-gray-400 text-xs">Cor</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={formData.color || "#8B5CF6"}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent"
                  />
                  <Input
                    value={formData.color || "#8B5CF6"}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white flex-1"
                  />
                </div>
              </div>
            )}
            {formType === "column" && (
              <div>
                <Label className="text-gray-400 text-xs">Ordem</Label>
                <Input
                  type="number"
                  value={formData.order || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="bg-[#111322] border-[rgba(139,92,246,0.2)] text-white mt-1"
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}
                className="border-[rgba(139,92,246,0.2)] text-gray-400 hover:text-white">Cancelar</Button>
              <Button type="submit" className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}