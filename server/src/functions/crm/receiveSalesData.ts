import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { validarCNPJ, formatarCNPJ, normalizarVertical } from './cnpj';
import { runAfterCreate } from '../../entities/hooks';

export type ReceiveSalesDataInput = {
  numero_op?: string;
  cnpj_cliente: string;
  nome_cliente: string;
  email_cliente: string;
  numero_cliente?: string;
  vertical: string;
  nome_fantasia?: string;
  razao_social?: string;
  telefone?: string;
  cnae?: string;
  observacoes?: string;
  observacao?: string;
  obs?: string;
  observacoes_gerais?: string;
  observacoes_proposta?: string;
};

type KanbanColumnDef = { title: string; order?: number };

/** Recebe dados de venda do CRM Unasys Flow e cria Cliente + ClienteImplantacao
 * + Ticket de implantação automaticamente. Protegido por WEBHOOK_SECRET_TOKEN. */
export async function receiveSalesDataHandler(req: Request, res: Response) {
  try {
    const payload = (req.body ?? {}) as ReceiveSalesDataInput;
    const { numero_op, cnpj_cliente, nome_cliente, email_cliente, numero_cliente, vertical, nome_fantasia } = payload;

    const observacoes = payload.observacoes || payload.observacao || payload.obs || payload.observacoes_gerais || payload.observacoes_proposta || '';

    if (!cnpj_cliente || !nome_cliente || !email_cliente || !vertical) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes: cnpj_cliente, nome_cliente, email_cliente, vertical' });
    }

    const cnpjCheck = validarCNPJ(cnpj_cliente);
    if (!cnpjCheck.ok) {
      return res.status(400).json({ error: `CNPJ inválido: "${cnpj_cliente}". Verifique os dígitos verificadores.` });
    }
    const cnpjNormalizado = formatarCNPJ(cnpjCheck.nums);
    const verticalNormalizada = normalizarVertical(vertical);

    // 1. Duplicata por OP + CNPJ (franquias podem ter várias filiais na mesma OP)
    if (numero_op) {
      const existingTickets = await prisma.ticket.findMany({ where: { external_order_number: numero_op } });
      const mesmoCnpj = existingTickets.find((t) => (t.external_reference || '') === cnpjNormalizado);
      if (mesmoCnpj) {
        return res.status(200).json({ status: 'skipped', message: 'Ticket já existe para esta OP e CNPJ.', ticketId: mesmoCnpj.id });
      }
    }

    // 2. Upsert Client: prioridade CNPJ -> e-mail (só se CNPJ bater)
    let client = await prisma.client.findFirst({ where: { cnpj: cnpjNormalizado } });
    if (!client && email_cliente) {
      const byEmail = await prisma.client.findMany({ where: { email: email_cliente } });
      client = byEmail.find((c) => !c.cnpj || c.cnpj === cnpjNormalizado) || null;
    }

    if (client) {
      const updates: Record<string, unknown> = {};
      if (!client.cnpj) updates.cnpj = cnpjNormalizado;
      if (!client.nome_fantasia && (nome_fantasia || nome_cliente)) updates.nome_fantasia = nome_fantasia || nome_cliente;
      if (!client.razao_social && payload.razao_social) updates.razao_social = payload.razao_social;
      if (!client.vertical) updates.vertical = verticalNormalizada;
      if (!client.phone && payload.telefone) updates.phone = payload.telefone;
      if (Object.keys(updates).length > 0) {
        client = await prisma.client.update({ where: { id: client.id }, data: updates });
      }
    } else {
      client = await prisma.client.create({
        data: {
          name: nome_cliente,
          nome_fantasia: nome_fantasia || nome_cliente,
          razao_social: payload.razao_social || nome_cliente,
          cnpj: cnpjNormalizado,
          cnae: payload.cnae || '',
          email: email_cliente,
          vertical: verticalNormalizada,
          contact_person: '',
          phone: payload.telefone || '',
          active: true,
        },
      });
    }

    // 3. Upsert ClienteImplantacao pelo CNPJ
    let clienteImplantacao = await prisma.clienteImplantacao.findFirst({ where: { cnpj: cnpjNormalizado } });
    if (clienteImplantacao) {
      clienteImplantacao = await prisma.clienteImplantacao.update({
        where: { id: clienteImplantacao.id },
        data: {
          nome_empresa: nome_cliente,
          usuario_email: email_cliente,
          codigo_loja: numero_cliente || clienteImplantacao.codigo_loja,
        },
      });
    } else {
      clienteImplantacao = await prisma.clienteImplantacao.create({
        data: {
          usuario_email: email_cliente,
          nome_empresa: nome_cliente,
          razao_social: nome_cliente,
          cnpj: cnpjNormalizado,
          vertical: verticalNormalizada,
          status_geral: 'aguardando',
          observacoes_analista: `Criado automaticamente via integração comercial. Vertical: ${verticalNormalizada}. OP: ${numero_op || 'N/A'}`,
        },
      });
    }

    // 4. Busca a coluna inicial do KanbanConfig para esta vertical
    let statusColumnTitle = 'NOVO';
    const kanbanConfig = await prisma.kanbanConfig.findFirst({ where: { main_type: 'implantacao', vertical: verticalNormalizada } });
    if (kanbanConfig) {
      const columns = (kanbanConfig.columns as KanbanColumnDef[]) || [];
      const sorted = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (sorted.length > 0) statusColumnTitle = sorted[0].title;
    }

    // 5. Cria o Ticket de Implantação
    const newTicket = await prisma.ticket.create({
      data: {
        title: `Nova Implantação - ${nome_cliente}${numero_op ? ' - OP: ' + numero_op : ''}`,
        main_type: 'implantacao',
        client_id: client.id,
        client_name: nome_cliente,
        client_email: email_cliente,
        vertical: verticalNormalizada,
        ticket_type: 'Implantação Remota',
        urgency: 'media',
        status_column_id: statusColumnTitle,
        status_column_title: statusColumnTitle,
        description: `Ticket de implantação gerado automaticamente via integração com o sistema comercial.\n\nOP: ${numero_op || 'N/A'}\nCNPJ: ${cnpjNormalizado}\nCódigo do cliente: ${numero_cliente || 'N/A'}${observacoes ? `\n\nOBSERVAÇÕES:\n${observacoes}` : ''}`,
        observacoes_gerais: observacoes || '',
        external_order_number: numero_op || null,
        external_customer_code: numero_cliente || cnpjNormalizado,
        external_reference: cnpjNormalizado,
        external_system: 'Sistema Comercial',
      },
    });

    // Dispara os mesmos hooks do CRUD genérico (notificar analistas da
    // vertical, etc.) - essa criação de ticket não passa pelo controller
    // genérico, então precisa chamar explicitamente.
    await runAfterCreate('Ticket', newTicket);

    return res.status(200).json({
      status: 'success',
      message: 'Cliente e Ticket de Implantação criados com sucesso!',
      clientId: client.id,
      clienteImplantacaoId: clienteImplantacao.id,
      ticketId: newTicket.id,
      kanbanColumn: statusColumnTitle,
    });
  } catch (err) {
    console.error('Erro ao processar dados da venda:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
