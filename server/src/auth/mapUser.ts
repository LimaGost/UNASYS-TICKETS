import type { User } from '@prisma/client';
import type { AuthUser } from './types';

export function mapUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    tipo_perfil: user.tipo_perfil,
    vertical: user.vertical,
    cliente_vertical: user.cliente_vertical,
    cliente_implantacao_id: user.cliente_implantacao_id,
    lojas_vinculadas: Array.isArray(user.lojas_vinculadas)
      ? (user.lojas_vinculadas as string[])
      : [],
    cnpj_vinculado: user.cnpj_vinculado,
    can_access_all_verticals: user.can_access_all_verticals,
    cargo: user.cargo,
    avatar_url: user.avatar_url,
    email_signature: user.email_signature,
  };
}
