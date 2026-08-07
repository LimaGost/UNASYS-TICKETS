import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, TrendingUp, Clock } from "lucide-react";
import { toast } from "sonner";

export default function TemplateSelector({ onSelectTemplate, mainType = "geral" }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ["responseTemplates"],
    queryFn: () => api.entities.ResponseTemplate.list(),
  });

  const incrementUsageMutation = useMutation({
    mutationFn: async (templateId) => {
      const template = templates.find(t => t.id === templateId);
      await api.entities.ResponseTemplate.update(templateId, {
        usage_count: (template.usage_count || 0) + 1
      });
    }
  });

  const filteredTemplates = templates.filter(t => {
    if (!t.active) return false;
    
    // Filter by main_type
    if (t.main_type !== "geral" && t.main_type !== mainType) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        t.name?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.content?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return true;
  }).sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));

  const handleSelect = (template) => {
    onSelectTemplate(template);
    incrementUsageMutation.mutate(template.id);
    setOpen(false);
    toast.success(`Template "${template.name}" aplicado`);
  };

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const category = template.category || "Outros";
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-[rgba(139,92,246,0.2)] text-gray-300 hover:text-white gap-2"
      >
        <FileText className="w-4 h-4" />
        Usar Template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-[#161830] border-[rgba(139,92,246,0.3)]">
          <DialogHeader>
            <DialogTitle className="text-white">Templates de Resposta</DialogTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#0B0D15] border-[rgba(139,92,246,0.2)] text-white"
              />
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 space-y-4 pr-2 custom-scrollbar">
            {Object.entries(groupedTemplates).map(([category, temps]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-[rgba(139,92,246,0.2)]" />
                  {category} ({temps.length})
                  <div className="h-px flex-1 bg-[rgba(139,92,246,0.2)]" />
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {temps.map(template => (
                    <Card
                      key={template.id}
                      className="bg-[#0B0D15] border-[rgba(139,92,246,0.15)] hover:border-[#8B5CF6]/40 transition-all cursor-pointer group"
                      onClick={() => handleSelect(template)}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-white text-sm line-clamp-1 group-hover:text-[#A78BFA] transition-colors">
                              {template.name}
                            </CardTitle>
                            <CardDescription className="text-gray-500 text-xs line-clamp-2 mt-1">
                              {template.content?.replace(/<[^>]*>/g, '').substring(0, 100)}...
                            </CardDescription>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {template.vertical && template.vertical !== "geral" && (
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {template.vertical}
                                </Badge>
                              )}
                              {template.tags?.slice(0, 3).map(tag => (
                                <Badge key={tag} className="bg-[#8B5CF6]/10 text-[#A78BFA] text-[10px] h-5">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          {template.usage_count > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-500 shrink-0">
                              <TrendingUp className="w-3 h-3" />
                              {template.usage_count}
                            </div>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum template encontrado</p>
                <p className="text-xs mt-1">Crie templates em Configurações</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}