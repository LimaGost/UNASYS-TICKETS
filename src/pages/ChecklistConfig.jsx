import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Save, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function ChecklistConfig() {
  const queryClient = useQueryClient();
  const [editingColumn, setEditingColumn] = useState(null);
  const [newItem, setNewItem] = useState("");

  const { data: kanbanConfigs = [] } = useQuery({
    queryKey: ["kanbanConfigs"],
    queryFn: () => api.entities.KanbanConfig.list(),
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ configId, columns }) =>
      api.entities.KanbanConfig.update(configId, { columns }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanbanConfigs"] });
      toast.success("Checklist atualizado com sucesso!");
      setEditingColumn(null);
    },
  });

  // Flatten all columns from all configs, keeping reference to parent config
  const sortedColumns = kanbanConfigs.flatMap((config) =>
    (config.columns || []).map((col, idx) => ({
      ...col,
      _configId: config.id,
      _configLabel: `${config.vertical} / ${config.ticket_type}`,
      _colIndex: idx,
      _allColumns: config.columns,
    }))
  ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleEdit = (column) => {
    setEditingColumn({
      _configId: column._configId,
      _colIndex: column._colIndex,
      _allColumns: column._allColumns,
      title: column.title,
      required_fields: column.required_fields || [],
    });
    setNewItem("");
  };

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    setEditingColumn({
      ...editingColumn,
      required_fields: [...editingColumn.required_fields, newItem.trim()],
    });
    setNewItem("");
  };

  const handleRemoveItem = (index) => {
    setEditingColumn({
      ...editingColumn,
      required_fields: editingColumn.required_fields.filter((_, i) => i !== index),
    });
  };

  const handleSave = () => {
    const updatedColumns = editingColumn._allColumns.map((col, idx) =>
      idx === editingColumn._colIndex
        ? { ...col, required_fields: editingColumn.required_fields }
        : col
    );
    updateConfigMutation.mutate({
      configId: editingColumn._configId,
      columns: updatedColumns,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurar Checklists"
        subtitle="Configure os requisitos para cada etapa do Kanban"
      />

      {sortedColumns.length === 0 && (
        <p className="text-gray-500 text-sm">Nenhuma coluna Kanban encontrada. Configure os Kanbans primeiro.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedColumns.map((column, i) => {
          const isEditing = editingColumn?._configId === column._configId && editingColumn?._colIndex === column._colIndex;
          const items = isEditing ? editingColumn.required_fields : column.required_fields || [];

          return (
            <motion.div
            key={`${column._configId}-${column._colIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: column.color || "#8B5CF6" }}
                        />
                        <span className="text-white text-sm">{column.title}</span>
                      </div>
                      <span className="text-xs text-gray-500 ml-5">{column._configLabel}</span>
                    </div>
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(column)}
                        className="text-[#8B5CF6] hover:text-[#A78BFA]"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">
                      Nenhum requisito configurado
                    </p>
                  ) : (
                    <AnimatePresence>
                      {items.map((item, idx) => (
                        <motion.div
                          key={`${column.id}-${idx}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex items-center gap-2 bg-[#0B0D15] rounded-lg p-2 border border-[rgba(139,92,246,0.1)]"
                        >
                          <div className="flex-1 text-sm text-gray-300">{item}</div>
                          {isEditing && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveItem(idx)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}

                  {isEditing && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 pt-2 border-t border-[rgba(139,92,246,0.1)]"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={newItem}
                          onChange={(e) => setNewItem(e.target.value)}
                          placeholder="Novo item do checklist..."
                          className="text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddItem();
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={handleAddItem}
                          className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingColumn(null)}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Salvar
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}