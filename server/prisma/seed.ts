/**
 * Cria o primeiro usuário admin (bootstrap). Não há auto-registro público,
 * então esse script é o único jeito de destravar o primeiro acesso.
 *
 * Uso:
 *   npx tsx prisma/seed.ts admin@empresa.com "SenhaForte123" "Nome Completo"
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const [, , email, password, fullName] = process.argv;
  if (!email || !password) {
    console.error('Uso: npx tsx prisma/seed.ts <email> <senha> [nome completo]');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.log(`Usuário ${email} já existe (id: ${existing.id}). Nada a fazer.`);
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password_hash,
      full_name: fullName ?? 'Administrador',
      role: 'admin',
      tipo_perfil: 'interno',
      cargo: 'Diretor',
      can_access_all_verticals: true,
    },
  });

  console.log(`Admin criado com sucesso: ${user.email} (id: ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
