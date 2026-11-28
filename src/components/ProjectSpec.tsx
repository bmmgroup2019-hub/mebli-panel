"use client";

import { Fragment, useState } from "react";
import { projectLabel, type Material, type Project, type PurchaseStatus, type SpecGroup, type SpecRow, type RowList } from "@/lib/model";
import { findMaterial, money } from "@/lib/materials";
import { frozenNote, pricedData } from "@/lib/prices";
import { addSpecRow, removeSpecRow, setPurchase, updateSpecRow, useProjectAccess, useSpecAccess, useWeekData } from "@/lib/week-store";
import { estimateLocked } from "@/lib/rules";
import { field as input, button } from "./ui";

const columns = "grid grid-cols-[minmax(0,1fr)_96px_auto] gap-1.5 sm:grid-cols-[minmax(0,1fr)_64px_80px_minmax(0,0.45fr)_auto]";
const nameCell = "col-span-3 sm:col-span-1";
// На телефоні примітка — окремим рядком під кількістю, на комп'ютері — стовпчиком перед «×».
const noteCell = "order-last col-span-3 sm:order-none sm:col-span-1";

// Кошторис — таблицею: назва, ціна за одиницю, кількість (з одиницею), сума, примітка, «×».
// Широкий екран — усе в один рядок. Середній — назва на всю ширину, під нею решта колонок.
// Телефон — назва, під нею ціна, кількість і сума, примітка ще нижче.
const estimateColumns =
  "grid grid-cols-[minmax(0,1fr)_56px_auto_minmax(0,1fr)_20px] items-center gap-1.5 " +
  "sm:grid-cols-[104px_64px_48px_112px_minmax(0,1fr)_28px] xl:grid-cols-[minmax(0,1fr)_104px_64px_48px_112px_minmax(0,0.3fr)_28px]";
const estimateName = "col-span-5 sm:col-span-6 xl:col-span-1";
const estimateNote = "order-last col-span-5 sm:order-none sm:col-span-1";
const estimateWide = "col-span-5 sm:col-span-6 xl:col-span-7";
const moneyCell = "whitespace-nowrap text-right tabular-nums";

/** Текст із кількості: порожнє поле або не число дає null. */
function parseQuantity(value: string) {
  const number = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(number) || number < 0 ? null : number;
}

/**
 * Таблиця матеріалів проекту за групами. list="spec" — специфікація конструктора (технічний документ),
 * list="estimate" — кошторис менеджера з вартістю (від нього рахуються вартість проекту й зарплата).
 */
export function ProjectSpec({ project, list = "spec" }: { project: Project; list?: RowList }) {
  const data = useWeekData();
  const spec = useSpecAccess(project);
  const access = useProjectAccess(project);
  const canManage = access.canEdit;
  if (!data) return null;

  const estimate = list === "estimate";
  const locked = estimate && estimateLocked(project);
  const canEdit = estimate ? canManage && !locked : spec.canEdit;
  if (!estimate && !spec.sees) {
    return (
      <section className="grid gap-2">
        <h2 className="font-semibold">Специфікація</h2>
        <p className="text-sm text-ink-2">Специфікація з&apos;явиться тут, коли конструктор завершить свій етап.</p>
      </section>
    );
  }
  const allRows = project[list];
  const empty = allRows.length === 0;
  const title = estimate ? "Кошторис" : "Специфікація";
  // Закупки показуємо лише в специфікації; відмічають адміністратор і менеджер проекту.
  const purchase = estimate ? null : { canMark: access.canPurchase };
  const bought = allRows.filter((row) => row.purchase === "bought").length;
  const ordered = allRows.filter((row) => row.purchase === "ordered").length;

  return (
    <section id="print-spec" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="hidden text-sm print:block">{projectLabel(project)}</p>
          {locked && (
            <p className="text-xs text-warning print:hidden">Аванс внесено: кошторис і додаткові витрати закрито для змін.</p>
          )}
          {estimate && project.frozen && <p className="text-xs text-ink-2 print:hidden">{frozenNote(project.frozen)}</p>}
          {purchase && !empty && (
            <p className="text-xs text-ink-2 print:hidden">
              Закупка: куплено {bought} із {allRows.length}
              {ordered > 0 && `, замовлено ${ordered}`}
            </p>
          )}
        </div>
        {!empty && (
          <button type="button" className={`${button} print:hidden`} onClick={() => window.print()}>Друк</button>
        )}
      </div>

      {empty && !canEdit && <p className="text-sm text-ink-2">{estimate ? "Кошторис ще не складено." : "Специфікацію ще не заповнено."}</p>}

      {data.specGroups.map((group) => (
        <GroupBlock
          key={group.id}
          project={project}
          group={group}
          units={data.units}
          materials={pricedData(data, project).materials.filter((m) => m.groupId === group.id)}
          rows={allRows.filter((row) => row.groupId === group.id)}
          canEdit={canEdit}
          list={list}
          purchase={purchase}
        />
      ))}
    </section>
  );
}

