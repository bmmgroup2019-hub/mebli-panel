"use client";

import { useState } from "react";
import { useCanManage, useWeekData } from "@/lib/week-store";
import { MaterialsAdmin } from "./admin/MaterialsAdmin";
import { MaterialsList } from "./MaterialsList";
import { MaterialsNeed } from "./MaterialsNeed";

/** settings — лише для тих, хто веде налаштування довідника (адміністратор і менеджери). */
const TABS = [
  { id: "list", label: "Довідник", settings: false },
  { id: "need", label: "Потреба на проекти", settings: false },
  { id: "settings", label: "Налаштування", settings: true },
] as const;

/** Розділ «Матеріали»: вкладки, як у картці проекту. */
export function MaterialsTabs() {
  const data = useWeekData();
  const canSettings = useCanManage();
  const [chosen, setTab] = useState<(typeof TABS)[number]["id"]>("list");
  const tabs = TABS.filter((t) => !t.settings || canSettings);
  // Якщо вкладка стала недоступною (інша роль), повертаємося до довідника.
  const tab = tabs.some((t) => t.id === chosen) ? chosen : "list";
  return (
    <>
      <div role="tablist" aria-label="Розділи матеріалів" className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="materials-tab"
            onClick={() => setTab(t.id)}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-ink-2 hover:text-ink aria-selected:bg-wash aria-selected:font-semibold aria-selected:text-ink"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="materials-tab" aria-labelledby={`tab-${tab}`} className="grid gap-4">
        {tab === "list" && <MaterialsList />}
        {tab === "need" && <MaterialsNeed />}
        {tab === "settings" && data && <MaterialsAdmin data={data} />}
      </div>
    </>
  );
}
