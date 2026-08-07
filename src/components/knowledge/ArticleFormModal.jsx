import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Upload, FileText, Video, Loader2, File, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { api } from "@/api/apiClient";
import { toast } from "sonner";

export default function ArticleFormModal({ open, onClose, article, onSuccess }) {
  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["knowledgeCategories"],
    queryFn: () => api.entities.KnowledgeCategory.list(),
  });

  const { data: allArticles = [] } = useQuery({
    queryKey: ["knowledgeArticles"],
    queryFn: () => api.entities.KnowledgeArticle.list(),
  });

  const queryClient = useQueryClient();

  const initialFormData = {
    title: "",
    summary: "",
    content: "",
    category: "",
    vertical: verticals.find(v => v.active)?.code || "",
    status: "publicado",
    type: "documento",
    tags: [],
    attachments: [],
    video_url: "",
    visible_to_client: false
  };

  const [formData, setFormData] = useState(initialFormData);

  // Filter categories by selected vertical
  const categories = allCategories.filter(c => c.vertical === formData.vertical);
  
  // Get existing tags for the selected vertical
  const existingTags = React.useMemo(() => {
    const tags = new Set();
    allArticles
      .filter(a => a.vertical === formData.vertical && a.tags)
      .forEach(a => a.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [allArticles, formData.vertical]);

  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  React.useEffect(() => {
    if (open) {
      if (article) {
        setFormData({
          title: article.title || "",
          summary: article.summary || "",
          content: article.content || "",
          category: article.category || "",
          vertical: article.vertical || verticals.find(v => v.active)?.code || "",
          status: article.status || "publicado",
          type: article.type || "documento",
          tags: article.tags || [],
          attachments: article.attachments || [],
          video_url: article.video_url || "",
          visible_to_client: article.visible_to_client || false
        });
      } else {
        setFormData({...initialFormData, vertical: verticals.find(v => v.active)?.code || ""});
      }
      setTagInput("");
      setShowTagDropdown(false);
    }
  }, [open, article, verticals]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.tag-input-container')) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tag) => {
    const tagToAdd = tag || tagInput.trim();
    if (tagToAdd && !formData.tags.includes(tagToAdd)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagToAdd]
      }));
      setTagInput("");
      setShowTagDropdown(false);
    }
  };

  const filteredTags = React.useMemo(() => {
    if (!tagInput) return existingTags;
    return existingTags.filter(tag => 
      tag.toLowerCase().includes(tagInput.toLowerCase())
    );
  }, [existingTags, tagInput]);

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📎 Iniciando upload:", file.name, file.type);
    setUploading(true);
    try {
      const response = await api.integrations.Core.UploadFile({ file });
      console.log("✅ Resposta do upload:", response);
      
      if (!response || !response.file_url) {
        console.error("❌ Resposta inválida:", response);
        toast.error("Erro: resposta inválida do servidor");
        setUploading(false);
        return;
      }
      
      const fileType = file.type.includes('pdf') ? 'pdf' : 
                      file.type.includes('image') ? 'image' :
                      file.type.includes('video') ? 'video' : 'other';
      
      const newAttachment = {
        file_url: response.file_url,
        file_name: file.name,
        file_type: fileType
      };
      
      console.log("📁 Novo anexo:", newAttachment);
      
      setFormData(prev => {
        const updated = {
          ...prev,
          attachments: [...(prev.attachments || []), newAttachment]
        };
        console.log("📋 FormData atualizado:", updated.attachments);
        return updated;
      });
      
      toast.success("Arquivo anexado com sucesso!");
    } catch (error) {
      console.error("❌ Erro no upload:", error);
      toast.error("Erro ao fazer upload: " + error.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.vertical) {
      toast.error("Título e vertical são obrigatórios");
      return;
    }

    if (formData.type === 'video' && !formData.video_url && formData.attachments.length === 0) {
      toast.error("Para tipo vídeo, adicione uma URL ou faça upload de um arquivo");
      return;
    }

    setSaving(true);
    try {
      if (article) {
        await api.entities.KnowledgeArticle.update(article.id, formData);
        toast.success("Artigo atualizado!");
      } else {
        await api.entities.KnowledgeArticle.create(formData);
        toast.success("Artigo criado!");
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType === 'pdf') return <File className="w-4 h-4 text-red-400" />;
    if (fileType === 'image') return <FileText className="w-4 h-4 text-blue-400" />;
    if (fileType === 'video') return <Video className="w-4 h-4 text-purple-400" />;
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary">
            {article ? "Editar Artigo" : "Novo Artigo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Título */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Título *</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: POP - Abertura de Loja"
              required
            />
          </div>

          {/* Tipo, Vertical e Status */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tipo *</label>
              <Select value={formData.type} onValueChange={(val) => setFormData(prev => ({ ...prev, type: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="documento">Documento</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="procedimento">Procedimento (POP)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Vertical *</label>
              <Select value={formData.vertical} onValueChange={(val) => setFormData(prev => ({ ...prev, vertical: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {verticals.filter(v => v.active).map(v => (
                    <SelectItem key={v.id} value={v.code}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <Select value={formData.status} onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publicado">Publicado</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Categoria</label>
            {showNewCategory ? (
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da nova categoria"
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={async () => {
                    if (newCategoryName.trim() && formData.vertical) {
                      await api.entities.KnowledgeCategory.create({
                        name: newCategoryName.trim(),
                        vertical: formData.vertical,
                        active: true,
                        order: categories.length
                      });
                      queryClient.invalidateQueries(["knowledgeCategories"]);
                      setFormData(prev => ({ ...prev, category: newCategoryName.trim() }));
                      setNewCategoryName("");
                      setShowNewCategory(false);
                      toast.success("Categoria criada!");
                    }
                  }}
                  className="shrink-0"
                >
                  Criar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryName("");
                  }}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={formData.category} onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.active).sort((a, b) => (a.order || 0) - (b.order || 0)).map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCategory(true)}
                  className="shrink-0"
                >
                  Nova
                </Button>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Resumo</label>
            <Textarea
              value={formData.summary}
              onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
              placeholder="Breve descrição do conteúdo"
              className="h-20"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2 relative tag-input-container">
            <label className="text-sm font-medium text-muted-foreground">Tags</label>
            <div className="relative">
              <Input
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setShowTagDropdown(true);
                }}
                onFocus={() => setShowTagDropdown(true)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Digite e pressione Enter"
              />
              
              {showTagDropdown && tagInput && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredTags.length > 0 && (
                    <div className="p-1">
                      <div className="text-xs text-muted-foreground px-2 py-1">Tags existentes</div>
                      {filteredTags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddTag(tag)}
                          className="w-full text-left px-3 py-2 hover:bg-muted rounded text-sm text-foreground transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                  {!existingTags.includes(tagInput.trim()) && tagInput.trim() && (
                    <div className="p-1 border-t border-border">
                      <div className="text-xs text-muted-foreground px-2 py-1">Criar nova tag</div>
                      <button
                        type="button"
                        onClick={() => handleAddTag()}
                        className="w-full text-left px-3 py-2 hover:bg-muted rounded text-sm text-primary transition-colors"
                      >
                        + Criar "{tagInput.trim()}"
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} className="bg-primary/15 text-primary pr-1">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1.5 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* URL do Vídeo - apenas se tipo for video */}
          {formData.type === 'video' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Video className="w-4 h-4" />
                URL do Vídeo (YouTube, Vimeo, etc)
              </label>
              <Input
                value={formData.video_url}
                onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          )}

          {/* Conteúdo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Conteúdo {formData.type !== 'video' && '*'}
            </label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Descreva o procedimento, instruções, etc..."
              className="h-40"
              required={formData.type !== 'video'}
            />
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Anexos (PDFs, Imagens, Vídeos)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.mp4,.mov,.avi"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload').click()}
                disabled={uploading}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Adicionar Arquivo
                  </>
                )}
              </Button>
            </div>
            {formData.attachments && formData.attachments.length > 0 && (
              <div className="space-y-2 mt-3">
                {formData.attachments.filter(att => att && att.file_url).map((att, idx) => (
                  <div key={att.file_url} className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {getFileIcon(att.file_type)}
                      <span className="text-sm text-foreground truncate">{att.file_name || 'Arquivo'}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveAttachment(formData.attachments.indexOf(att))} 
                      className="text-gray-500 hover:text-red-400 transition-colors p-1 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visível ao Cliente */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Compartilhar com clientes</p>
                <p className="text-xs text-muted-foreground">Artigo ficará visível no portal do cliente</p>
              </div>
            </div>
            <Switch
              checked={formData.visible_to_client || false}
              onCheckedChange={(val) => setFormData(prev => ({ ...prev, visible_to_client: val }))}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                article ? "Atualizar" : "Criar Artigo"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}