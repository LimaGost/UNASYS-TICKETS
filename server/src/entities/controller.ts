import type { Request, Response } from 'express';
import { entityRegistry } from '../policies/registry';
import { combineWhere, getDelegate, parseSort } from './registryHelpers';
import { runAfterCreate, runAfterDelete, runAfterUpdate } from './hooks';

const READ_ONLY_FIELDS = ['id', 'created_date', 'updated_date', 'ticket_number'];

function stripReadOnly(body: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...body };
  for (const field of READ_ONLY_FIELDS) delete clone[field];
  return clone;
}

function resolveEntity(req: Request, res: Response) {
  const name = req.params.entity;
  const entry = entityRegistry[name];
  if (!entry) {
    res.status(404).json({ error: `Entidade desconhecida: ${name}` });
    return null;
  }
  return entry;
}

function parseFilterParam(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function list(req: Request, res: Response) {
  const entry = resolveEntity(req, res);
  if (!entry) return;

  const scope = await entry.policy.scopeWhere(req.user!);
  const filter = parseFilterParam(req.query.filter);
  const where = combineWhere(filter, scope);
  if (where === 'DENY') return res.json([]);

  const orderBy = parseSort(typeof req.query.sort === 'string' ? req.query.sort : undefined);
  const take = req.query.limit ? Number(req.query.limit) : undefined;
  const skip = req.query.skip ? Number(req.query.skip) : undefined;

  const delegate = getDelegate(entry.prismaModel);
  const records = await delegate.findMany({ where, orderBy, take, skip });
  return res.json(records);
}

export async function getOne(req: Request, res: Response) {
  const entry = resolveEntity(req, res);
  if (!entry) return;

  const scope = await entry.policy.scopeWhere(req.user!);
  const where = combineWhere({ id: req.params.id }, scope);
  if (where === 'DENY') return res.status(404).json({ error: 'Não encontrado' });

  const delegate = getDelegate(entry.prismaModel);
  const record = await delegate.findFirst({ where });
  if (!record) return res.status(404).json({ error: 'Não encontrado' });
  return res.json(record);
}

export async function create(req: Request, res: Response) {
  const entry = resolveEntity(req, res);
  if (!entry) return;

  const data = stripReadOnly(req.body ?? {});
  if (!entry.policy.canCreate(req.user!, data)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const delegate = getDelegate(entry.prismaModel);
  try {
    const record = await delegate.create({ data });
    await runAfterCreate(req.params.entity, record);
    return res.status(201).json(record);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}

export async function update(req: Request, res: Response) {
  const entry = resolveEntity(req, res);
  if (!entry) return;

  const scope = entry.policy.mutateWhere
    ? await entry.policy.mutateWhere(req.user!)
    : await entry.policy.scopeWhere(req.user!);
  const where = combineWhere({ id: req.params.id }, scope);
  if (where === 'DENY') return res.status(404).json({ error: 'Não encontrado' });

  const delegate = getDelegate(entry.prismaModel);
  const existing = await delegate.findFirst({ where });
  if (!existing) return res.status(404).json({ error: 'Não encontrado' });

  const data = stripReadOnly(req.body ?? {});
  try {
    const record = await delegate.update({ where: { id: req.params.id }, data });
    await runAfterUpdate(req.params.entity, record, existing);
    return res.json(record);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}

export async function remove(req: Request, res: Response) {
  const entry = resolveEntity(req, res);
  if (!entry) return;

  const scope = entry.policy.mutateWhere
    ? await entry.policy.mutateWhere(req.user!)
    : await entry.policy.scopeWhere(req.user!);
  const where = combineWhere({ id: req.params.id }, scope);
  if (where === 'DENY') return res.status(404).json({ error: 'Não encontrado' });

  const delegate = getDelegate(entry.prismaModel);
  const existing = await delegate.findFirst({ where });
  if (!existing) return res.status(404).json({ error: 'Não encontrado' });

  if (entry.policy.canDelete && !entry.policy.canDelete(req.user!, existing)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  await delegate.delete({ where: { id: req.params.id } });
  await runAfterDelete(req.params.entity, existing);
  return res.status(204).send();
}
