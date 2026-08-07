// reportConfigs.jsx — v2 (filtro por data do apontamento + filtro por usuário)
import { api } from "@/api/apiClient";

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");
// Formata datas "puras" (YYYY-MM-DD, sem hora) — como TimeEntry.date — sem passar
// por new Date(), que interpreta a string como meia-noite UTC e, ao formatar no
// fuso de Brasília (UTC-3), pode voltar 1 dia (ex: "2026-08-04" virava 03/08).
const fmtDateOnly = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};
const round = (n) => +(+n || 0).toFixed(2);

// Converte total_minutes (mais confiável) ou normal_hours/extra_hours para horas decimais.
// Prioridade: campos calculados → total_minutes → (start/end computado)
const minutesToH = (min) => round((min || 0) / 60);
const entryNormalH = (e) => {
  if (e.normal_hours != null && e.normal_hours > 0) return round(e.normal_hours);
  if (e.hour_type !== "extra" && e.total_minutes) return minutesToH(e.total_minutes);
  return 0;
};
const entryExtraH = (e) => {
  if (e.extra_hours != null && e.extra_hours > 0) return round(e.extra_hours);
  if (e.hour_type === "extra" && e.total_minutes) return minutesToH(e.total_minutes);
  return 0;
};

// Lista TODOS os registros sem limite artificial.
// A API pagina internamente; esse helper garante que todos os registros
// chegam independente do volume.
async function listAll(entity, sort = "-created_date") {
  const PAGE = 500;
  let all = [];
  let page = 1;
  while (true) {
    const batch = await entity.list(sort, PAGE, (page - 1) * PAGE);
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    page++;
    if (page > 50) break; // safety cap em 25.000 registros
  }
  return all;
}

