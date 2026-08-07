import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

export type SearchKnowledgeInput = {
  query?: string;
  vertical?: string;
  category?: string;
  limit?: number;
};

/** Busca simples (sem IA) na base de conhecimento por título/conteúdo/
 * resumo/tags. Usada pelo painel de sugestões dentro do ticket. */
export async function searchKnowledgeHandler(req: Request, res: Response) {
  try {
    const { query, vertical, category, limit = 20 } = (req.body ?? {}) as SearchKnowledgeInput;

    const where: Record<string, unknown> = { status: 'publicado' };
    if (vertical && vertical !== 'geral') where.vertical = vertical;
    if (category) where.category = category;

    let articles = await prisma.knowledgeArticle.findMany({ where });

    if (query && query.trim()) {
      const term = query.toLowerCase();
      articles = articles.filter((a) => {
        const tags = (a.tags as string[]) || [];
        return (
          a.title?.toLowerCase().includes(term) ||
          a.content?.toLowerCase().includes(term) ||
          a.summary?.toLowerCase().includes(term) ||
          tags.some((t) => t.toLowerCase().includes(term))
        );
      });
      articles.sort((a, b) => {
        const aTitle = a.title?.toLowerCase().includes(term) ? 1 : 0;
        const bTitle = b.title?.toLowerCase().includes(term) ? 1 : 0;
        return bTitle - aTitle;
      });
    }

    articles = articles.slice(0, limit);

    return res.json({ success: true, results: articles, total: articles.length });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
}
