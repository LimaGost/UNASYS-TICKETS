import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Link2, Sparkles, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function SmartKnowledgeSuggestions({ ticket }) {
  const [suggestions, setSuggestions] = useState([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: articles = [] } = useQuery({
    queryKey: ["knowledgeArticles"],
    queryFn: () => api.entities.KnowledgeArticle.filter({ status: "publicado" }),
  });

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => api.auth.me(),
  });

  const { data: linkedArticles = [] } = useQuery({
    queryKey: ["ticketKnowledge", ticket.id],
    queryFn: () => api.entities.TicketKnowledgeLink.filter({ ticket_id: ticket.id }),
  });

  useEffect(() => {
    if (!ticket || articles.length === 0) return;
    const ticketText = `${ticket.title} ${ticket.description} ${ticket.category} ${ticket.service_type}`.toLowerCase();
    const scoredArticles = articles
      .filter(a => a.vertical === ticket.vertical || a.vertical === "geral")
      .map(article => {
        let score = 0;
        const articleText = `${article.title} ${article.summary} ${article.content} ${article.tags?.join(" ")}`.toLowerCase();
        const titleWords = ticket.title.toLowerCase().split(" ").filter(w => w.length > 3);
        titleWords.forEach(word => {
          if (article.title.toLowerCase().includes(word)) score += 10;
          if (article.summary?.toLowerCase().includes(word)) score += 5;
        });
        if (ticket.category && article.category === ticket.category) score += 15;
        if (ticket.service_type && articleText.includes(ticket.service_type.toLowerCase())) score += 8;
        article.tags?.forEach(tag => { if (ticketText.includes(tag.toLowerCase())) score += 7; });
        ticketText.split(" ").filter(w => w.length > 4).forEach(keyword => { if (articleText.includes(keyword)) score += 2; });
        return { article, score };
      })
      .filter(({ score }) => score > 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setSuggestions(scoredArticles);
  }, [ticket, articles]);

  const linkArticleMutation = useMutation({
    mutationFn: async (articleId) => {
      const article = articles.find(a => a.id === articleId);
      return await api.entities.TicketKnowledgeLink.create({
        ticket_id: ticket.id, article_id: articleId,
        article_title: article?.title, linked_by_email: user.email, linked_by_name: user.full_name
      });
    },
    onSuccess: () => { queryClient.invalidateQueries(["ticketKnowledge", ticket.id]); toast.success("Artigo vinculado!"); }
  });

  const openArticle = (article) => {
    navigate(`/KnowledgeBase?article=${article.id}`);
  };

  const isAlreadyLinked = (articleId) => linkedArticles.some(l => l.article_id === articleId);

  if (suggestions.length === 0) return null;

  return (
    <>
      <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            Sugestões Inteligentes da Base de Conhecimento
          </h3>
        </div>

        <div className="space-y-2">
          {suggestions.map(({ article, score }) => (
            <Card key={article.id}
              className="bg-card border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer group"
              onClick={() => openArticle(article)}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
                      <p className="text-foreground text-xs font-medium line-clamp-1 group-hover:text-amber-500 transition-colors flex items-center gap-1">
                      {article.title}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                    </p>
                    </div>
                    <p className="text-muted-foreground text-[10px] line-clamp-1">{article.summary}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {article.category && (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] h-4">{article.category}</Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground">Relevância: {Math.min(Math.round(score * 5), 100)}%</span>
                    </div>
                  </div>
                  <Button size="sm"
                    onClick={(e) => { e.stopPropagation(); linkArticleMutation.mutate(article.id); }}
                    disabled={isAlreadyLinked(article.id)}
                    className="h-7 text-[10px] shrink-0 bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border-amber-500/25"
                    variant="outline">
                    <Link2 className="w-3 h-3 mr-1" />
                    {isAlreadyLinked(article.id) ? "Vinculado" : "Vincular"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-[10px] text-amber-600/60 dark:text-amber-500/60 mt-3 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Artigos sugeridos com base no título, categoria e tags do ticket
        </p>
      </div>


    </>
  );
}