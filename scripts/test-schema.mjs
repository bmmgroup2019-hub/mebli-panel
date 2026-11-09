// Перевірка міграцій і правил доступу на справжньому Postgres (PGlite), без Docker.
// Запуск: npm run test:schema
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let failed = 0;

function check(name, ok, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

// Те, що в Supabase є з коробки.
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

const dir = 'supabase/migrations';
for (const file of readdirSync(dir).sort()) {
  await db.exec(readFileSync(join(dir, file), 'utf8'));
  console.log('Міграція застосована:', file);
}

const OWNER = '00000000-0000-0000-0000-000000000001';
const WORKER = '00000000-0000-0000-0000-000000000002';
const MANAGER = '00000000-0000-0000-0000-000000000003';
const STRANGER = '00000000-0000-0000-0000-000000000004';

for (const id of [OWNER, WORKER, MANAGER, STRANGER]) {
  await db.query('insert into auth.users (id) values ($1)', [id]);
}

async function as(id, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const denied = async (sql, params) => {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    return true;
  }
};

const [first] = await rows('select role, active from public.profiles where id = $1', [OWNER]);
check('перший акаунт — активний власник', first.role === 'owner' && first.active);
const [second] = await rows('select role, active from public.profiles where id = $1', [WORKER]);
check('другий акаунт — неактивний працівник', second.role === 'worker' && !second.active);

// Власник підтверджує людей.
await as(OWNER, async () => {
  await db.query(`update public.profiles set active = true where id = $1`, [WORKER]);
  await db.query(`update public.profiles set active = true, role = 'manager' where id = $1`, [MANAGER]);
});

const [order] = await as(OWNER, () =>
  rows(`insert into public.orders (name) values ('Тест') returning id`),
);
await as(OWNER, async () => {
  await db.query('insert into public.order_finance (order_id, contract_amount) values ($1, 1000)', [order.id]);
  await db.query(`insert into public.payments (order_id, kind, amount) values ($1, 'income', 500)`, [order.id]);
});

// Працівник.
await as(WORKER, async () => {
  check('працівник бачить замовлення', (await rows('select id from public.orders')).length === 1);
  check('працівник не бачить платежів', (await rows('select id from public.payments')).length === 0);
  check('працівник не бачить суму договору', (await rows('select order_id from public.order_finance')).length === 0);
  check(
    'працівник не може додати платіж',
    await denied(`insert into public.payments (order_id, kind, amount) values ($1, 'expense', 1)`, [order.id]),
  );
  await db.query(`update public.profiles set role = 'owner' where id = $1`, [WORKER]);
  await db.query(`insert into public.tasks (title, order_id) values ('Задача', $1)`, [order.id]);
  check('працівник додає задачу', (await rows('select id from public.tasks')).length === 1);
  await db.query('delete from public.orders where id = $1', [order.id]);
});
const [afterEscalation] = await rows('select role from public.profiles where id = $1', [WORKER]);
check('працівник не може підняти собі роль', afterEscalation.role === 'worker');
check('працівник не може видалити замовлення', (await rows('select id from public.orders')).length === 1);

// Менеджер.
await as(MANAGER, async () => {
  check('менеджер бачить платежі', (await rows('select id from public.payments')).length === 1);
  await db.query(`update public.profiles set role = 'owner' where id = $1`, [MANAGER]);
});
const [managerRole] = await rows('select role from public.profiles where id = $1', [MANAGER]);
check('менеджер не може змінювати ролі', managerRole.role === 'manager');

// Непідтверджений акаунт.
await as(STRANGER, async () => {
  check('непідтверджений не бачить замовлень', (await rows('select id from public.orders')).length === 0);
  check('непідтверджений не бачить задач', (await rows('select id from public.tasks')).length === 0);
  const people = await rows('select id from public.profiles');
  check('непідтверджений бачить лише себе', people.length === 1 && people[0].id === STRANGER);
  check('непідтверджений не може додати замовлення', await denied(`insert into public.orders (name) values ('Х')`));
});

// Гість без входу.
await db.exec('set role anon');
check('гість не читає замовлення', await denied('select id from public.orders'));
await db.exec('reset role');

// Обмеження даних.
check('невідомий етап не проходить', await denied(`update public.orders set stage = 'x'`));
check('від\'ємний платіж не проходить', await denied(
  `insert into public.payments (order_id, kind, amount) values ($1, 'income', -1)`, [order.id],
));

await db.close();
console.log(failed ? `\nНе пройдено: ${failed}` : '\nУсі перевірки пройдено');
process.exit(failed ? 1 : 0);
