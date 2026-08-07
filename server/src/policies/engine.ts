import { prisma } from '../db/prisma';
import type { AuthUser } from '../auth/types';
import type { EntityPolicy, ScopeResult } from './types';

export const isAdmin = (user: AuthUser) => user.role === 'admin';
export const isDiretor = (user: AuthUser) => user.cargo === 'Diretor';
export const hasFullVerticalAccess = (user: AuthUser) =>
  isAdmin(user) || isDiretor(user) || user.can_access_all_verticals;

/** Só admin (ex: KanbanColumn, SystemConfig, SyncState, Colaborador escrita). */
export function adminOnly(): EntityPolicy {
  return {
    async scopeWhere(user) {
      return isAdmin(user) ? null : 'DENY';
    },
    canCreate(user) {
      return isAdmin(user);
    },
  };
}

/** Qualquer usuário autenticado lê tudo; a checagem de escrita fica a cargo
 * de canCreate/canDelete customizados (ex: Aviso, Vertical, PessoaContato). */
export function publicRead(opts: { createRoles?: string[] } = {}): EntityPolicy {
  return {
    async scopeWhere() {
      return null;
    },
    canCreate(user) {
      if (!opts.createRoles) return true;
      return opts.createRoles.includes(user.role);
    },
  };
}

type VerticalScopedOpts = {
  verticalField?: string;
  /** Campo extra (ex: assigned_to, client_email) que também dá acesso de leitura
   * mesmo fora da vertical do usuário (dono do registro). */
  ownerFields?: string[];
};

/** Padrão mais comum do sistema: admin/Diretor/can_access_all_verticals veem
 * tudo; demais usuários só veem registros da própria vertical (ou onde são
 * o "dono" via ownerFields). Cobre Ticket, Client, TicketType, ServiceType,
 * KanbanConfig, ResponseTemplate, AutomationRule, EscalationConfig etc. */
export function verticalScoped(opts: VerticalScopedOpts = {}): EntityPolicy {
  const verticalField = opts.verticalField ?? 'vertical';
  const ownerFields = opts.ownerFields ?? [];

  return {
    async scopeWhere(user): Promise<ScopeResult> {
      if (hasFullVerticalAccess(user)) return null;

      const or: Record<string, unknown>[] = [];
      if (user.vertical) or.push({ [verticalField]: user.vertical });
      for (const field of ownerFields) {
        or.push({ [field]: user.email });
      }
      if (or.length === 0) return 'DENY';
      return { OR: or };
    },
    canCreate(user, data) {
      if (hasFullVerticalAccess(user)) return true;
      const verticalMatches = !!user.vertical && data[verticalField] === user.vertical;
      const ownerMatches = ownerFields.some((field) => data[field] === user.email);
      return verticalMatches || ownerMatches;
    },
  };
}

/** Registro só é visível/editável pelo próprio dono (campo de e-mail), exceto
 * admin. Cobre Appointment, NotificationConfig, Notification, TicketSession. */
export function ownerScoped(field: string): EntityPolicy {
  return {
    async scopeWhere(user): Promise<ScopeResult> {
      if (isAdmin(user)) return null;
      return { [field]: user.email };
    },
    canCreate(user, data) {
      if (isAdmin(user)) return true;
      return data[field] === user.email;
    },
  };
}

type ParentScopedOpts = {
  /** nome do model Prisma pai, minúsculo (ex: 'clienteImplantacao') */
  parentModel: keyof typeof prisma;
  /** campo nesta entidade que referencia o pai (ex: 'cliente_implantacao_id') */
  localField: string;
  parentVerticalField?: string;
  /** campo de e-mail "dono" no pai (ex: usuario_email). Passe null quando o
   * pai não tiver esse conceito (ex: EtapaImplantacao só tem vertical). */
  parentOwnerField?: string | null;
};

/** Entidades "filhas" de ClienteImplantacao (DocumentoCliente, ImplantacaoLog,
 * ProgressoItem, ProgressoTreinamento, ImplantacaoUsuario, NotificacaoCliente):
 * o acesso é herdado do registro pai (mesma vertical OU o próprio usuário
 * cliente dono da implantação). Equivalente a um filtro "IN" de Row-Level
 * Security. */
