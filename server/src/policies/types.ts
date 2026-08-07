import type { AuthUser } from '../auth/types';

/** Resultado da checagem de escopo para list/get/update/delete:
 *  - null        -> sem restrição adicional (ex: admin vê tudo)
 *  - objeto      -> where extra do Prisma, ANDado com o resto da query
 *  - 'DENY'      -> usuário não tem nenhum acesso a essa entidade */
export type ScopeResult = Record<string, unknown> | 'DENY' | null;

export type EntityPolicy = {
  /** Restringe list/get ao subconjunto de registros visíveis para esse
   * usuário (equivalente a uma regra de leitura de Row-Level Security). */
  scopeWhere(user: AuthUser): Promise<ScopeResult>;
  /** Restringe update/delete. Se omitido, usa a mesma lógica de scopeWhere
   * (a maioria das entidades tem a mesma regra para leitura e escrita). Use
   * quando leitura é mais aberta que escrita (ex: Colaborador, PessoaContato,
   * ClientInteracao: todo mundo lê, só admin edita). */
  mutateWhere?(user: AuthUser): Promise<ScopeResult>;
  /** Equivalente à regra `create` do RLS: valida se o usuário pode criar um
   * registro com esses dados (ex: só na própria vertical). */
  canCreate(user: AuthUser, data: Record<string, unknown>): boolean;
  /** Algumas entidades têm regra de delete mais restrita que a de update
   * (ex: só admin/Diretor apagam, mas qualquer analista da vertical edita).
   * Se omitido, usa mutateWhere (ou scopeWhere). */
  canDelete?(user: AuthUser, record: Record<string, unknown>): boolean;
};