async function fetchTicketRows(userEmail, userCargo) {
  const isGestor = userCargo === "Diretor";

  let tickets, allEntries;

  if (isGestor) {
    // Diretor vê todos os tickets e apontamentos de todos os agentes
    [tickets, allEntries] = await Promise.all([
      listAll(api.entities.Ticket),
      listAll(api.entities.TimeEntry),
    ]);
  } else {
    // Analista vê só o que ele tocou (assigned_to ou technician_email)
    const [assignedTickets, myEntries] = await Promise.all([
      api.entities.Ticket.filter({ assigned_to: userEmail }),
      api.entities.TimeEntry.filter({ technician_email: userEmail }),
    ]);

    const assignedIds = new Set(assignedTickets.map(t => t.id));
    const ticketIdsFromEntries = [...new Set(myEntries.map(e => e.ticket_id).filter(Boolean))];
    const missingIds = ticketIdsFromEntries.filter(id => !assignedIds.has(id));

    let extraTickets = [];
    for (let i = 0; i < missingIds.length; i += 20) {
      const batch = await api.entities.Ticket.filter({ id: { $in: missingIds.slice(i, i + 20) } });
      extraTickets = extraTickets.concat(batch);
    }

    tickets = [...assignedTickets, ...extraTickets];
    allEntries = myEntries;
  }

  // Agrupa apontamentos por ticket
  const entriesByTicket = new Map();
  allEntries.forEach((e) => {
    if (!e.ticket_id) return;
    const list = entriesByTicket.get(e.ticket_id) || [];
    list.push(e);
    entriesByTicket.set(e.ticket_id, list);
  });

  const rows = [];
  tickets.forEach((t) => {
    // Campos fixos do ticket — aparecem em todas as linhas do ticket
    const base = {
      // Identificação
      numero:          t.ticket_number ? `#${String(t.ticket_number).padStart(4,'0')}` : "",
      titulo:          t.title || "",
      cliente:         t.client_name || "",
      email_cliente:   t.client_email || "",
      vertical:        t.vertical || "",
      tipo:            t.ticket_type || "",
      urgencia:        t.urgency || "",
      status:          t.status_column_title || "",
      responsavel:     t.assigned_to_name || t.assigned_to || "Não atribuído",
      solicitante:     t.requester || "",
      categoria:       t.category || "",
      tipo_servico:    t.service_type || "",
      // Datas do ticket
      criado_em:       fmtDate(t.created_date),
      encerrado_em:    fmtDate(t.closed_at),
      previsao:        fmtDate(t.expected_resolution),
      // SLA
      sla_horas:       round(t.sla_hours),
      sla_violado:     t.sla_breached ? "Sim" : "Não",
      tempo_resolucao_h: t.closed_at && t.created_date
        ? round((new Date(t.closed_at) - new Date(t.created_date)) / 3600000)
        : 0,
      // Integração
      op:              t.external_order_number || "",
      horas_contratadas: round(t.contracted_hours || 0),
      // Controle interno
      _date:           t.created_date,
      _main_type:      t.main_type || "implantacao",
      _ticket_id:      t.id,
    };

    const ticketEntries = entriesByTicket.get(t.id) || [];

    if (ticketEntries.length === 0) {
      // Ticket sem apontamentos — uma linha com totais acumulados
      rows.push({
        ...base,
        tecnico:        "",
        data_registro:  "",
        inicio:         "",
        fim:            "",
        tipo_hora:      "",
        horas_normais:  round(t.total_normal_hours || 0),
        horas_extras:   round(t.total_extra_hours || 0),
        total_horas:    round((t.total_normal_hours || 0) + (t.total_extra_hours || 0)),
      });
    } else {
      // Uma linha por apontamento
      // _date usa a DATA DO APONTAMENTO para que o filtro de período funcione
      ticketEntries.forEach((e) => {
        let inicio = e.start_time || "";
        let fim    = e.end_time || "";
        if (e.start_time2 && e.end_time2) {
          inicio += ` / ${e.start_time2}`;
          fim    += ` / ${e.end_time2}`;
        }
        const nh        = entryNormalH(e);
        const eh        = entryExtraH(e);
        const entryDate = e.date ? String(e.date).slice(0, 10) : (e.created_date ? String(e.created_date).slice(0, 10) : null);
        rows.push({
          ...base,
          tecnico:       e.technician_name || e.technician_email || "",
          data_registro: fmtDateOnly(entryDate),
          inicio,
          fim,
          tipo_hora:     e.hour_type === "interna" ? "Interna" : "Normal",
          horas_normais: nh,
          horas_extras:  eh,
          total_horas:   round(nh + eh),
          _date:         entryDate,
        });
      });
    }
  });
  return rows;
}

