import { prisma } from '../db/prisma';
import type { EntityPolicy } from './types';
import {
  adminOnly,
  hasFullVerticalAccess,
  isAdmin,
  isDiretor,
  knowledgeScoped,
  openReadAdminWrite,
  openReadOwnerOrAdminWrite,
  ownerScoped,
  parentScoped,
  publicRead,
  ticketScoped,
  verticalScoped,
} from './engine';

/** Nome da entidade (como usado nas rotas /api/entities/:entity e no
 * api.entities.X do frontend) -> { delegate do Prisma Client, policy de
 * autorização }. Isso é o que dá poder ao CRUD genérico: uma rota só, 48
 * comportamentos. */
export const entityRegistry: Record<
  string,
  { prismaModel: keyof typeof prisma; policy: EntityPolicy }
> = {
  // ── Pessoas / Auth ──────────────────────────────────────────────────
  // User não é exposto pelo CRUD genérico (evita vazar password_hash e
  // edição arbitrária de papel/permissão). Perfil próprio: GET /api/auth/me
  // e rotas dedicadas (updateOwnProfile) na Fase 2.
  User: { prismaModel: 'user', policy: adminOnly() },
  Colaborador: { prismaModel: 'colaborador', policy: openReadAdminWrite() },
  PessoaContato: { prismaModel: 'pessoaContato', policy: openReadAdminWrite() },
  Notification: {
    prismaModel: 'notification',
    policy: { ...ownerScoped('user_email'), canCreate: (user) => isAdmin(user) },
  },
  NotificationConfig: { prismaModel: 'notificationConfig', policy: ownerScoped('user_email') },
  Aviso: { prismaModel: 'aviso', policy: openReadOwnerOrAdminWrite('autor_email') },

  // ── Clientes / Implantação ──────────────────────────────────────────
  Client: {
    prismaModel: 'client',
    policy: {
      ...verticalScoped({ ownerFields: ['email'] }),
      canCreate: (user, data) =>
        hasFullVerticalAccess(user) ||
        user.tipo_perfil === 'interno' ||
        data.email === user.email,
      canDelete: (user) => hasFullVerticalAccess(user),
    },
  },
  ClientInteracao: {
    prismaModel: 'clientInteracao',
    policy: { ...publicRead(), mutateWhere: async (user) => (isAdmin(user) ? null : 'DENY') },
  },
  ClienteImplantacao: {
    prismaModel: 'clienteImplantacao',
    policy: {
      ...verticalScoped({ verticalField: 'vertical', ownerFields: ['usuario_email'] }),
      canCreate: (user) => hasFullVerticalAccess(user) || user.tipo_perfil === 'interno',
      canDelete: (user) => hasFullVerticalAccess(user),
    },
  },
  DocumentoCliente: {
    prismaModel: 'documentoCliente',
    policy: parentScoped({ parentModel: 'clienteImplantacao', localField: 'cliente_implantacao_id' }),
  },
  EtapaImplantacao: {
    prismaModel: 'etapaImplantacao',
    policy: {
      ...verticalScoped(),
      canCreate: (user) => isAdmin(user),
      canDelete: (user) => isAdmin(user),
      // update também é admin-only no RLS original (só read é aberto por
      // vertical) - sem isso, cairia no scopeWhere (mais permissivo).
      mutateWhere: async (user) => (isAdmin(user) ? null : 'DENY'),
    },
  },
  ItemChecklist: {
    prismaModel: 'itemChecklist',
    policy: parentScoped({
      parentModel: 'etapaImplantacao',
      localField: 'etapa_id',
      parentOwnerField: null,
    }),
  },
  ProgressoItem: {
    prismaModel: 'progressoItem',
    policy: parentScoped({ parentModel: 'clienteImplantacao', localField: 'cliente_implantacao_id' }),
  },
  ImplantacaoUsuario: {
    prismaModel: 'implantacaoUsuario',
    // Simplificação de Fase 1: usa o mesmo escopo (vertical OU dono da
    // implantação) para leitura e escrita; o RLS original era um pouco mais
    // estrito na escrita (sem o atalho por e-mail direto do usuário-alvo).
    policy: parentScoped({ parentModel: 'clienteImplantacao', localField: 'cliente_implantacao_id' }),
  },
  ImplantacaoLog: {
    prismaModel: 'implantacaoLog',
    policy: {
      ...parentScoped({ parentModel: 'clienteImplantacao', localField: 'cliente_implantacao_id' }),
      mutateWhere: async (user) => (isAdmin(user) ? null : 'DENY'),
    },
  },
  NotificacaoCliente: {
    prismaModel: 'notificacaoCliente',
    policy: parentScoped({ parentModel: 'clienteImplantacao', localField: 'cliente_implantacao_id' }),
  },
  ModuloTreinamento: { prismaModel: 'moduloTreinamento', policy: knowledgeScoped() },
  ProgressoTreinamento: {
    prismaModel: 'progressoTreinamento',
    policy: parentScoped({ parentModel: 'clienteImplantacao', localField: 'cliente_implantacao_id' }),
  },

  // ── Kanban / SLA / Automação / Escalonamento ────────────────────────
  KanbanColumn: { prismaModel: 'kanbanColumn', policy: adminOnly() },
  KanbanConfig: {
    prismaModel: 'kanbanConfig',
    policy: {
      ...verticalScoped(),
      canCreate: (user) => hasFullVerticalAccess(user),
      canDelete: (user) => hasFullVerticalAccess(user),
      mutateWhere: async (user) => (hasFullVerticalAccess(user) ? null : 'DENY'),
    },
  },
  AutomationRule: {
    prismaModel: 'automationRule',
    policy: { ...verticalScoped(), canDelete: (user) => isAdmin(user) },
  },
  Escalation: {
    prismaModel: 'escalation',
    policy: {
      async scopeWhere(user) {
        if (hasFullVerticalAccess(user)) return null;
        const or: Record<string, unknown>[] = [
          { escalated_by_email: user.email },
          { escalated_to_email: user.email },
          { colaborador_email: user.email },
        ];
        if (user.vertical) or.push({ vertical: user.vertical });
        return { OR: or };
      },
      async mutateWhere(user) {
        if (hasFullVerticalAccess(user)) return null;
        return { OR: [{ escalated_to_email: user.email }, { responsavel_tratativa_email: user.email }] };
      },
      canCreate: () => true,
      canDelete: (user) => hasFullVerticalAccess(user),
    },
  },
  EscalationConfig: {
    prismaModel: 'escalationConfig',
    policy: {
      ...verticalScoped(),
      canCreate: (user) => isAdmin(user),
      mutateWhere: async (user) => (hasFullVerticalAccess(user) ? null : 'DENY'),
    },
  },
  EscalationEvent: {
    prismaModel: 'escalationEvent',
    policy: { ...publicRead(), mutateWhere: async (user) => (isAdmin(user) ? null : 'DENY') },
  },

  // ── Tickets ──────────────────────────────────────────────────────────
  Ticket: {
    prismaModel: 'ticket',
    policy: {
      ...verticalScoped({ ownerFields: ['assigned_to', 'client_email'] }),
      // delete é só admin/Diretor no RLS original - update segue o escopo
      // normal (vertical/responsável/cliente), mas apagar ticket é restrito.
      canDelete: (user) => hasFullVerticalAccess(user),
    },
  },
  TicketEvent: {
    prismaModel: 'ticketEvent',
    policy: {
      async scopeWhere(user) {
        return hasFullVerticalAccess(user) || user.tipo_perfil === 'interno' ? null : 'DENY';
      },
      mutateWhere: async (user) => (isAdmin(user) ? null : 'DENY'),
      canCreate: (user) => hasFullVerticalAccess(user) || user.tipo_perfil === 'interno',
    },
  },
  TicketEmail: {
    prismaModel: 'ticketEmail',
    policy: {
      async scopeWhere(user) {
        return hasFullVerticalAccess(user) || user.tipo_perfil === 'interno' ? null : 'DENY';
      },
      mutateWhere: async (user) => (isAdmin(user) ? null : 'DENY'),
      canCreate: (user) => hasFullVerticalAccess(user) || user.tipo_perfil === 'interno',
    },
  },
  TicketAttachment: {
    prismaModel: 'ticketAttachment',
    policy: {
      async scopeWhere(user) {
        return hasFullVerticalAccess(user) || user.tipo_perfil === 'interno' ? null : 'DENY';
      },
      canCreate: (user) => hasFullVerticalAccess(user) || user.tipo_perfil === 'interno',
    },
  },
  TicketSession: {
    prismaModel: 'ticketSession',
    policy: {
      async scopeWhere(user) {
        if (isAdmin(user)) return null;
        const or: Record<string, unknown>[] = [{ user_email: user.email }];
        const where: Record<string, unknown> = user.vertical
          ? { OR: [{ vertical: user.vertical }, { assigned_to: user.email }] }
          : { assigned_to: user.email };
        const tickets = await prisma.ticket.findMany({ where, select: { id: true } });
        if (tickets.length > 0) or.push({ ticket_id: { in: tickets.map((t) => t.id) } });
        return { OR: or };
      },
      mutateWhere: async (user) => (isAdmin(user) ? null : { user_email: user.email }),
      canCreate: (user, data) => isAdmin(user) || data.user_email === user.email,
    },
  },
  TicketCustomField: {
    prismaModel: 'ticketCustomField',
    policy: {
      ...verticalScoped(),
      canCreate: (user) => hasFullVerticalAccess(user),
      canDelete: (user) => hasFullVerticalAccess(user),
      mutateWhere: async (user) => (hasFullVerticalAccess(user) ? null : 'DENY'),
    },
  },
  TicketCustomData: { prismaModel: 'ticketCustomData', policy: ticketScoped() },
  TicketKnowledgeLink: { prismaModel: 'ticketKnowledgeLink', policy: ticketScoped() },
  TicketType: {
    prismaModel: 'ticketType',
    policy: {
      async scopeWhere(user) {
        if (hasFullVerticalAccess(user)) return null;
        const or: Record<string, unknown>[] = [];
        if (user.vertical) or.push({ vertical: user.vertical });
        if (user.tipo_perfil === 'cliente' && user.cliente_vertical) {
          or.push({ vertical: user.cliente_vertical });
        }
        if (or.length === 0) return 'DENY';
        return { OR: or };
      },
      canCreate: (user, data) => hasFullVerticalAccess(user) || data.vertical === user.vertical,
      // escrita não tem o ramo de cliente que a leitura tem (clientes nunca
      // editam tipos de ticket, só leem os da própria vertical).
      mutateWhere: async (user) =>
        hasFullVerticalAccess(user) ? null : user.vertical ? { vertical: user.vertical } : 'DENY',
    },
  },
  TimeEntry: {
    prismaModel: 'timeEntry',
    policy: {
      async scopeWhere(user) {
        if (hasFullVerticalAccess(user) || user.tipo_perfil === 'interno') return null;
        return { technician_email: user.email };
      },
      mutateWhere: async (user) => (isAdmin(user) ? null : { technician_email: user.email }),
      canCreate: (user, data) => isAdmin(user) || data.technician_email === user.email,
    },
  },

  // ── Base de Conhecimento ────────────────────────────────────────────
  KnowledgeArticle: {
    prismaModel: 'knowledgeArticle',
    policy: knowledgeScoped({ requireVisibleToClientFlag: true }),
  },
  KnowledgeCategory: { prismaModel: 'knowledgeCategory', policy: knowledgeScoped() },
  ResponseTemplate: {
    prismaModel: 'responseTemplate',
    policy: {
      async scopeWhere(user) {
        if (hasFullVerticalAccess(user)) return null;
        const or: Record<string, unknown>[] = [{ main_type: 'geral' }];
        if (user.vertical) or.push({ vertical: user.vertical });
        return { OR: or };
      },
      canCreate: (user, data) => hasFullVerticalAccess(user) || data.vertical === user.vertical,
      // o atalho "main_type: geral" (visível a todos) só vale para leitura -
      // edição continua restrita à própria vertical.
      mutateWhere: async (user) =>
        hasFullVerticalAccess(user) ? null : user.vertical ? { vertical: user.vertical } : 'DENY',
    },
  },
  QuickLink: { prismaModel: 'quickLink', policy: verticalScoped() },
  DailyRoutine: { prismaModel: 'dailyRoutine', policy: verticalScoped() },

  // ── Configuração de negócio ──────────────────────────────────────────
  ServiceType: { prismaModel: 'serviceType', policy: verticalScoped() },
  ServiceCategory: { prismaModel: 'serviceCategory', policy: verticalScoped() },
  ServiceFormConfig: {
    prismaModel: 'serviceFormConfig',
    policy: {
      ...verticalScoped(),
      canCreate: (user) => isAdmin(user),
      mutateWhere: async (user) => (isAdmin(user) ? null : 'DENY'),
    },
  },
  SuporteConfig: {
    prismaModel: 'suporteConfig',
    policy: {
      ...verticalScoped(),
      canCreate: (user) => hasFullVerticalAccess(user),
      mutateWhere: async (user) => (hasFullVerticalAccess(user) ? null : 'DENY'),
    },
  },
  Vertical: { prismaModel: 'vertical', policy: openReadAdminWrite() },
  SystemConfig: { prismaModel: 'systemConfig', policy: adminOnly() },
  SyncState: { prismaModel: 'syncState', policy: adminOnly() },

  // ── Agenda / Horas ───────────────────────────────────────────────────
  Appointment: { prismaModel: 'appointment', policy: ownerScoped('owner_email') },

  // ── WhatsApp ─────────────────────────────────────────────────────────
  WhatsAppAtendimentoVinculado: {
    prismaModel: 'whatsAppAtendimentoVinculado',
    policy: {
      async scopeWhere(user) {
        if (isAdmin(user)) return null;
        const or: Record<string, unknown>[] = [{ analyst_email: user.email }];
        const parentWhere: Record<string, unknown> = user.vertical
          ? { OR: [{ vertical: user.vertical }, { usuario_email: user.email }] }
          : { usuario_email: user.email };
        const parents = await prisma.clienteImplantacao.findMany({
          where: parentWhere,
          select: { id: true },
        });
        if (parents.length > 0) or.push({ implantacao_id: { in: parents.map((p) => p.id) } });
        return { OR: or };
      },
      mutateWhere: async (user) => (isAdmin(user) ? null : { analyst_email: user.email }),
      canCreate: (user, data) => isAdmin(user) || data.analyst_email === user.email,
    },
  },
};

export type EntityName = keyof typeof entityRegistry;
