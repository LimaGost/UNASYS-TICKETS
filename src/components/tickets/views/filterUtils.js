export const emptyAdvanced = {
  ticketNumber: "", subject: "", description: "",
  requester: "", clientName: "",
  createdFrom: "", createdTo: "",
  expectedFrom: "", expectedTo: "",
  closedFrom: "", closedTo: "",
  category: "", status: "",
  slaStatus: "all",   // all | breached | ok
  notified: "all",    // all | yes | no
};

const inRange = (dateStr, from, to) => {
  if (!from && !to) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (from && d < new Date(from + "T00:00:00").getTime()) return false;
  if (to && d > new Date(to + "T23:59:59").getTime()) return false;
  return true;
};

export function countActiveAdvanced(adv) {
  let n = 0;
  Object.entries(adv || {}).forEach(([k, v]) => {
    if (k === "slaStatus" || k === "notified") {
      if (v && v !== "all") n++;
    } else if (v !== "" && v !== null && v !== undefined) {
      n++;
    }
  });
  return n;
}

export function applyAdvancedFilters(tickets, adv) {
  if (!adv || countActiveAdvanced(adv) === 0) return tickets;
  const inc = (a, b) => (a || "").toLowerCase().includes(b.toLowerCase());
  return tickets.filter(t => {
    if (adv.ticketNumber && String(t.ticket_number || "") !== String(adv.ticketNumber).trim()) return false;
    if (adv.subject && !inc(t.title, adv.subject)) return false;
    if (adv.description && !inc(t.description, adv.description)) return false;
    if (adv.requester && !inc(t.requester, adv.requester)) return false;
    if (adv.clientName && !inc(t.client_name, adv.clientName)) return false;
    if (!inRange(t.created_date, adv.createdFrom, adv.createdTo)) return false;
    if (!inRange(t.expected_resolution, adv.expectedFrom, adv.expectedTo)) return false;
    if (!inRange(t.closed_at, adv.closedFrom, adv.closedTo)) return false;
    if (adv.category && t.category !== adv.category) return false;
    if (adv.status && t.status_column_title !== adv.status) return false;
    if (adv.slaStatus === "breached" && !t.sla_breached) return false;
    if (adv.slaStatus === "ok" && t.sla_breached) return false;
    if (adv.notified === "yes" && !t.notified) return false;
    if (adv.notified === "no" && t.notified) return false;
    return true;
  });
}