export const REPORTS = [
  {
    slug: "tickets-detalhado",
    category: "Tickets",
    title: "Tickets Detalhado",
    description: "Listagem completa de tickets com status, responsável, cliente e horas trabalhadas.",
    dateLabel: "Período do apontamento",
    radio: {
      label: "Tipo de ticket",
      options: [
        { value: "all", label: "Implantação e suporte" },
        { value: "implantacao", label: "Implantação" },
        { value: "suporte", label: "Suporte" },
      ],
      apply: (row, v) => v === "all" || row._main_type === v,
    },
    filters: [
      { key: "responsavel",  label: "Responsável" },
      { key: "tecnico",      label: "Técnico" },
      { key: "status",       label: "Status" },
      { key: "cliente",      label: "Cliente" },
      { key: "urgencia",     label: "Urgência" },
      { key: "vertical",     label: "Vertical" },
      { key: "tipo_hora",    label: "Tipo hora" },
    ],
    checkbox: { label: "Mostrar apenas com horas apontadas", apply: (row) => row.total_horas > 0 },
    columns: [
      { key: "numero",           label: "Nº",              width: 80  },
      { key: "titulo",           label: "Título",          width: 280 },
      { key: "cliente",          label: "Cliente",         width: 180 },
      { key: "vertical",         label: "Vertical"                    },
      { key: "tipo",             label: "Tipo de ticket",  width: 160 },
      { key: "tipo_servico",     label: "Tipo de serviço", width: 200 },
      { key: "urgencia",         label: "Urgência"                    },
      { key: "status",           label: "Status",          width: 160 },
      { key: "responsavel",      label: "Responsável",     width: 180 },
      { key: "solicitante",      label: "Solicitante",     width: 160 },
      { key: "categoria",        label: "Categoria"                   },
      { key: "op",               label: "OP / Pedido",     width: 130 },
      { key: "criado_em",        label: "Criado em"                   },
      { key: "encerrado_em",     label: "Encerrado em"                },
      { key: "previsao",         label: "Previsão"                    },
      { key: "sla_horas",        label: "SLA (h)",         numeric: true },
      { key: "sla_violado",      label: "SLA violado"                 },
      { key: "tempo_resolucao_h",label: "Resolução (h)",   numeric: true, hours: true },
      { key: "tecnico",          label: "Técnico",         width: 180 },
      { key: "data_registro",    label: "Data registro"               },
      { key: "inicio",           label: "Início"                      },
      { key: "fim",              label: "Fim"                         },
      { key: "tipo_hora",        label: "Tipo hora"                   },
      { key: "horas_normais",    label: "H. Normais",      numeric: true, hours: true },
      { key: "horas_extras",     label: "H. Extras",       numeric: true, hours: true },
      { key: "total_horas",      label: "Total Horas",     numeric: true, hours: true },
      { key: "horas_contratadas",label: "H. Contratadas",  numeric: true },
    ],
    fetch: (userEmail, userCargo) => fetchTicketRows(userEmail, userCargo),
  },
  {
    slug: "tickets-sla",
    category: "Tickets",
    title: "SLA e Prazos",
    description: "Cumprimento de SLA, previsões e tempo de resolução por ticket.",
    dateLabel: "Período de criação",
    radio: {
      label: "Situação do SLA",
      options: [
        { value: "all", label: "Todos" },
        { value: "ok", label: "Dentro do SLA" },
        { value: "breached", label: "SLA violado" },
      ],
      apply: (row, v) =>
        v === "all" || (v === "breached" ? row.sla_violado === "Sim" : row.sla_violado === "Não"),
    },
    filters: [
      { key: "responsavel", label: "Agente" },
      { key: "status", label: "Status" },
      { key: "cliente", label: "Cliente" },
      { key: "urgencia", label: "Urgência" },
    ],
    checkbox: { label: "Mostrar apenas tickets encerrados", apply: (row) => !!row.encerrado_em },
    columns: [
      { key: "numero", label: "Nº" },
      { key: "titulo", label: "Título", width: 260 },
      { key: "cliente", label: "Cliente", width: 180 },
      { key: "urgencia", label: "Urgência" },
      { key: "sla_horas", label: "SLA (h)", numeric: true },
      { key: "sla_violado", label: "SLA Violado" },
      { key: "previsao", label: "Previsão" },
      { key: "criado_em", label: "Criado em" },
      { key: "encerrado_em", label: "Encerrado em" },
      { key: "tempo_resolucao_h", label: "Resolução (h)", numeric: true, hours: true },
      { key: "responsavel", label: "Responsável", width: 180 },
      { key: "status", label: "Status", width: 150 },
    ],
    fetch: async (userEmail, userCargo) => {
      const rows = await fetchTicketRows(userEmail, userCargo);
      const seen = new Set();
      return rows.filter((r) => {
        if (seen.has(r._ticket_id)) return false;
        seen.add(r._ticket_id);
        return true;
      });
    },
  },
  {
    slug: "horas-apontadas",
    category: "Horas e Atividades",
    title: "Horas Apontadas",
    description: "Todos os registros de horas por técnico, ticket e tipo de hora.",
    dateLabel: "Período do apontamento",
    radio: {
      label: "Tipo de hora",
      options: [
        { value: "all", label: "Cobráveis e internas" },
        { value: "normal", label: "Cobráveis" },
        { value: "interna", label: "Internas" },
      ],
      apply: (row, v) => v === "all" || row._hour_type === v,
    },
    filters: [
      { key: "tecnico", label: "Agente" },
      { key: "ticket", label: "Ticket" },
      { key: "atividades", label: "Atividade" },
      { key: "tipo", label: "Tipo de hora" },
    ],
    checkbox: { label: "Mostrar apenas com notificação ao cliente", apply: (row) => row._notify },
    columns: [
      { key: "data", label: "Data" },
      { key: "ticket", label: "Ticket", width: 260 },
      { key: "tecnico", label: "Técnico", width: 180 },
      { key: "inicio", label: "Início" },
      { key: "fim", label: "Fim" },
      { key: "horas_normais", label: "H. Normais", numeric: true, hours: true },
      { key: "horas_extras", label: "H. Extras", numeric: true, hours: true },
      { key: "total", label: "Total (h)", numeric: true, hours: true },
      { key: "tipo", label: "Tipo" },
      { key: "atividades", label: "Atividades", width: 220 },
      { key: "notificado", label: "Cliente Notificado" },
    ],
    fetch: async (userEmail, userCargo) => {
      const isGestor = userCargo === "Diretor";
      const entries = isGestor
        ? await listAll(api.entities.TimeEntry)
        : await api.entities.TimeEntry.filter({ technician_email: userEmail });
      return entries.map((e) => {
        const nh = entryNormalH(e);
        const eh = entryExtraH(e);
        return {
          data: e.date ? fmtDateOnly(e.date) : fmtDate(e.created_date),
          ticket: e.ticket_title || e.ticket_id || "",
          tecnico: e.technician_name || e.technician_email || "N/A",
          inicio: e.start_time || "",
          fim: e.end_time || "",
          horas_normais: nh,
          horas_extras: eh,
          total: round(nh + eh),
          tipo: e.hour_type === "interna" ? "Interna" : "Normal",
          atividades: (e.activities || []).join(", "),
          notificado: e.notify_client ? "Sim" : "Não",
          _date: e.date || e.created_date,
          _hour_type: e.hour_type || "normal",
          _notify: !!e.notify_client,
        };
      });
    },
  },
  {
    slug: "clientes-carteira",
    category: "Clientes",
    title: "Carteira de Clientes",
    description: "Relação de clientes com status de contrato, segmento e localização.",
    dateLabel: "Período de cadastro",
    radio: {
      label: "Situação do contrato",
      options: [
        { value: "all", label: "Ativos e cancelados" },
        { value: "ativo", label: "Ativos" },
        { value: "cancelado", label: "Cancelados" },
      ],
      apply: (row, v) => v === "all" || row._contrato === v,
    },
    filters: [
      { key: "status", label: "Status" },
      { key: "segmento", label: "Segmento" },
      { key: "uf", label: "UF" },
      { key: "municipio", label: "Município" },
    ],
    checkbox: { label: "Mostrar apenas com e-mail cadastrado", apply: (row) => !!row.email },
    columns: [
      { key: "nome_fantasia", label: "Nome Fantasia", width: 220 },
      { key: "empresa", label: "Razão Social", width: 220 },
      { key: "email", label: "E-mail", width: 200 },
      { key: "telefone", label: "Telefone" },
      { key: "municipio", label: "Município" },
      { key: "uf", label: "UF" },
      { key: "status", label: "Status" },
      { key: "contrato", label: "Contrato" },
      { key: "segmento", label: "Segmento" },
      { key: "cadastro", label: "Cadastro" },
    ],
    fetch: async () => {
      const clients = await api.entities.Client.list("-created_date", 1000);
      return clients.map((c) => ({
        nome_fantasia: c.nome_fantasia || c.name || "",
        empresa: c.empresa || c.razao_social || "",
        email: c.email || "",
        telefone: c.telefone || c.phone || "",
        municipio: c.municipio || "",
        uf: c.uf || "",
        status: c.status || "",
        contrato: c.status_contrato || "",
        segmento: c.segmento || "",
        cadastro: fmtDate(c.created_date),
        _date: c.created_date,
        _contrato: c.status_contrato || "ativo",
      }));
    },
  },
];

export const REPORT_CATEGORIES = [...new Set(REPORTS.map((r) => r.category))];
export const getReport = (slug) => REPORTS.find((r) => r.slug === slug);