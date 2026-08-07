import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Hook que retorna a vertical do usuário e funções para filtrar dados.
 * Diretor/admin (ou flag explícita) veem todas as verticais;
 * analistas (Senior e Interno) e clientes ficam restritos à vertical definida.
 */
export function useVerticalFilter() {
  const { user } = useAuth();
  const { nivel } = usePermissions();

  const isAdmin = user?.role === 'admin';
  const allFlag = !!(user?.can_access_all_verticals || user?.data?.can_access_all_verticals);

  const canAccessAllVerticals = isAdmin || nivel === 'diretor' || allFlag;

  const userVertical = canAccessAllVerticals
    ? null
    : (user?.vertical || user?.data?.vertical || user?.cliente_vertical || user?.data?.cliente_vertical || null);

  /**
   * Filtra um array de items pela vertical do usuário
   */
  const filterByVertical = (items = []) => {
    if (!items.length) return items;
    if (!userVertical || canAccessAllVerticals) return items;
    return items.filter(item => !item.vertical || item.vertical === userVertical);
  };

  /**
   * Cria um objeto de filtro para queries (filter por vertical)
   */
  const getVerticalFilter = () => {
    if (!userVertical || canAccessAllVerticals) return {};
    return { vertical: userVertical };
  };

  return {
    userVertical,
    canAccessAllVerticals,
    filterByVertical,
    getVerticalFilter
  };
}