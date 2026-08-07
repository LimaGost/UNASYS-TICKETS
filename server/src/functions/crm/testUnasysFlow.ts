import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { normalizarVertical } from './cnpj';

type KanbanColumnDef = { title: string; order?: number };

/** Função admin-only para testar o fluxo de integração com o CRM Unasys
 * Flow sem precisar de um webhook real - roda a mesma lógica essencial de
 * receiveSalesData com dados de teste gerados na hora. */
export async function testUnasysFlowHandler(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const steps: { msg: string; data: unknown }[] = [];
    const log = (msg: string, data: unknown) => steps.push({ msg, data });

    const payload = {
      numero_op: body.numero_op || `TEST-OP-${Date.now()}`,
      cnpj_cliente: body.cnpj_cliente || `00.000.000/0001-${String(Math.floor(Math.random() * 99)).padStart(2, '0')}`,
      razao_social: body.razao_social || 'EMPRESA TESTE UNASYS FLOW LTDA',
      nome_cliente: body.nome_cliente || 'Empresa Teste Unasys Flow',
      email_cliente: body.email_cliente || `teste.unasys.${Date.now()}@teste.com`,
      numero_cliente: body.numero_cliente || `CLI-${Math.floor(Math.random() * 9999)}`,
      vertical: body.vertical || 'Retail - BSB',
      telefone: body.telefone || '(11) 99999-0000',
      cnae: body.cnae || '4751-2/01',
    };

    const verticalNormalizada = normalizarVertical(payload.vertical);
    log('vertical_normalizada', verticalNormalizada);

    if (payload.numero_op) {
      const existing = await prisma.ticket.findMany({ where: { external_order_number: payload.numero_op } });
      if (existing.length > 0) {
        return res.json({ success: false, motivo: 'Ticket já existe para esta OP', ticketId: existing[0].id, steps });
      }
    }
    log('duplicata_op', 'nenhuma');

    let client = await prisma.client.findFirst({ where: { email: payload.email_cliente } });
    if (client) {
      log('client', { acao: 'reutilizado', id: client.id });
    } else {
      client = await prisma.client.create({
        data: {
          name: payload.nome_cliente,
          nome_fantasia: payload.nome_cliente,
          razao_social: payload.razao_social,
          cnpj: payload.cnpj_cliente,
          cnae: payload.cnae,
          email: payload.email_cliente,
          vertical: verticalNormalizada,
          phone: payload.telefone,
          active: true,
        },
      });
      log('client', { acao: 'criado', id: client.id });
    }

    let ci = await prisma.clienteImplantacao.findFirst({ where: { cnpj: payload.cnpj_cliente } });
    if (ci) {
      log('cliente_implantacao', { acao: 'reutilizado', id: ci.id });
    } else {
      ci = await prisma.clienteImplantacao.create({
        data: {
          usuario_email: payload.email_cliente,
          nome_empresa: payload.nome_cliente,
          razao_social: payload.razao_social,
          cnpj: payload.cnpj_cliente,
          codigo_loja: payload.numero_cliente,
          vertical: verticalNormalizada,
          status_geral: 'aguardando',
          observacoes_analista: `Teste integração Unasys Flow. OP: ${payload.numero_op}`,
        },
      });
      log('cliente_implantacao', { acao: 'criado', id: ci.id });
    }

    let statusColumnTitle = 'NOVO';
    const kanbanConfig = await prisma.kanbanConfig.findFirst({ where: { main_type: 'implantacao', vertical: verticalNormalizada } });
    if (kanbanConfig) {
      const columns = (kanbanConfig.columns as KanbanColumnDef[]) || [];
      const sorted = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (sorted.length > 0) statusColumnTitle = sorted[0].title;
    }
    log('coluna_inicial', statusColumnTitle);

    const newTicket = await prisma.ticket.create({
      data: {
        title: `Nova Implantação - ${payload.nome_cliente}${payload.numero_op ? ' - OP: ' + payload.numero_op : ''}`,
        main_type: 'implantacao',
        client_id: client.id,
        client_name: payload.nome_cliente,
        client_email: payload.email_cliente,
        vertical: verticalNormalizada,
        ticket_type: 'Implantação Remota',
        urgency: 'media',
        status_column_id: statusColumnTitle,
        status_column_title: statusColumnTitle,
        description: `Ticket de teste criado via testUnasysFlow.\nOP: ${payload.numero_op}\nCNPJ: ${payload.cnpj_cliente}`,
        external_order_number: payload.numero_op,
        external_customer_code: payload.numero_cliente,
        external_reference: payload.cnpj_cliente,
        external_system: 'Sistema Comercial (TESTE)',
      },
    });
    log('ticket', { acao: 'criado', id: newTicket.id });

    return res.json({
      success: true,
      payload_enviado: payload,
      steps,
      ticket_criado: {
        id: newTicket.id,
        ticket_number: newTicket.ticket_number,
        title: newTicket.title,
        main_type: newTicket.main_type,
        vertical: newTicket.vertical,
        client_name: newTicket.client_name,
        client_email: newTicket.client_email,
        ticket_type: newTicket.ticket_type,
        status_column_title: newTicket.status_column_title,
        external_order_number: newTicket.external_order_number,
        created_date: newTicket.created_date,
      },
      client_id: client.id,
      cliente_implantacao_id: ci.id,
    });
  } catch (err) {
    console.error('Erro em testUnasysFlow:', err);
    return res.status(500).json({ error: (err as Error).message, stack: (err as Error).stack });
  }
}
