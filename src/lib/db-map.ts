// Перетворення даних сайту (WeekData) у рядки таблиць бази й назад.
// Спільне для браузера (рахує, що змінилось) і сервера (читає базу). Таблиці — supabase/migrations.
import { EMPTY_DETAILS, type Company, type Person, type Project, projectLabel, type WeekData } from "./model";

type Row = Record<string, unknown> & { id: string };
export type DbTables = Record<TableName, Row[]>;

/** Таблиці в порядку запису. Зовнішні ключі в базі відкладені до кінця транзакції, тож порядок не критичний. */
export const TABLES = [
  "stages", "issue_types", "refusal_reasons", "spec_groups", "units", "makers", "works", "materials", "settings",
  "people", "clients", "projects", "payments", "project_rows", "extras", "changes", "items", "issues", "payouts",
] as const;
export type TableName = (typeof TABLES)[number];

/** Зміни для `apply_changes`: що записати й що прибрати в кожній таблиці. */
export type DbChange = { table: TableName; upsert: Row[]; delete: string[] };

const orNull = (value: string | null | undefined) => (value ? value : null);

/** Дані сайту → рядки таблиць. Паролів тут немає: їх зберігає Supabase Auth. */
export function toDb(data: WeekData): DbTables {
  const projectIdOf = new Map(data.projects.map((p) => [projectLabel(p), p.id]));
  const forProject = <T,>(pick: (p: Project) => T[], map: (entry: T, p: Project) => Row) =>
    data.projects.flatMap((p) => pick(p).map((entry) => map(entry, p)));
  return {
    stages: data.stages.map((s, position) => ({ id: s.id, position, label: s.label, hint: s.hint, creates_spec: s.createsSpec, pay: s.pay })),
    issue_types: data.issueTypes.map((t) => ({ id: t.id, name: t.name })),
    refusal_reasons: data.refusalReasons.map((r) => ({ id: r.id, name: r.name })),
    spec_groups: data.specGroups.map((g) => ({ id: g.id, name: g.name })),
    units: data.units.map((id) => ({ id })),
    makers: data.makers.map((id) => ({ id })),
    works: data.works.map((w) => ({ id: w.id, name: w.name, unit: w.unit, stage_id: w.stageId, price: w.price })),
    materials: data.materials.map((m) => ({
      id: m.id, group_id: m.groupId, name: m.name, maker: m.maker, unit: m.unit, price: m.price, work_id: m.workId, article: m.article,
    })),
    settings: [{
      id: "main",
      company: data.company,
      margin_percent: data.pricing.marginPercent,
      floor_rate: data.pricing.floorRate,
      floor_stage_id: data.pricing.floorStageId,
    }],
    // auth_user_id веде сервер: тут його немає, тож запис людини його не затирає.
    people: data.people.map((p) => ({ id: p.id, name: p.name, login: p.login, role: p.role, stages: p.stages })),
    clients: data.clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone, address: c.address })),
    projects: data.projects.map((p) => ({
      id: p.id,
      number: p.number,
      client_id: p.clientId,
      product: p.product,
      accepted_on: orNull(p.acceptedOn),
      due_on: orNull(p.dueOn),
      client_price: p.clientPrice,
      manager_id: orNull(p.managerId),
      admin_edited_on: p.adminEditedOn,
      floor: p.floor,
      details: p.details,
      frozen: p.frozen,
      refusal: p.refusal,
    })),
    payments: forProject((p) => p.payments, (pay, p) => ({ id: pay.id, project_id: p.id, date: pay.date, amount: pay.amount, final: Boolean(pay.final) })),
    project_rows: [
      ...forProject((p) => p.spec, (row, p) => projectRow(row, p.id, "spec")),
      ...forProject((p) => p.estimate, (row, p) => projectRow(row, p.id, "estimate")),
    ],
    extras: forProject((p) => p.extras, (e, p) => ({ id: e.id, project_id: p.id, name: e.name, amount: e.amount })),
    changes: forProject((p) => p.changes, (c, p) => ({
      id: c.id, project_id: p.id, date: c.date, author: c.author, key: c.key, label: c.label, from: c.from, to: c.to,
    })),
    // План і проблеми в базі посилаються на проект; підпис — лише для вписаного вручну без проекту.
    items: data.items.map((i) => {
      const projectId = projectIdOf.get(i.order) ?? null;
      return {
        id: i.id,
        project_id: projectId,
        title: projectId ? "" : i.order,
        stage_id: i.stage,
        week: i.week,
        done_week: i.doneWeek,
        done_on: i.doneOn,
        next_id: i.nextId,
        assignee_id: i.assigneeId,
        started_on: i.startedOn,
        admin_marked_on: i.adminMarkedOn,
      };
    }),
    issues: data.issues.map((i) => {
      const projectId = projectIdOf.get(i.order) ?? null;
      return {
        id: i.id,
        project_id: projectId,
        title: projectId ? "" : i.order,
        type_id: i.typeId,
        text: i.text,
        author: i.author,
        created_on: i.createdOn,
        resolved: i.resolved,
      };
    }),
    payouts: data.payouts.map((p) => ({ id: p.id, person_id: p.personId, date: p.date, amount: p.amount, note: p.note })),
  };
}

function projectRow(row: Project["spec"][number], projectId: string, list: "spec" | "estimate"): Row {
  return {
    id: row.id, project_id: projectId, list, group_id: row.groupId, name: row.name,
    quantity: row.quantity, unit: row.unit, note: row.note ?? "", purchase: row.purchase ?? null,
  };
}

