// "Ator" que executa uma ação (usuário real ou processo automático), usado
// para preencher campos como user_email/user_name em eventos e logs.
// É o usuário autenticado numa requisição normal, ou o pseudo-usuário
// 'system@automation' usado por automações internas.
export type Actor = {
  email: string;
  name: string;
};

export const SYSTEM_ACTOR: Actor = {
  email: 'system@automation',
  name: 'Sistema de Automação',
};
