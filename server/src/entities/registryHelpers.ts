import { prisma } from '../db/prisma';
import type { ScopeResult } from '../policies/types';

/** Converte a string de ordenação usada pelo frontend ("-created_date" ou
 * "-created_date,title") no formato orderBy do Prisma. */
export function parseSort(sort?: string): Record<string, 'asc' | 'desc'>[] | undefined {
  if (!sort) return undefined;
  const fields = sort.split(',').map((s) => s.trim()).filter(Boolean);
  if (fields.length === 0) return undefined;
  return fields.map((field) => {
    if (field.startsWith('-')) return { [field.slice(1)]: 'desc' as const };
    return { [field]: 'asc' as const };
  });
}

/** Combina o where vindo da query (filter=) com o where de escopo da policy. */
export function combineWhere(
  queryWhere: Record<string, unknown> | undefined,
  scope: ScopeResult
): Record<string, unknown> | 'DENY' {
  if (scope === 'DENY') return 'DENY';
  const clauses: Record<string, unknown>[] = [];
  if (queryWhere && Object.keys(queryWhere).length > 0) clauses.push(queryWhere);
  if (scope) clauses.push(scope);
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

export function getDelegate(prismaModel: keyof typeof prisma) {
  return prisma[prismaModel] as unknown as {
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any | null>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
  };
}
