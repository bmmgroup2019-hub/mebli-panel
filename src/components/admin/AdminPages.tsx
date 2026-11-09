"use client";

// Розділи панелі адміна: кожен бере дані зі сховища сам.
import { useWeekData } from "@/lib/week-store";
import { IssueTypes } from "../IssueTypes";
import { StageSettings } from "../StageSettings";

export function StagesSection() {
  const data = useWeekData();
  return data ? <StageSettings data={data} /> : null;
}

export function IssueTypesSection() {
  const data = useWeekData();
  return data ? <IssueTypes data={data} /> : null;
}
