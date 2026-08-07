// Formato do usuário autenticado, usado em todo o backend (policies, controllers,
// rotas de função). É o mesmo objeto que api.auth.me() retorna no frontend.
export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string; // admin | user
  tipo_perfil: string | null; // interno | cliente
  vertical: string | null;
  cliente_vertical: string | null;
  cliente_implantacao_id: string | null;
  lojas_vinculadas: string[];
  cnpj_vinculado: string | null;
  can_access_all_verticals: boolean;
  cargo: string | null;
  avatar_url: string | null;
  email_signature: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
