// Hooks disparados pelo CRUD genérico depois de criar/atualizar/apagar um
// registro - reagem a eventos de entidade (ex: "quando um Ticket é criado,
// notificar..."). Como o CRUD genérico atende às 48 entidades, é aqui que
// plugamos os efeitos colaterais que a lógica de negócio precisa, sem
// duplicar o controller.
//
// Falhas em hooks nunca devem quebrar a resposta da operação principal -
// o controller genérico chama isso com try/catch.

import { onTicketCreatedHook } from '../functions/hooks/onTicketCreated';
import { criarClienteAoNovoTicketHook } from '../functions/hooks/criarClienteAoNovoTicket';
import { criarClienteImplantacaoAposClientHook } from '../functions/hooks/criarClienteImplantacaoAposClient';
import { notifyAssignmentHook } from '../functions/hooks/notifyAssignment';
import { notifyNewCommentHook } from '../functions/hooks/notifyNewComment';
import { notifyAvisoCreatedHook } from '../functions/hooks/notifyAvisoCreated';
import { syncTicketSessionToEventHook } from '../functions/hooks/syncTicketSessionToEvent';
import { recomputeTicketHoursCore } from '../functions/tickets/recomputeTicketHours';
import { atualizarProgressoImplantacaoCore } from '../functions/implantacao/atualizarProgressoImplantacao';

type CreateHook = (record: any) => Promise<unknown>;
type UpdateHook = (record: any, oldRecord: any) => Promise<unknown>;

export const afterCreateHooks: Record<string, CreateHook[]> = {
  Ticket: [criarClienteAoNovoTicketHook, onTicketCreatedHook],
  Client: [criarClienteImplantacaoAposClientHook],
  TimeEntry: [(record) => recomputeTicketHoursCore(record.ticket_id)],
  ProgressoItem: [(record) => atualizarProgressoImplantacaoCore(record.cliente_implantacao_id)],
  TicketEvent: [notifyNewCommentHook],
  Aviso: [notifyAvisoCreatedHook],
};

export const afterUpdateHooks: Record<string, UpdateHook[]> = {
  TimeEntry: [(record) => recomputeTicketHoursCore(record.ticket_id)],
  ProgressoItem: [(record) => atualizarProgressoImplantacaoCore(record.cliente_implantacao_id)],
  Ticket: [notifyAssignmentHook],
  TicketSession: [syncTicketSessionToEventHook],
};

export const afterDeleteHooks: Record<string, CreateHook[]> = {
  TimeEntry: [(record) => recomputeTicketHoursCore(record.ticket_id)],
};

async function runHooks(
  hooks: ((record: any, oldRecord?: any) => Promise<unknown>)[] | undefined,
  record: any,
  oldRecord: any,
  entityName: string,
  phase: string
) {
  if (!hooks || hooks.length === 0) return;
  for (const hook of hooks) {
    try {
      await hook(record, oldRecord);
    } catch (err) {
      console.error(`Erro no hook ${phase} de ${entityName}:`, err);
    }
  }
}

export const runAfterCreate = (entityName: string, record: any) =>
  runHooks(afterCreateHooks[entityName], record, undefined, entityName, 'afterCreate');

export const runAfterUpdate = (entityName: string, record: any, oldRecord: any) =>
  runHooks(afterUpdateHooks[entityName], record, oldRecord, entityName, 'afterUpdate');

export const runAfterDelete = (entityName: string, record: any) =>
  runHooks(afterDeleteHooks[entityName], record, undefined, entityName, 'afterDelete');
