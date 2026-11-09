"use client";

import { useWeekData } from "@/lib/week-store";
import { MaterialsAdmin } from "./MaterialsAdmin";

/** Розділ панелі «Розрахунки»: роботи, зарплата, вартість. */
export function CalcSection() {
  const data = useWeekData();
  return data ? <MaterialsAdmin data={data} part="calc" /> : null;
}
