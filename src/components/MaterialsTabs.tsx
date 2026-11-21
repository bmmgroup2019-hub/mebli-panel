"use client";

import { useState } from "react";
import { MaterialsList } from "./MaterialsList";
import { MaterialsNeed } from "./MaterialsNeed";

const TABS = [
  { id: "list", label: "Довідник" },
  { id: "need", label: "Потреба на проекти" },
] as const;

/** Розділ «Матеріали»: вкладки, як у картці проекту. */
export function MaterialsTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("list");
  return (
    <>
      <div role="tablist" aria-label="Розділи матеріалів" className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
        {TABS.map((t) => (
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
        {tab === "list" ? <MaterialsList /> : <MaterialsNeed />}
      </div>
    </>
  );
}
