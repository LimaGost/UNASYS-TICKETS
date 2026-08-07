import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Save, Plus, X, Edit2, Tag, Folder, Building2 } from "lucide-react";

export default function KnowledgeBaseSettings() {
  const queryClient = useQueryClient();
  const [editingVertical, setEditingVertical] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedVerticalForTag, setSelectedVerticalForTag] = useState("");
  const [newVerticalName, setNewVerticalName] = useState("");
  const [editingTag, setEditingTag] = useState(null);
  const [newTagName, setNewTagName] = useState("");

  const { data: systemConfigs = [] } = useQuery({
    queryKey: ["systemConfigs"],
    queryFn: () => api.entities.SystemConfig.list(),
  });

  const { data: verticalsDB = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["knowledgeCategories"],
    queryFn: () => api.entities.KnowledgeCategory.list(),
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["knowledgeArticles"],
    queryFn: () => api.entities.KnowledgeArticle.list(),
  });

  // Vertical mutations
  const createVerticalMutation = useMutation({
    mutationFn: (data) => api.entities.Vertical.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["verticals"]);
      toast.success("Vertical criada!");
      setNewVerticalName("");
    }
  });

  const updateVerticalMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Vertical.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["verticals"]);
      toast.success("Vertical atualizada!");
      setEditingVertical(null);
    }
  });

  const toggleVerticalMutation = useMutation({
    mutationFn: ({ id, active }) => api.entities.Vertical.update(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries(["verticals"]);
      toast.success("Status atualizado!");
    }
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data) => api.entities.KnowledgeCategory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["knowledgeCategories"]);
      toast.success("Categoria criada!");
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.KnowledgeCategory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["knowledgeCategories"]);
      toast.success("Categoria atualizada!");
      setEditingCategory(null);
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => api.entities.KnowledgeCategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["knowledgeCategories"]);
      toast.success("Categoria excluída!");
    }
  });

  // Tag mutations
  const renameTagMutation = useMutation({
    mutationFn: async ({ oldTag, newTag }) => {
      const articlesWithTag = articles.filter(a => a.tags?.includes(oldTag));
      await Promise.all(
        articlesWithTag.map(article =>
          api.entities.KnowledgeArticle.update(article.id, {
            tags: article.tags.map(t => t === oldTag ? newTag : t)
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["knowledgeArticles"]);
      toast.success("Tag renomeada!");
      setEditingTag(null);
      setNewTagName("");
    }
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tag) => {
      const articlesWithTag = articles.filter(a => a.tags?.includes(tag));
      await Promise.all(
        articlesWithTag.map(article =>
          api.entities.KnowledgeArticle.update(article.id, {
            tags: article.tags.filter(t => t !== tag)
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["knowledgeArticles"]);
      toast.success("Tag excluída de todos os artigos!");
    }
  });

  // Get existing tags from articles
  const getTagsByVertical = (verticalCode) => {
    const verticalArticles = articles.filter(a => a.vertical === verticalCode);
    const tags = [...new Set(verticalArticles.flatMap(a => a.tags || []))];
    return tags.sort();
  };

  const allExistingTags = [...new Set(articles.flatMap(a => a.tags || []))].sort();

  const handleCreateVertical = () => {
    if (!newVerticalName.trim()) {
      toast.error("Digite um nome para a vertical");
      return;
    }
    const code = newVerticalName.toLowerCase().replace(/\s+/g, '_');
    createVerticalMutation.mutate({
      name: newVerticalName,
      code: code,
      description: "",
      color: "#8B5CF6",
      active: true
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações - Base de Conhecimento"
        subtitle="Gerencie verticais, categorias, tags e outras configurações"
      />

      {/* Verticais */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#8B5CF6]" />
                Verticais
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Configure as verticais da base de conhecimento
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new vertical */}
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova vertical"
              value={newVerticalName}
              onChange={(e) => setNewVerticalName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateVertical()}
              className="flex-1 bg-[#0B0D15] border-[rgba(139,92,246,0.2)] text-white"
            />
            <Button
              onClick={handleCreateVertical}
              disabled={!newVerticalName.trim() || createVerticalMutation.isPending}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Existing verticals */}
          <div className="space-y-2">
            {verticalsDB.map(vertical => (
              <div
                key={vertical.id}
                className="flex items-center gap-3 p-3 bg-[#0B0D15] border border-[rgba(139,92,246,0.2)] rounded-lg"
              >
                <Switch
                  checked={vertical.active}
                  onCheckedChange={(checked) => toggleVerticalMutation.mutate({ id: vertical.id, active: checked })}
                />

                {editingVertical === vertical.id ? (
                  <Input
                    defaultValue={vertical.name}
                    onBlur={(e) => {
                      if (e.target.value !== vertical.name) {
                        updateVerticalMutation.mutate({
                          id: vertical.id,
                          data: { name: e.target.value }
                        });
                      } else {
                        setEditingVertical(null);
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                    autoFocus
                    className="flex-1 bg-[#161830] border-[rgba(139,92,246,0.2)] text-white"
                  />
                ) : (
                  <span className={`flex-1 text-sm ${vertical.active ? 'text-white' : 'text-gray-500'}`}>
                    {vertical.name}
                    <span className="text-xs text-gray-500 ml-2">({vertical.code})</span>
                  </span>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingVertical(vertical.id)}
                  className="text-gray-500 hover:text-[#8B5CF6]"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categorias */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Folder className="w-5 h-5 text-[#8B5CF6]" />
                Categorias
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Gerencie as categorias da base de conhecimento por vertical
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {verticalsDB.filter(v => v.active).map(vertical => {
            const verticalCategories = categories.filter(c => c.vertical === vertical.code && c.active);
            return (
              <div key={vertical.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#A78BFA]">{vertical.name}</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newCat = {
                        name: "Nova Categoria",
                        vertical: vertical.code,
                        active: true,
                        order: verticalCategories.length
                      };
                      createCategoryMutation.mutate(newCat);
                    }}
                    className="border-[#8B5CF6]/30 text-[#A78BFA] h-7 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {verticalCategories.length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-2">Nenhuma categoria nesta vertical</p>
                  ) : (
                    verticalCategories.sort((a, b) => (a.order || 0) - (b.order || 0)).map(cat => (
                      <div key={cat.id} className="flex items-center gap-2 p-2 bg-[#0B0D15] border border-[rgba(139,92,246,0.2)] rounded-lg">
                        {editingCategory === cat.id ? (
                          <Input
                            value={cat.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              updateCategoryMutation.mutate({ id: cat.id, data: { ...cat, name: newName } });
                            }}
                            onBlur={() => setEditingCategory(null)}
                            className="flex-1 h-8 bg-[#161830] border-[rgba(139,92,246,0.2)] text-white text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="flex-1 text-sm text-white">{cat.name}</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCategory(cat.id)}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-[#8B5CF6]"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Excluir categoria "${cat.name}"?`)) {
                              deleteCategoryMutation.mutate(cat.id);
                            }
                          }}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card className="bg-[#161830] border-[rgba(139,92,246,0.15)]">
        <CardHeader>
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#8B5CF6]" />
              Tags
            </CardTitle>
            <CardDescription className="text-gray-400 mt-1">
              Gerencie as tags da base de conhecimento
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm text-gray-300">Filtrar por Vertical</Label>
            <Select value={selectedVerticalForTag} onValueChange={setSelectedVerticalForTag}>
              <SelectTrigger className="bg-[#0B0D15] border-[rgba(139,92,246,0.2)] text-white">
                <SelectValue placeholder="Todas as verticais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todas as verticais</SelectItem>
                {verticalsDB.filter(v => v.active).map(v => (
                  <SelectItem key={v.code} value={v.code}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              {selectedVerticalForTag 
                ? `${getTagsByVertical(selectedVerticalForTag).length} tags em ${verticalsDB.find(v => v.code === selectedVerticalForTag)?.name}`
                : `${allExistingTags.length} tags no total`
              }
            </p>
            <div className="space-y-2">
              {(selectedVerticalForTag ? getTagsByVertical(selectedVerticalForTag) : allExistingTags).map(tag => {
                const count = selectedVerticalForTag
                  ? articles.filter(a => a.vertical === selectedVerticalForTag && a.tags?.includes(tag)).length
                  : articles.filter(a => a.tags?.includes(tag)).length;
                
                return (
                  <div
                    key={tag}
                    className="flex items-center gap-2 p-2 bg-[#0B0D15] border border-[rgba(139,92,246,0.2)] rounded-lg"
                  >
                    {editingTag === tag ? (
                      <Input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onBlur={() => {
                          if (newTagName && newTagName !== tag) {
                            renameTagMutation.mutate({ oldTag: tag, newTag: newTagName });
                          } else {
                            setEditingTag(null);
                            setNewTagName("");
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.target.blur();
                          }
                        }}
                        autoFocus
                        className="flex-1 h-8 bg-[#161830] border-[rgba(139,92,246,0.2)] text-white text-sm"
                      />
                    ) : (
                      <div className="flex-1 flex items-center gap-2">
                        <Badge className="bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30">
                          {tag}
                        </Badge>
                        <span className="text-xs text-gray-500">({count} {count === 1 ? 'artigo' : 'artigos'})</span>
                      </div>
                    )}
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingTag(tag);
                        setNewTagName(tag);
                      }}
                      className="h-7 w-7 p-0 text-gray-500 hover:text-[#8B5CF6]"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Excluir a tag "${tag}" de ${count} ${count === 1 ? 'artigo' : 'artigos'}?`)) {
                          deleteTagMutation.mutate(tag);
                        }
                      }}
                      className="h-7 w-7 p-0 text-gray-500 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
              {(selectedVerticalForTag ? getTagsByVertical(selectedVerticalForTag).length === 0 : allExistingTags.length === 0) && (
                <p className="text-xs text-gray-500 italic p-2">Nenhuma tag cadastrada ainda</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}