/** JSON з ключами за абеткою: база (jsonb) переставляє ключі, а це ще не зміна. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Що змінилось між двома станами: змінені й нові рядки записати, зниклі — прибрати. */
export function diffTables(before: DbTables, after: DbTables): DbChange[] {
  const changes: DbChange[] = [];
  for (const table of TABLES) {
    const old = new Map(before[table].map((row) => [row.id, stable(row)]));
    const now = new Set(after[table].map((row) => row.id));
    const upsert = after[table].filter((row) => old.get(row.id) !== stable(row));
    const removed = before[table].filter((row) => !now.has(row.id)).map((row) => row.id);
    if (upsert.length || removed.length) changes.push({ table, upsert, delete: removed });
  }
  return changes;
}

/** Порожні дані: база ще без жодного запису. */
export function emptyData(): WeekData {
  return {
    company: { name: "", phone: "", address: "", extra: "", installTerms: "", logo: "" },
    stages: [], issueTypes: [], refusalReasons: [], payouts: [], specGroups: [], units: [], makers: [], materials: [], works: [],
    pricing: { marginPercent: 0, floorRate: null, floorStageId: null },
    clients: [], projects: [], items: [], issues: [], people: [], sessionId: null,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- рядки з бази приходять як JSON без типів */
type Loaded = Record<string, any>;

/** Знімок `load_data()` → дані сайту. sessionId і паролі сюди не входять. */
export function fromDb(db: Loaded): WeekData {
  const byProject = (rows: Loaded[]) => {
    const map = new Map<string, Loaded[]>();
    for (const row of rows) map.set(row.project_id, [...(map.get(row.project_id) ?? []), row]);
    return (id: string) => map.get(id) ?? [];
  };
  const payments = byProject(db.payments);
  const rows = byProject(db.project_rows);
  const extras = byProject(db.extras);
  const changes = byProject(db.changes);
  const clients = (db.clients as Loaded[]).map((c) => ({ id: c.id, name: c.name, phone: c.phone, address: c.address }));
  const settings: Loaded | null = db.settings;
  const projects: Project[] = (db.projects as Loaded[]).map((p) => {
    const row = (r: Loaded) => ({
      id: r.id, groupId: r.group_id, name: r.name, quantity: r.quantity, unit: r.unit,
      ...(r.note && { note: r.note }), ...(r.purchase && { purchase: r.purchase }),
    });
    const projectRows = rows(p.id);
    return {
      id: p.id,
      number: p.number,
      clientId: p.client_id,
      client: clients.find((c) => c.id === p.client_id)?.name ?? "",
      product: p.product,
      acceptedOn: p.accepted_on ?? "",
      dueOn: p.due_on ?? "",
      payments: payments(p.id).map((pay) => ({ id: pay.id, date: pay.date, amount: pay.amount, ...(pay.final && { final: true }) })),
      spec: projectRows.filter((r) => r.list === "spec").map(row),
      estimate: projectRows.filter((r) => r.list === "estimate").map(row),
      extras: extras(p.id).map((e) => ({ id: e.id, name: e.name, amount: e.amount })),
      clientPrice: p.client_price,
      managerId: p.manager_id ?? "",
      adminEditedOn: p.admin_edited_on,
      changes: changes(p.id).map((c) => ({ id: c.id, date: c.date, author: c.author, key: c.key, label: c.label, from: c.from, to: c.to })),
      details: { ...EMPTY_DETAILS, ...p.details },
      floor: p.floor,
      refusal: p.refusal,
      frozen: p.frozen,
    };
  });
  const labelOf = new Map(projects.map((p) => [p.id, projectLabel(p)]));
  const order = (r: Loaded) => (r.project_id ? (labelOf.get(r.project_id) ?? "") : r.title);
  const empty = emptyData();
  return {
    company: { ...empty.company, ...(settings?.company as Company | undefined) },
    stages: (db.stages as Loaded[]).map((s) => ({ id: s.id, label: s.label, hint: s.hint, createsSpec: s.creates_spec, pay: s.pay })),
    issueTypes: (db.issue_types as Loaded[]).map((t) => ({ id: t.id, name: t.name })),
    refusalReasons: (db.refusal_reasons as Loaded[]).map((r) => ({ id: r.id, name: r.name })),
    payouts: (db.payouts as Loaded[]).map((p) => ({ id: p.id, personId: p.person_id, date: p.date, amount: p.amount, note: p.note })),
    specGroups: (db.spec_groups as Loaded[]).map((g) => ({ id: g.id, name: g.name })),
    units: (db.units as Loaded[]).map((u) => u.id),
    makers: (db.makers as Loaded[]).map((m) => m.id),
    materials: (db.materials as Loaded[]).map((m) => ({
      id: m.id, groupId: m.group_id, name: m.name, maker: m.maker, unit: m.unit, price: m.price, workId: m.work_id, article: m.article,
    })),
    works: (db.works as Loaded[]).map((w) => ({ id: w.id, name: w.name, unit: w.unit, stageId: w.stage_id, price: w.price })),
    pricing: settings
      ? { marginPercent: settings.margin_percent, floorRate: settings.floor_rate, floorStageId: settings.floor_stage_id }
      : empty.pricing,
    clients,
    projects,
    items: (db.items as Loaded[]).map((i) => ({
      id: i.id, order: order(i), stage: i.stage_id, week: i.week, doneWeek: i.done_week, doneOn: i.done_on,
      nextId: i.next_id, assigneeId: i.assignee_id, startedOn: i.started_on, adminMarkedOn: i.admin_marked_on,
    })),
    issues: (db.issues as Loaded[]).map((i) => ({
      id: i.id, order: order(i), typeId: i.type_id, text: i.text, author: i.author, createdOn: i.created_on, resolved: i.resolved,
    })),
    people: (db.people as Loaded[]).map((p): Person => ({ id: p.id, name: p.name, login: p.login, password: "", role: p.role, stages: p.stages })),
    sessionId: null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
