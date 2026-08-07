import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useVerticalFilter } from "@/hooks/useVerticalFilter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import PageHeader from "../components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, Plus, Eye, ThumbsUp, Edit, FileText, Video,
  BookOpen, Download, File, PlayCircle, Trash2, Link2,
  ListChecks, Users, Share2, X, Filter, SlidersHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ArticleFormModal from "../components/knowledge/ArticleFormModal";
import QuickLinksPanel from "../components/knowledge/QuickLinksPanel";
import DailyRoutinesPanel from "../components/knowledge/DailyRoutinesPanel";

const TYPE_CONFIG = {
  documento: { label: "Documento", color: "text-gray-400 bg-gray-400/10 border-gray-400/30", icon: FileText },
  video: { label: "Vídeo", color: "text-purple-400 bg-purple-400/10 border-purple-400/30", icon: Video },
  procedimento: { label: "POP", color: "text-blue-400 bg-blue-400/10 border-blue-400/30", icon: BookOpen },
};

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  const { userVertical } = useVerticalFilter();
  const [selectedVertical, setSelectedVertical] = useState(userVertical || "all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [mainTab, setMainTab] = useState("artigos");
  const [showFilters, setShowFilters] = useState(false);

  const queryClient = useQueryClient();
  const location = useLocation();

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["knowledgeArticles"],
    queryFn: () => api.entities.KnowledgeArticle.filter({ status: "publicado" }),
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["verticals"],
    queryFn: () => api.entities.Vertical.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["knowledgeCategories"],
    queryFn: () => api.entities.KnowledgeCategory.list(),
  });

  const incrementViewMutation = useMutation({
    mutationFn: async (articleId) => {
      const article = articles.find(a => a.id === articleId);
      if (article) await api.entities.KnowledgeArticle.update(articleId, { views: (article.views || 0) + 1 });
    },
    onSuccess: () => queryClient.invalidateQueries(["knowledgeArticles"]),
  });

  const markHelpfulMutation = useMutation({
    mutationFn: async (articleId) => {
      const article = articles.find(a => a.id === articleId);
      if (article) await api.entities.KnowledgeArticle.update(articleId, { helpful_count: (article.helpful_count || 0) + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["knowledgeArticles"]);
      toast.success("Obrigado pelo feedback!");
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: (id) => api.entities.KnowledgeArticle.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["knowledgeArticles"]);
      setSelectedArticle(null);
      toast.success("Artigo excluído!");
    },
  });

  // Abre artigo direto via ?article=<id>
  useEffect(() => {
    if (!articles.length) return;
    const params = new URLSearchParams(location.search);
    const articleId = params.get("article");
    if (articleId) {
      const found = articles.find(a => a.id === articleId);
      if (found) handleViewArticle(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, location.search]);

  const handleViewArticle = (article) => {
    setSelectedArticle(article);
    incrementViewMutation.mutate(article.id);
  };

  const handleEdit = (article) => {
    setEditingArticle(article);
    setShowArticleForm(true);
  };

  const handleDelete = (article) => {
    if (confirm(`Excluir "${article.title}"?`)) deleteArticleMutation.mutate(article.id);
  };

  const getVerticalName = (code) => verticals.find(v => v.code === code)?.name || code;
  const getVerticalColor = (code) => verticals.find(v => v.code === code)?.color;

  const getVideoEmbedUrl = (url) => {
    if (!url) return null;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com')) {
      const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  // Se o usuário tem vertical definida, restringir apenas àquela
  const activeVerticals = userVertical
    ? verticals.filter(v => v.active && v.code === userVertical)
    : verticals.filter(v => v.active);

  const filteredCategories = useMemo(() => {
    return categories
      .filter(c => c.active && (selectedVertical === "all" || c.vertical === selectedVertical))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories, selectedVertical]);

  const allTags = useMemo(() => {
    const base = selectedVertical === "all" ? articles : articles.filter(a => a.vertical === selectedVertical);
    return [...new Set(base.flatMap(a => a.tags || []))].sort();
  }, [articles, selectedVertical]);

  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      if (selectedVertical !== "all" && a.vertical !== selectedVertical) return false;
      if (selectedType !== "all" && a.type !== selectedType) return false;
      if (selectedCategory !== "all" && a.category !== selectedCategory) return false;
      if (selectedTags.length > 0 && !selectedTags.every(tag => a.tags?.includes(tag))) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.title?.toLowerCase().includes(q) ||
          a.summary?.toLowerCase().includes(q) ||
          a.content?.toLowerCase().includes(q) ||
          a.category?.toLowerCase().includes(q) ||
          a.tags?.some(t => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [articles, selectedVertical, selectedType, selectedCategory, selectedTags, searchQuery]);

  const activeFiltersCount = [
    selectedType !== "all",
    selectedCategory !== "all",
    selectedTags.length > 0,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedType("all");
    setSelectedCategory("all");
    setSelectedTags([]);
  };

  const hasAnyFilter = searchQuery || selectedType !== "all" || selectedCategory !== "all" || selectedTags.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Base de Conhecimento"
        subtitle="Artigos, procedimentos, vídeos e rotinas"
        action={
          mainTab === "artigos" ? (
            <Button onClick={() => { setEditingArticle(null); setShowArticleForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Conteúdo
            </Button>
          ) : null
        }
      />

      {/* Main Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-xl border border-border bg-muted">
        {[
          { key: "artigos", label: "Artigos & Docs", icon: BookOpen },
          { key: "links", label: "Links Úteis", icon: Link2 },
          { key: "rotinas", label: "Rotinas Diárias", icon: ListChecks },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              mainTab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {mainTab === "links" && <QuickLinksPanel verticals={verticals} />}
      {mainTab === "rotinas" && <DailyRoutinesPanel verticals={verticals} />}

      {mainTab === "artigos" && (
        <div className="space-y-4">

          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, conteúdo, tags, categoria..."
                className="w-full bg-card border border-border focus:border-primary focus:outline-none rounded-lg pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`gap-2 transition-colors ${showFilters || activeFiltersCount > 0 ? "text-primary border-primary/50 bg-primary/10" : ""}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>

          {/* Expandable Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-card rounded-xl border border-border space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-medium">Tipo</label>
                      <Select value={selectedType} onValueChange={setSelectedType}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os tipos</SelectItem>
                          <SelectItem value="documento">Documento</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                          <SelectItem value="procedimento">Procedimento (POP)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-medium">Categoria</label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as categorias</SelectItem>
                          {filteredCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      {hasAnyFilter && (
                        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9 w-full gap-2">
                          <X className="w-3.5 h-3.5" /> Limpar filtros
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {allTags.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium">Tags</label>
                            <div className="flex flex-wrap gap-2">
                          {allTags.map(tag => (
                            <button
                              key={tag}
                              onClick={() => setSelectedTags(prev =>
                                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                              )}
                              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                                selectedTags.includes(tag)
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                              }`}
                            >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter chips */}
          {hasAnyFilter && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtros ativos:</span>
              {searchQuery && (
                <Chip label={`"${searchQuery}"`} onRemove={() => setSearchQuery("")} />
              )}
              {selectedType !== "all" && (
                <Chip label={TYPE_CONFIG[selectedType]?.label || selectedType} onRemove={() => setSelectedType("all")} />
              )}
              {selectedCategory !== "all" && (
                <Chip label={selectedCategory} onRemove={() => setSelectedCategory("all")} />
              )}
              {selectedTags.map(tag => (
                <Chip key={tag} label={`#${tag}`} onRemove={() => setSelectedTags(prev => prev.filter(t => t !== tag))} />
              ))}
            </div>
          )}

          {/* Vertical Tabs */}
          <div className="flex gap-2 flex-wrap border-b border-border pb-1">
            {!userVertical && (
              <VerticalTab
                label="Todos"
                count={articles.length}
                active={selectedVertical === "all"}
                onClick={() => setSelectedVertical("all")}
              />
            )}
            {activeVerticals.map(v => (
              <VerticalTab
                key={v.code}
                label={v.name}
                count={articles.filter(a => a.vertical === v.code).length}
                active={selectedVertical === v.code}
                onClick={() => setSelectedVertical(v.code)}
                color={v.color}
              />
            ))}
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Carregando..." : (
                <>
                  <span className="text-foreground font-semibold">{filteredArticles.length}</span>
                  {" "}artigo{filteredArticles.length !== 1 ? "s" : ""} encontrado{filteredArticles.length !== 1 ? "s" : ""}
                  {hasAnyFilter && <span className="text-muted-foreground"> com filtros ativos</span>}
                </>
              )}
            </p>
          </div>

          {/* Articles Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-48 rounded-xl bg-muted animate-pulse border border-border" />
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <p className="text-foreground font-semibold text-lg mb-1">Nenhum conteúdo encontrado</p>
              <p className="text-muted-foreground text-sm mb-5">
                {hasAnyFilter ? "Tente ajustar os filtros de busca." : "Crie o primeiro artigo para esta vertical."}
              </p>
              {hasAnyFilter ? (
                <Button variant="outline" onClick={clearAllFilters} className="gap-2">
                  <X className="w-4 h-4" /> Limpar filtros
                </Button>
              ) : (
                <Button onClick={() => { setEditingArticle(null); setShowArticleForm(true); }} className="gap-2">
                  <Plus className="w-4 h-4" /> Criar Artigo
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredArticles.map((article, idx) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    idx={idx}
                    onView={handleViewArticle}
                    onEdit={handleEdit}
                    getVerticalName={getVerticalName}
                    getVerticalColor={getVerticalColor}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Article Detail Modal */}
          <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              {selectedArticle && (
                <div className="space-y-5">
                  <DialogHeader>
                    <div className="flex items-start gap-3">
                      <DialogTitle className="text-xl flex-1 leading-snug">{selectedArticle.title}</DialogTitle>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedArticle(null); handleEdit(selectedArticle); }} className="text-primary hover:bg-primary/10 h-8 w-8 p-0">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(selectedArticle)} className="text-red-400 hover:bg-red-500/10 h-8 w-8 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(() => {
                        const color = getVerticalColor(selectedArticle.vertical);
                        return (
                          <Badge style={color ? { background: color + "20", color, borderColor: color + "50" } : {}} className="border text-xs">
                            {getVerticalName(selectedArticle.vertical)}
                          </Badge>
                        );
                      })()}
                      {(() => {
                        const tc = TYPE_CONFIG[selectedArticle.type];
                        const Icon = tc?.icon || FileText;
                        return (
                          <Badge className={`${tc?.color || ""} border text-xs flex items-center gap-1`}>
                            <Icon className="w-3 h-3" /> {tc?.label || selectedArticle.type}
                          </Badge>
                        );
                      })()}
                      {selectedArticle.category && <Badge variant="outline" className="text-xs">{selectedArticle.category}</Badge>}
                      {selectedArticle.tags?.map(tag => (
                        <Badge key={tag} className="bg-primary/15 text-primary text-xs">#{tag}</Badge>
                      ))}
                      {selectedArticle.visible_to_client && (
                        <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1 text-xs">
                          <Share2 className="w-3 h-3" /> Compartilhado
                        </Badge>
                      )}
                    </div>
                  </DialogHeader>

                  {selectedArticle.summary && (
                    <div className="p-3 bg-muted border border-border rounded-lg">
                      <p className="text-muted-foreground text-sm leading-relaxed">{selectedArticle.summary}</p>
                    </div>
                  )}

                  {selectedArticle.type === 'video' && selectedArticle.video_url && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <iframe src={getVideoEmbedUrl(selectedArticle.video_url)} className="w-full h-full" allowFullScreen title={selectedArticle.title} />
                    </div>
                  )}
                  {selectedArticle.type === 'video' && !selectedArticle.video_url && selectedArticle.attachments?.find(att => att.file_type === 'video') && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <video src={selectedArticle.attachments.find(att => att.file_type === 'video').file_url} className="w-full h-full" controls />
                    </div>
                  )}

                  {selectedArticle.content && (
                    <div className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">
                      {selectedArticle.content}
                    </div>
                  )}

                  {selectedArticle.attachments?.filter(att => selectedArticle.type !== 'video' || att.file_type !== 'video').length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Anexos
                      </h3>
                      {selectedArticle.attachments.filter(att => selectedArticle.type !== 'video' || att.file_type !== 'video').map((att, idx) => (
                        <a key={idx} href={att.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-muted hover:bg-accent border border-border hover:border-primary rounded-lg transition-all group">
                          <div className="flex items-center gap-3">
                            <File className={`w-4 h-4 ${att.file_type === 'pdf' ? 'text-red-400' : att.file_type === 'image' ? 'text-blue-400' : 'text-gray-400'}`} />
                            <span className="text-sm text-foreground">{att.file_name}</span>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {selectedArticle.views || 0} views</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {selectedArticle.helpful_count || 0} útil</span>
                    </div>
                    <Button onClick={() => markHelpfulMutation.mutate(selectedArticle.id)} variant="outline" size="sm" className="gap-2">
                      <ThumbsUp className="w-3.5 h-3.5" /> Foi útil
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      <ArticleFormModal
        open={showArticleForm}
        onClose={() => { setShowArticleForm(false); setEditingArticle(null); }}
        article={editingArticle}
        onSuccess={() => queryClient.invalidateQueries(["knowledgeArticles"])}
      />
    </div>
  );
}

function Chip({ label, onRemove }) {
  return (
    <span className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-foreground transition-colors ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function VerticalTab({ label, count, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
      style={active ? { background: color ? `${color}20` : "hsl(var(--primary)/0.1)", borderBottom: `2px solid ${color || "hsl(var(--primary))"}` } : {}}
    >
      {label}
      {count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
          active ? "bg-foreground/15 text-foreground" : "bg-primary/15 text-primary"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ArticleCard({ article, idx, onView, onEdit, getVerticalName, getVerticalColor }) {
  const tc = TYPE_CONFIG[article.type] || TYPE_CONFIG.documento;
  const Icon = tc.icon;
  const vColor = getVerticalColor(article.vertical);

  const getThumbnail = () => {
    if (article.type === 'video' && article.video_url) {
      const match = article.video_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (match?.[1]) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
    }
    return article.attachments?.find(att => att.file_type === 'image')?.file_url;
  };

  const thumbnail = getThumbnail();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(idx * 0.04, 0.3) }}
    >
      <Card
        className="bg-card border-border hover:border-primary/40 transition-all cursor-pointer h-full group overflow-hidden"
        onClick={() => onView(article)}
      >
        {thumbnail && (
          <div className="relative h-36 overflow-hidden bg-muted">
            <img src={thumbnail} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => e.target.style.display = 'none'} />
            {article.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/25 transition-colors">
                <PlayCircle className="w-10 h-10 text-white drop-shadow-lg" />
              </div>
            )}
          </div>
        )}

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-foreground text-sm font-semibold line-clamp-2 flex-1 leading-snug">
              {article.title}
            </CardTitle>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(article); }}
              className="p-1.5 hover:bg-primary/10 rounded text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {vColor ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium" style={{ background: vColor + "20", color: vColor, borderColor: vColor + "40" }}>
                {getVerticalName(article.vertical)}
              </span>
            ) : (
              <Badge variant="outline" className="text-[10px]">{getVerticalName(article.vertical)}</Badge>
            )}
            <Badge className={`${tc.color} border text-[10px] flex items-center gap-1`}>
              <Icon className="w-2.5 h-2.5" /> {tc.label}
            </Badge>
            {article.visible_to_client && (
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] flex items-center gap-1">
                <Users className="w-2.5 h-2.5" /> Cliente
              </Badge>
            )}
          </div>

          {article.summary && (
            <CardDescription className="text-gray-500 text-xs line-clamp-2 mt-1.5 leading-relaxed">
              {article.summary}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-2 pt-0">
          {article.category && (
            <p className="text-[11px] text-gray-600">{article.category}</p>
          )}
          {article.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">#{tag}</span>
            ))}
            {article.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{article.tags.length - 3}</span>}
          </div>
          )}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.views || 0}</span>
            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {article.helpful_count || 0}</span>
            {article.attachments?.length > 0 && (
              <span className="flex items-center gap-1 ml-auto"><FileText className="w-3 h-3" /> {article.attachments.length}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}