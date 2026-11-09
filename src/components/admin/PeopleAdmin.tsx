"use client";

import { useState, type ReactNode } from "react";
import type { StageId } from "@/lib/mock-projects";
import {
  addPerson,
  assigneeOf,
  removePerson,
  updatePerson,
  useCurrentUser,
  useWeekData,
  type Person,
} from "@/lib/week-store";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink disabled:opacity-60";
const button = "rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash";
const check = "flex items-center gap-1.5 text-sm text-ink";
const LOGIN_TAKEN = "Такий логін уже є.";
const ROLES: Record<Person["role"], string> = { worker: "Працівник", manager: "Менеджер", admin: "Адміністратор" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-0.5 text-xs text-ink-2">
      {label}
      {children}
    </label>
  );
}

function RoleOptions() {
  return (
    <>
      {Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </>
  );
}

export function PeopleAdmin() {
  const data = useWeekData();
  const [adding, setAdding] = useState(false);
  if (!data) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Люди</h1>
          <p className="text-sm text-ink-2">Людина з&apos;являється в колонках тих етапів, які їй позначено.</p>
        </div>
        {!adding && (
          <button type="button" className={button} onClick={() => setAdding(true)}>Додати людину</button>
        )}
      </div>

      {adding && <AddPersonForm onDone={() => setAdding(false)} />}

      <p className="text-sm text-ink-2">
        {data.stages
          .map((stage) => `${stage.label}: ${data.people.filter((p) => p.stages.includes(stage.id)).length}`)
          .join(" · ")}
      </p>

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {data.people.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            active={data.items.filter((i) => assigneeOf(i, data.people) === person.id && i.doneWeek === null).length}
          />
        ))}
      </ul>
    </>
  );
}

function StageChecks({ name, checked, onToggle }: { name?: string; checked?: StageId[]; onToggle?: (id: StageId, on: boolean) => void }) {
  const stages = useWeekData()?.stages ?? [];
  return (
    <fieldset className="grid gap-1 sm:col-span-3">
      <legend className="text-xs text-ink-2">Етапи</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {stages.map((stage) => (
          <label key={stage.id} className={check}>
            <input
              type="checkbox"
              name={name}
              value={stage.id}
              className="size-4"
              checked={checked ? checked.includes(stage.id) : undefined}
              onChange={onToggle ? (e) => onToggle(stage.id, e.target.checked) : undefined}
            />
            {stage.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function AddPersonForm({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  return (
    <section className="grid gap-2 rounded-lg border border-line bg-surface p-3">
      <h2 className="font-semibold">Нова людина</h2>
      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const text = (name: string) => String(values.get(name) ?? "").trim();
          if (!text("name") || !text("login") || !text("password")) {
            setError("Заповніть ім'я, логін і пароль.");
            return;
          }
          const added = addPerson({
            name: text("name"),
            login: text("login"),
            password: text("password"),
            role: text("role") as Person["role"],
            stages: values.getAll("stages") as StageId[],
          });
          if (added) onDone();
          else setError(LOGIN_TAKEN);
        }}
      >
        <Field label="Ім'я"><input name="name" className={input} /></Field>
        <Field label="Логін"><input name="login" autoComplete="off" className={input} /></Field>
        <Field label="Пароль"><input name="password" autoComplete="off" className={input} /></Field>
        <Field label="Роль">
          <select name="role" className={input} defaultValue="worker"><RoleOptions /></select>
        </Field>
        <StageChecks name="stages" />
        <div className="flex items-end gap-1.5">
          <button type="submit" className={`${button} flex-1`}>Додати</button>
          <button type="button" className={button} onClick={onDone}>Скасувати</button>
        </div>
      </form>
      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
    </section>
  );
}

function PersonRow({ person, active }: { person: Person; active: number }) {
  const user = useCurrentUser();
  const stages = useWeekData()?.stages ?? [];
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const isMe = user?.id === person.id;
  const stageNames = stages.filter((s) => person.stages.includes(s.id)).map((s) => s.label);

  /** Порожнє значення не зберігаємо, повертаємо попереднє. */
  const saveText = (key: "name" | "login" | "password", target: HTMLInputElement) => {
    const value = target.value.trim();
    if (value === person[key]) return;
    const saved = value !== "" && updatePerson(person.id, { [key]: value });
    if (!saved) target.value = person[key];
    setError(value !== "" && !saved ? LOGIN_TAKEN : "");
  };

  const toggleStage = (stage: StageId, on: boolean) => {
    const next = stages.map((s) => s.id).filter((id) => (id === stage ? on : person.stages.includes(id)));
    updatePerson(person.id, { stages: next });
  };

  return (
    <li className="grid gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <span className="font-medium">{person.name}</span>
          {isMe && <span className="text-sm text-ink-2"> (ви)</span>}
          <span className="block text-sm text-ink-2">
            {[ROLES[person.role], stageNames.join(", ") || "без етапу", active > 0 && `в роботі: ${active}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <button type="button" className={button} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Згорнути" : "Змінити"}
        </button>
      </div>

      {open && (
        <div className="grid gap-2 border-t border-line pt-2 sm:grid-cols-4">
          <Field label="Ім'я">
            <input defaultValue={person.name} className={input} onBlur={(e) => saveText("name", e.target)} />
          </Field>
          <Field label="Логін">
            <input defaultValue={person.login} autoComplete="off" className={input} onBlur={(e) => saveText("login", e.target)} />
          </Field>
          <Field label="Пароль">
            <input defaultValue={person.password} autoComplete="off" className={input} onBlur={(e) => saveText("password", e.target)} />
          </Field>
          <Field label="Роль">
            <select
              className={input}
              value={person.role}
              disabled={isMe}
              onChange={(e) => updatePerson(person.id, { role: e.target.value as Person["role"] })}
            >
              <RoleOptions />
            </select>
          </Field>
          <StageChecks checked={person.stages} onToggle={toggleStage} />
          <div className="flex items-end">
            {!isMe && (
              <button type="button" className={`${button} w-full`} onClick={() => removePerson(person.id)}>Прибрати</button>
            )}
          </div>
          {error && <p role="alert" className="text-sm text-critical sm:col-span-4">{error}</p>}
        </div>
      )}
    </li>
  );
}
