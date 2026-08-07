import { useAuth } from '@/lib/AuthContext';

// Páginas permitidas ao Analista Interno (implantação, suporte, agenda, conhecimento, templates)
const INTERNO_PAGES = new Set([
  'UserProfile',
  'Tickets',
  'Suporte',
  'TicketDetail',
  'ImplantacaoAtendimentos',
  'Agenda',
  'KnowledgeBase',
  'ResponseTemplates',
]);

// Páginas exclusivas do Diretor (e admins)
const DIRETOR_ONLY_PAGES = new Set(['DiretorDashboard', 'Users', 'Admin']);

/**
 * Níveis de acesso do sistema:
 * - diretor: acesso total, todas as verticais, painel do diretor
 * - senior:  acesso a tudo (exceto páginas do diretor), restrito à sua vertical
 * - interno: só implantação, suporte, agenda, base de conhecimento e templates; restrito à sua vertical
 */
export function usePermissions() {
  const { user } = useAuth();
  const cargo = user?.cargo || user?.data?.cargo || '';
  const isAdmin = user?.role === 'admin';

  const nivel =
    isAdmin || cargo === 'Diretor' ? 'diretor'
    : cargo === 'Analista Interno' ? 'interno'
    : 'senior'; // "Analista Senior" e cargos legados (Analista, Supervisor, Gerente)

  const canAccessPage = (page) => {
    if (!page) return true;
    if (nivel === 'diretor') return true;
    if (DIRETOR_ONLY_PAGES.has(page)) return false;
    if (nivel === 'interno') return INTERNO_PAGES.has(page);
    return true;
  };

  return {
    nivel,
    isDiretor: cargo === 'Diretor',
    isSenior: nivel === 'senior',
    isInternoRestrito: nivel === 'interno',
    canAccessPage,
  };
}