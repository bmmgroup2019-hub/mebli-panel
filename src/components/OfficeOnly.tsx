"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSeesOffice, useWeekData } from "@/lib/week-store";

/** Розділ не для складальників: їх одразу ведемо на «Тиждень». */
export function OfficeOnly({ children }: { children: ReactNode }) {
  const data = useWeekData();
  const sees = useSeesOffice();
  const router = useRouter();
  const leave = Boolean(data?.sessionId) && !sees;
  useEffect(() => {
    if (leave) router.replace("/week");
  }, [leave, router]);
  return leave ? null : children;
}
