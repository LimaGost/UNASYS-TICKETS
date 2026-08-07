import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, BookOpen, Link2, Eye, ThumbsUp, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export default function KnowledgePanel({ ticketId }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const { data: linkedArticles = [] } = useQuery({
    queryKey: ["ticketKnowledge", ticketId],
    queryFn: () => api.entities.TicketKnowledgeLink.filter({ ticket_id: ticketId }),
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["knowledgeSearch", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const articles = await api.entities.KnowledgeArticle.filter({ status: "publicado" });
      const query = searchQuery.toLowerCase();
      return articles.filter(a =>
        a.title?.toLowerCase().includes(query) ||
        a.summary?.toLowerCase().includes(query) ||
        a.tags?.some(t => t.toLowerCase().includes(query))
      );
    },
    enabled: searchQuery.trim().length > 0
  });

  const linkArticleMutation = useMutation({
    mutationFn: async (articleId) => {
      const article = searchResults.find(a => a.id === articleId);
      return await api.entities.TicketKnowledgeLink.create({
        ticket_id: ticketId,
        article_id: articleId,
        article_title: article?.title,
        linked_by_email: user.email,
        linked_by_name: user.full_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["ticketKnowledge", ticketId]);
      toast.success("Artigo vinculado ao ticket!");
      setSearchQuery("");
    }
  });

  const unlinkArticleMutation = useMutation({
    mutationFn: async (linkId) => {
      await api.entities.TicketKnowledgeLink.delete(linkId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["ticketKnowledge", ticketId]);
      toast.success("Artigo desvinculado");
    }
  });

  const markHelpfulMutation = useMutation({
    mutationFn: async (linkId) => {
      await api.entities.TicketKnowledgeLink.update(linkId, { was_helpful: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["ticketKnowledge", ticketId]);
      toast.success("Marcado como útil!");
    }
  });

  const viewArticle = async (articleId) => {
    const article = await api.entities.KnowledgeArticle.get(articleId);
    setSelectedArticle(article);
    
    // Increment views
    await api.entities.KnowledgeArticle.update(articleId, {
      views: (article.views || 0) + 1
    });
  };

  const isAlreadyLinked = (articleId) => {
    return linkedArticles.some(l => l.article_id === articleId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-5 h-5 text-[#8B5CF6]" />
        <h3 className="text-sm font-semibold text-white">Base de Conhecimento</h3>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Buscar artigos para vincular..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#0B0D15] border-[rgba(139,92,246,0.2)] text-white h-9"
        />
      </div>

      {/* Search Results */}
      {searchQuery && searchResults.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
          {searchResults.map(article => (
            <Card
              key={article.id}
              className="bg-[#0B0D15] border-[rgba(139,92,246,0.1)] hover:border-[#8B5CF6]/30 transition-all cursor-pointer"
              onClick={() => viewArticle(article.id)}
            >
              <CardHeader className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-xs line-clamp-1">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="text-gray-500 text-[11px] line-clamp-1 mt-1">
                      {article.summary}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      linkArticleMutation.mutate(article.id);
                    }}
                    disabled={isAlreadyLinked(article.id)}
                    className="h-7 text-xs shrink-0"
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    {isAlreadyLinked(article.id) ? "Vinculado" : "Vincular"}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Linked Articles */}
      {linkedArticles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Artigos vinculados ({linkedArticles.length})</p>
          {linkedArticles.map(link => (
            <Card
              key={link.id}
              className="bg-[#161830] border-[rgba(139,92,246,0.15)] hover:border-[#8B5CF6]/30 transition-all"
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => viewArticle(link.article_id)}
                  >
                    <p className="text-white text-xs font-medium line-clamp-1">
                      {link.article_title}
                    </p>
                    <p className="text-gray-500 text-[10px] mt-1">
                      Por {link.linked_by_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!link.was_helpful && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markHelpfulMutation.mutate(link.id)}
                        className="h-7 w-7 p-0"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </Button>
                    )}
                    {link.was_helpful && (
                      <Badge variant="secondary" className="text-[9px] bg-green-500/20 text-green-400">
                        Útil
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => unlinkArticleMutation.mutate(link.id)}
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {linkedArticles.length === 0 && !searchQuery && (
        <div className="text-center text-gray-600 text-xs py-6">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Nenhum artigo vinculado</p>
          <p className="text-[10px] mt-1">Use a busca acima para vincular artigos relevantes</p>
        </div>
      )}

      {/* Article Modal */}
      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto bg-[#161830] border-[rgba(139,92,246,0.3)]">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">{selectedArticle.title}</DialogTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">{selectedArticle.vertical}</Badge>
                  {selectedArticle.category && (
                    <Badge className="bg-[#8B5CF6]/20 text-[#A78BFA]">{selectedArticle.category}</Badge>
                  )}
                </div>
              </DialogHeader>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}