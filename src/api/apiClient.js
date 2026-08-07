// Client de acesso à API própria, usado em todas as telas no padrão:
//   api.entities.Ticket.list(sort, limit, skip)
//   api.entities.Ticket.filter({ vertical: 'x' }, sort, limit)
//   api.entities.Ticket.get(id)
//   api.entities.Ticket.create(data)
//   api.entities.Ticket.update(id, data)
//   api.entities.Ticket.delete(id)
//   api.auth.me() / login() / logout() / redirectToLogin()
//   api.functions.invoke('nomeDaFuncao', payload)
//   api.integrations.Core.UploadFile({ file })

// `??` (não `||`): VITE_API_URL="" é um valor válido (mesma origem, usado em
// produção quando o Express serve API e frontend juntos) - string vazia é
// "falsy" mas não deve cair no fallback de desenvolvimento.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const ACCESS_TOKEN_KEY = 'access_token';

let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || null;

function setAccessToken(token) {
  accessToken = token;
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `Erro na API (status ${status})`);
    this.status = status;
    this.data = data;
  }
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
        const data = await res.json();
        setAccessToken(data.access_token);
        return data.access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(path, { method = 'GET', body, isRetry = false } = {}) {
  const headers = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const init = { method, headers, credentials: 'include' };

  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, init);

  if (res.status === 401 && !isRetry && path !== '/api/auth/refresh') {
    try {
      await refreshAccessToken();
      return request(path, { method, body, isRetry: true });
    } catch {
      setAccessToken(null);
      throw new ApiError(401, { error: 'Sessão expirada' });
    }
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

function buildQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    query.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

function createEntityClient(entityName) {
  return {
    list(sort, limit, skip) {
      return request(`/api/entities/${entityName}${buildQuery({ sort, limit, skip })}`);
    },
    filter(query = {}, sort, limit, skip) {
      return request(`/api/entities/${entityName}${buildQuery({ filter: query, sort, limit, skip })}`);
    },
    get(id) {
      return request(`/api/entities/${entityName}/${id}`);
    },
    create(data) {
      return request(`/api/entities/${entityName}`, { method: 'POST', body: data });
    },
    update(id, data) {
      return request(`/api/entities/${entityName}/${id}`, { method: 'PUT', body: data });
    },
    delete(id) {
      return request(`/api/entities/${entityName}/${id}`, { method: 'DELETE' });
    },
    // Assinatura de atualização em tempo real (websocket) que algumas telas
    // ainda chamam (ex.: NotificationBell) - não temos esse canal, então é
    // um no-op seguro (essas telas já fazem polling via refetchInterval do
    // React Query, então continuam funcionando normalmente sem ele).
    subscribe() {
      return () => {};
    },
  };
}

// Proxy: qualquer nome de entidade usado (api.entities.QualquerCoisa) gera
// automaticamente o client correspondente, sem precisar listar as 48
// entidades manualmente aqui.
const entities = new Proxy(
  {},
  {
    get(_target, entityName) {
      return createEntityClient(entityName);
    },
  }
);

const auth = {
  async me() {
    return request('/api/auth/me');
  },
  async login(email, password) {
    const data = await request('/api/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(data.access_token);
    return data.user;
  },
  async logout(redirectTo) {
    await request('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    if (redirectTo) window.location.href = redirectTo;
  },
  redirectToLogin(fromUrl) {
    const target = fromUrl || window.location.href;
    window.location.href = `/login?from_url=${encodeURIComponent(target)}`;
  },
  isAuthenticated() {
    return !!accessToken;
  },
  // Autoatualização do próprio usuário logado (nome, avatar, assinatura de
  // e-mail) - usa a mesma rota de função que updateOwnProfile.
  async updateMe(data) {
    const result = await request('/api/functions/updateOwnProfile', { method: 'POST', body: data });
    return result?.user;
  },
};

const functions = {
  // Mantemos o retorno no formato { data } (estilo axios) porque várias
  // telas já fazem `res.data` no resultado de functions.invoke.
  async invoke(name, payload) {
    const data = await request(`/api/functions/${name}`, { method: 'POST', body: payload ?? {} });
    return { data };
  },
};

// Registro de uso de página (analytics) - não existe equivalente no backend
// próprio. No-op silencioso para não quebrar o NavigationTracker.
const appLogs = {
  async logUserInApp() {
    return null;
  },
};

// A tela de configuração de e-mail automático (EmailAutomationConfig)
// listava/gerenciava agendamentos configuráveis pela UI - isso não existe
// mais (o agendamento agora é fixo em código, via cron no servidor). Stub
// para a tela não quebrar; a lista fica sempre vazia.
const asServiceRole = {
  async listAutomations() {
    return [];
  },
  async manageAutomation() {
    return { success: true };
  },
};

// Convite de usuário por e-mail com link de acesso ainda não existe no
// backend próprio (exigiria um fluxo de definição/redefinição de senha por
// e-mail). Simplificação: cria a conta direto com uma senha temporária
// aleatória, que o admin deve repassar manualmente ao usuário (ou pedir
// para trocar depois via "Alterar senha").
async function inviteUser(email, role) {
  const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!1';
  const user = await request('/api/auth/register', {
    method: 'POST',
    body: { email, password: tempPassword, role: role || 'user' },
  });
  console.warn(`[inviteUser] Conta criada para ${email} com senha temporária: ${tempPassword} (repasse manualmente - ainda não há e-mail de convite automático)`);
  return user;
}

const users = { inviteUser };

async function uploadFile({ file }) {
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/uploads', { method: 'POST', body: formData });
}

const integrations = {
  Core: {
    UploadFile: uploadFile,
    // SendEmail/InvokeLLM não são chamados do frontend hoje (só do backend);
    // mantidos aqui só para não quebrar se algum código novo tentar usar.
    SendEmail() {
      throw new Error('Core.SendEmail não está disponível no frontend - use api.functions.invoke(...)');
    },
    InvokeLLM() {
      throw new Error('Core.InvokeLLM não está disponível no frontend nesta fase');
    },
  },
};

export const api = { entities, auth, functions, integrations, appLogs, asServiceRole, users };
export { ApiError };
