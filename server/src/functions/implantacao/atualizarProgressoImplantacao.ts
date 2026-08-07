import type { Request, Response } from 'express';
import { prisma } from '../../db/prisma';

/** Recalcula o percentual de progresso de uma implantação a partir dos
 * itens de checklist concluídos. Chamada automaticamente (hook) sempre que
 * um ProgressoItem é criado/atualizado, e também exposta como rota. */
export async function atualizarProgressoImplantacaoCore(clienteImplantacaoId: string) {
  if (!clienteImplantacaoId) {
    throw Object.assign(new Error('cliente_implantacao_id required'), { status: 400 });
  }

  const implantacao = await prisma.clienteImplantacao.findUnique({ where: { id: clienteImplantacaoId } });
  if (!implantacao) throw Object.assign(new Error('Implantação não encontrada'), { status: 404 });

  const todasEtapas = await prisma.etapaImplantacao.findMany();
  const etapas = todasEtapas.filter((e) => !e.vertical || e.vertical === implantacao.vertical);
  const etapaIds = new Set(etapas.map((e) => e.id));

  const todosItens = await prisma.itemChecklist.findMany();
  const itens = todosItens.filter((i) => etapaIds.has(i.etapa_id));

  if (itens.length === 0) {
    await prisma.clienteImplantacao.update({ where: { id: clienteImplantacaoId }, data: { progresso_percentual: 0 } });
    return { progresso_percentual: 0 };
  }

  const progressoItens = await prisma.progressoItem.findMany({
    where: { cliente_implantacao_id: clienteImplantacaoId },
  });

  const isItemConcluido = (item: (typeof itens)[number], prog?: (typeof progressoItens)[number]) => {
    if (!prog?.concluido) return false;
    if (item.anexo_obrigatorio && !prog.anexo_url) return false;
    if (item.requer_confirmacao_cliente && !prog.confirmado_cliente) return false;
    return true;
  };

  const itensConcluidos = itens.filter((item) => {
    const prog = progressoItens.find((p) => p.item_id === item.id);
    return isItemConcluido(item, prog);
  }).length;

  const progresso_percentual = Math.round((itensConcluidos / itens.length) * 100);

  await prisma.clienteImplantacao.update({
    where: { id: clienteImplantacaoId },
    data: { progresso_percentual },
  });

  return { progresso_percentual, itensConcluidos, totalItens: itens.length };
}

export async function atualizarProgressoImplantacaoHandler(req: Request, res: Response) {
  try {
    const id = req.body?.cliente_implantacao_id;
    const result = await atualizarProgressoImplantacaoCore(id);
    return res.json(result);
  } catch (err) {
    const status = (err as any).status ?? 500;
    return res.status(status).json({ error: (err as Error).message });
  }
}