function GroupBlock({
  project,
  group,
  units,
  materials,
  rows,
  canEdit,
  list,
  purchase,
}: {
  project: Project;
  group: SpecGroup;
  units: string[];
  materials: Material[];
  rows: SpecRow[];
  canEdit: boolean;
  list: RowList;
  purchase: { canMark: boolean } | null;
}) {
  if (!canEdit && rows.length === 0) return null;
  const listId = `materials-${group.id}`;
  // У кошторисі видно вартість групи за цінами довідника.
  const groupCost =
    list === "estimate"
      ? rows.reduce((sum, row) => sum + (row.quantity ?? 0) * (findMaterial(materials, row.name)?.price ?? 0), 0)
      : null;

  return (
    <div className={`grid gap-1 ${rows.length === 0 ? "print:hidden" : ""}`}>
      <h3 className="flex justify-between gap-2 text-sm font-semibold text-ink-2">
        {group.name}
        {groupCost !== null && rows.length > 0 && <span className="font-normal tabular-nums">{money(groupCost)}</span>}
      </h3>

      {rows.length > 0 && (
        <table className={`w-full rounded-lg border border-line bg-surface text-sm ${list === "estimate" ? "table-fixed" : ""} ${canEdit ? "hidden print:table" : ""}`}>
          {list === "estimate" ? (
            <thead className="text-xs text-ink-2">
              <tr>
                {/* Однакові ширини колонок, щоб групи стояли рівно одна під одною. На телефоні примітка — під назвою. */}
                <th className="hidden p-2 text-left font-normal sm:table-cell">Найменування</th>
                <th className="w-24 p-2 text-right font-normal sm:w-28">Ціна за од.</th>
                <th className="w-20 p-2 text-right font-normal sm:w-24">Кількість</th>
                <th className="w-24 p-2 text-right font-normal sm:w-32">Сума</th>
                <th className="hidden w-1/5 p-2 text-left font-normal sm:table-cell">Примітка</th>
              </tr>
            </thead>
          ) : (
            <thead className="sr-only">
              <tr>
                <th>Найменування</th>
                <th>Кількість</th>
                <th>Примітка</th>
                {purchase && <th>Закупка</th>}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
              {list === "estimate" && (
                // На телефоні назва й примітка — окремим рядком над числами.
                <tr className="border-t border-line sm:hidden">
                  <td colSpan={3} className="px-2 pt-2">
                    {row.name}
                    {row.note && <span className="block text-xs text-ink-2">{row.note}</span>}
                  </td>
                </tr>
              )}
              <tr className={list === "estimate" ? "sm:border-t sm:border-line" : "border-t border-line first:border-t-0"}>
                <td className={`p-2 align-top ${list === "estimate" ? "hidden sm:table-cell" : ""}`}>{row.name}</td>
                {list === "estimate" && (
                  <td className={`whitespace-nowrap p-2 align-top text-ink-2 ${moneyCell}`}>
                    {unitPrice(findMaterial(materials, row.name))}
                  </td>
                )}
                <td className="whitespace-nowrap p-2 text-right align-top tabular-nums">
                  {row.quantity === null ? "" : row.quantity.toLocaleString("uk-UA")} {findMaterial(materials, row.name)?.unit ?? row.unit}
                </td>
                {list === "estimate" && (
                  <td className={`whitespace-nowrap p-2 align-top font-medium ${moneyCell}`}>
                    {rowSum(row, findMaterial(materials, row.name))}
                  </td>
                )}
                <td className={`p-2 align-top text-xs text-ink-2 ${list === "estimate" ? "hidden sm:table-cell" : ""}`}>{row.note}</td>
                {purchase && (
                  <td className="w-px whitespace-nowrap p-2 text-right print:hidden">
                    <Purchase projectId={project.id} row={row} canMark={purchase.canMark} />
                  </td>
                )}
              </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {canEdit && (
        <div className="grid gap-1.5 rounded-lg border border-line bg-surface p-2 print:hidden">
          {/* Підказки з довідника; назву не з довідника теж можна вписати. */}
          <datalist id={listId}>
            {materials.map((m) => <option key={`${m.id}|${m.name}`} value={m.name} label={m.maker || undefined} />)}
          </datalist>
          {list === "estimate" && <EstimateHeader />}
          {rows.map((row) => (
            <EditRow
              key={row.id}
              projectId={project.id}
              row={row}
              units={units}
              materials={materials}
              listId={listId}
              list={list}
              purchase={purchase}
            />
          ))}
          <AddRow project={project} group={group} units={units} materials={materials} listId={listId} list={list} />
        </div>
      )}
    </div>
  );
}

/** Рядок для нового матеріалу. Одиниця матеріалу з довідника — та, що в довіднику, без вибору; для іншого — вибір. */
function AddRow({
  project,
  group,
  units,
  materials,
  listId,
  list,
}: {
  project: Project;
  group: SpecGroup;
  units: string[];
  materials: Material[];
  listId: string;
  list: RowList;
}) {
  const [typed, setTyped] = useState("");
  const material = findMaterial(materials, typed);
  const estimate = list === "estimate";
  return (
    <form
      className={estimate ? `${estimateColumns} border-t border-line pt-1.5` : columns}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const name = typed.trim();
        if (!name) return;
        addSpecRow(project.id, {
          groupId: group.id,
          name: material?.name ?? name,
          quantity: parseQuantity(String(values.get("quantity") ?? "")),
          unit: material?.unit ?? String(values.get("unit") ?? units[0] ?? ""),
          note: String(values.get("note") ?? "").trim() || undefined,
        }, list);
        form.reset();
        setTyped("");
      }}
    >
      <input
        name="name"
        list={listId}
        autoComplete="off"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        aria-label={`Новий матеріал: ${group.name}`}
        placeholder={materials.length ? "Почніть вводити назву" : "Новий матеріал"}
        className={`${input} ${estimate ? estimateName : nameCell}`}
      />
      {estimate && <span className={`text-xs text-ink-2 sm:text-sm ${moneyCell}`}>{material ? unitPrice(material) : ""}</span>}
      <input name="quantity" inputMode="decimal" aria-label="Кількість" placeholder="К-сть" className={`${input} ${estimate ? "text-right" : ""}`} />
      {material ? (
        <span className={`text-sm text-ink-2 ${estimate ? "" : "self-center px-2"}`}>{material.unit}</span>
      ) : (
        <select name="unit" aria-label="Одиниця" className={input}>
          {units.map((unit) => <option key={unit}>{unit}</option>)}
        </select>
      )}
      {estimate && <span />}
      <input name="note" aria-label={`Примітка до нового матеріалу: ${group.name}`} placeholder="Примітка" className={`${input} ${estimate ? estimateNote : noteCell}`} />
      {estimate ? (
        <button type="submit" aria-label={`Додати матеріал: ${group.name}`} className="text-lg leading-none text-accent hover:text-ink">+</button>
      ) : (
        <button type="submit" className={button}>Додати</button>
      )}
    </form>
  );
}

/** Ціна за одиницю з довідника або «—». */
const unitPrice = (material: Material | undefined) => (material?.price == null ? "—" : money(material.price));

/** Сума рядка кошторису: кількість × ціна довідника, або «—». */
const rowSum = (row: SpecRow, material: Material | undefined) =>
  material?.price == null || row.quantity === null ? "—" : money(row.quantity * material.price);

/** Підписи колонок кошторису над рядками, які можна змінювати. */
function EstimateHeader() {
  return (
    <div className={`${estimateColumns} text-xs text-ink-2`} aria-hidden="true">
      <span className="hidden xl:block">Найменування</span>
      <span className="text-right">Ціна за од.</span>
      <span className="col-span-2 text-center">Кількість</span>
      <span className="text-right">Сума</span>
      <span className="hidden sm:block">Примітка</span>
      <span />
    </div>
  );
}

function EditRow({
  projectId,
  row,
  units,
  materials,
  listId,
  list,
  purchase,
}: {
  projectId: string;
  row: SpecRow;
  units: string[];
  materials: Material[];
  listId: string;
  list: RowList;
  purchase: { canMark: boolean } | null;
}) {
  const material = findMaterial(materials, row.name);
  const known = Boolean(material);
  if (list === "estimate") return <EstimateRow projectId={projectId} row={row} units={units} materials={materials} listId={listId} />;
  return (
    <div className={columns}>
      <input
        aria-label="Найменування"
        list={listId}
        autoComplete="off"
        key={String(row.name)} defaultValue={row.name}
        className={`${input} ${nameCell}`}
        onBlur={(event) => {
          const typed = event.target.value.trim();
          if (!typed) {
            event.target.value = row.name;
            return;
          }
          const material = findMaterial(materials, typed);
          const name = material?.name ?? typed;
          event.target.value = name;
          if (name !== row.name) updateSpecRow(projectId, row.id, material ? { name, unit: material.unit } : { name }, list);
        }}
      />
      <input
        aria-label={`Кількість: ${row.name}`}
        inputMode="decimal"
        key={String(row.quantity ?? "")} defaultValue={row.quantity ?? ""}
        className={input}
        onBlur={(event) => updateSpecRow(projectId, row.id, { quantity: parseQuantity(event.target.value) }, list)}
      />
      {material ? (
        // Одиниця матеріалу з довідника — як у довіднику, вибирати не треба.
        <span className="self-center px-2 text-sm text-ink-2">{material.unit}</span>
      ) : (
        <select
          aria-label={`Одиниця: ${row.name}`}
          className={input}
          value={row.unit}
          onChange={(event) => updateSpecRow(projectId, row.id, { unit: event.target.value }, list)}
        >
          {[...new Set([...units, row.unit])].map((unit) => <option key={unit}>{unit}</option>)}
        </select>
      )}
      <input
        aria-label={`Примітка: ${row.name}`}
        key={String(row.note ?? "")} defaultValue={row.note ?? ""}
        placeholder="Примітка"
        className={`${input} ${noteCell}`}
        onBlur={(event) => {
          const note = event.target.value.trim();
          if (note !== (row.note ?? "")) updateSpecRow(projectId, row.id, { note: note || undefined }, list);
        }}
      />
      <button
        type="button"
        aria-label={`Прибрати: ${row.name}`}
        className="px-2 text-ink-2 hover:text-ink"
        onClick={() => removeSpecRow(projectId, row.id, list)}
      >
        ×
      </button>
      {(!known || (purchase && (purchase.canMark || row.purchase))) && (
        <p className="order-last col-span-3 -mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2 sm:col-span-5">
          <span>{known ? "" : "Не з довідника"}</span>
          {purchase && <Purchase projectId={projectId} row={row} canMark={purchase.canMark} />}
        </p>
      )}
    </div>
  );
}

/** Рядок кошторису, який можна змінювати: колонки, як у таблиці. */
function EstimateRow({
  projectId,
  row,
  units,
  materials,
  listId,
}: {
  projectId: string;
  row: SpecRow;
  units: string[];
  materials: Material[];
  listId: string;
}) {
  const material = findMaterial(materials, row.name);
  return (
    <div className={`${estimateColumns} border-t border-line pt-1.5`}>
      <input
        aria-label="Найменування"
        list={listId}
        autoComplete="off"
        key={String(row.name)} defaultValue={row.name}
        title={row.name}
        className={`${input} ${estimateName}`}
        onBlur={(event) => {
          const typed = event.target.value.trim();
          if (!typed) {
            event.target.value = row.name;
            return;
          }
          const found = findMaterial(materials, typed);
          const name = found?.name ?? typed;
          event.target.value = name;
          if (name !== row.name) updateSpecRow(projectId, row.id, found ? { name, unit: found.unit } : { name }, "estimate");
        }}
      />
      <span className={`text-xs text-ink-2 sm:text-sm ${moneyCell}`}>{unitPrice(material)}</span>
      <input
        aria-label={`Кількість: ${row.name}`}
        inputMode="decimal"
        key={String(row.quantity ?? "")} defaultValue={row.quantity ?? ""}
        className={`${input} text-right`}
        onBlur={(event) => updateSpecRow(projectId, row.id, { quantity: parseQuantity(event.target.value) }, "estimate")}
      />
      {material ? (
        <span className="text-sm text-ink-2">{material.unit}</span>
      ) : (
        <select
          aria-label={`Одиниця: ${row.name}`}
          className={input}
          value={row.unit}
          onChange={(event) => updateSpecRow(projectId, row.id, { unit: event.target.value }, "estimate")}
        >
          {[...new Set([...units, row.unit])].map((unit) => <option key={unit}>{unit}</option>)}
        </select>
      )}
      <span className={`text-sm font-medium ${moneyCell}`}>{rowSum(row, material)}</span>
      <input
        aria-label={`Примітка: ${row.name}`}
        key={String(row.note ?? "")} defaultValue={row.note ?? ""}
        placeholder="Примітка"
        className={`${input} ${estimateNote}`}
        onBlur={(event) => {
          const note = event.target.value.trim();
          if (note !== (row.note ?? "")) updateSpecRow(projectId, row.id, { note: note || undefined }, "estimate");
        }}
      />
      <button
        type="button"
        aria-label={`Прибрати: ${row.name}`}
        className="text-ink-2 hover:text-ink"
        onClick={() => removeSpecRow(projectId, row.id, "estimate")}
      >
        ×
      </button>
      {!material && (
        <p className={`order-last -mt-1 text-xs text-ink-2 ${estimateWide}`}>Не з довідника: без ціни, у вартість не входить</p>
      )}
    </div>
  );
}

const PURCHASE_LABEL: Record<PurchaseStatus, string> = { ordered: "Замовлено", bought: "Куплено" };

/** Стан закупки рядка: вибір для адміністратора й менеджера проекту, підпис для решти. */
function Purchase({ projectId, row, canMark }: { projectId: string; row: SpecRow; canMark: boolean }) {
  if (!canMark) {
    return row.purchase ? (
      <span className={`text-xs ${row.purchase === "bought" ? "font-medium text-ink" : "text-ink-2"}`}>{PURCHASE_LABEL[row.purchase]}</span>
    ) : null;
  }
  return (
    <select
      aria-label={`Закупка: ${row.name}`}
      value={row.purchase ?? ""}
      onChange={(event) => setPurchase(projectId, row.id, (event.target.value || null) as PurchaseStatus | null)}
      className={`rounded border border-line bg-surface px-1 py-0.5 text-xs ${row.purchase === "bought" ? "font-medium text-ink" : "text-ink-2"}`}
    >
      <option value="">Не замовлено</option>
      <option value="ordered">Замовлено</option>
      <option value="bought">Куплено</option>
    </select>
  );
}