export function parentScoped(opts: ParentScopedOpts): EntityPolicy {
  const verticalField = opts.parentVerticalField ?? 'vertical';
  const ownerField = opts.parentOwnerField === undefined ? 'usuario_email' : opts.parentOwnerField;

  return {
    async scopeWhere(user): Promise<ScopeResult> {
      if (isAdmin(user)) return null;

      const or: Record<string, unknown>[] = [];
      if (user.vertical) or.push({ [verticalField]: user.vertical });
      if (ownerField) or.push({ [ownerField]: user.email });
      if (or.length === 0) return 'DENY';

      const parentDelegate = prisma[opts.parentModel] as unknown as {
        findMany: (args: any) => Promise<{ id: string }[]>;
      };
      const parents = await parentDelegate.findMany({
        where: { OR: or },
        select: { id: true },
      });
      if (parents.length === 0) return 'DENY';
      return { [opts.localField]: { in: parents.map((p) => p.id) } };
    },
    canCreate() {
      // Validado na prática pela própria referência ao pai (o controller de
      // função/negócio associado já garante o vínculo correto ao criar).
      return true;
    },
  };
}

/** Entidades "filhas" de Ticket com regra de escopo diferenciada para
 * usuários internos (por vertical/assigned_to) vs clientes (por loja
 * vinculada/e-mail). Cobre TicketCustomData e TicketKnowledgeLink. */
export function ticketScoped(localField = 'ticket_id'): EntityPolicy {
  return {
    async scopeWhere(user): Promise<ScopeResult> {
      if (isAdmin(user)) return null;

      let where: Record<string, unknown>;
      if (user.tipo_perfil === 'cliente') {
        const or: Record<string, unknown>[] = [{ client_email: user.email }];
        if (user.lojas_vinculadas.length > 0) {
          or.push({ client_id: { in: user.lojas_vinculadas } });
        }
        where = { OR: or };
      } else {
        const or: Record<string, unknown>[] = [{ assigned_to: user.email }];
        if (user.vertical) or.push({ vertical: user.vertical });
        where = { OR: or };
      }

      const tickets = await prisma.ticket.findMany({ where, select: { id: true } });
      if (tickets.length === 0) return 'DENY';
      return { [localField]: { in: tickets.map((t) => t.id) } };
    },
    canCreate() {
      return true;
    },
  };
}

type KnowledgeScopedOpts = {
  /** exige visible_to_client=true para clientes verem (só usado em
   * KnowledgeArticle - ModuloTreinamento/KnowledgeCategory não têm esse campo) */
  requireVisibleToClientFlag?: boolean;
};

/** Leitura liberada para qualquer usuário autenticado, escrita restrita a
 * admin. Cobre Colaborador, PessoaContato. */
export function openReadAdminWrite(): EntityPolicy {
  return {
    async scopeWhere() {
      return null;
    },
    async mutateWhere(user) {
      return isAdmin(user) ? null : 'DENY';
    },
    canCreate(user) {
      return isAdmin(user);
    },
  };
}

/** Leitura e criação liberadas para qualquer usuário autenticado; edição e
 * exclusão só por admin ou pelo autor do registro. Cobre Aviso. */
export function openReadOwnerOrAdminWrite(ownerField: string): EntityPolicy {
  return {
    async scopeWhere() {
      return null;
    },
    async mutateWhere(user) {
      if (isAdmin(user)) return null;
      return { [ownerField]: user.email };
    },
    canCreate() {
      return true;
    },
  };
}

/** KnowledgeArticle, KnowledgeCategory, ModuloTreinamento: interno vê a
 * própria vertical; cliente vê a vertical vinculada à sua implantação
 * (e, quando aplicável, só o que está marcado como visível ao cliente). */
export function knowledgeScoped(opts: KnowledgeScopedOpts = {}): EntityPolicy {
  return {
    async scopeWhere(user): Promise<ScopeResult> {
      if (isAdmin(user)) return null;
      if (user.tipo_perfil === 'cliente') {
        if (!user.cliente_vertical) return 'DENY';
        return opts.requireVisibleToClientFlag
          ? { vertical: user.cliente_vertical, visible_to_client: true }
          : { vertical: user.cliente_vertical };
      }
      if (!user.vertical) return 'DENY';
      return { vertical: user.vertical };
    },
    // Escrita é só para usuários internos (clientes nunca editam a base de
    // conhecimento, mesmo o que conseguem ler) - por isso não reaproveita
    // scopeWhere aqui, que tem o ramo extra para tipo_perfil cliente.
    async mutateWhere(user): Promise<ScopeResult> {
      if (isAdmin(user)) return null;
      if (user.tipo_perfil !== 'interno' || !user.vertical) return 'DENY';
      return { vertical: user.vertical };
    },
    canCreate(user, data) {
      if (isAdmin(user)) return true;
      if (user.tipo_perfil !== 'interno') return false;
      return !!user.vertical && data.vertical === user.vertical;
    },
  };
}
