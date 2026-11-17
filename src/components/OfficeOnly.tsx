"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useCurrentUser, useSeesOffice, useSeesPurchases, useWeekData } from "@/lib/week-store";

/**
 * Розділ не для складальників: їх одразу ведемо на «Тиждень».
 * buyer — розділ відкритий і закупівельнику (наприклад, «Матеріали»);
 * purchases — розділ лише для тих, хто веде закупки («Закупка»).
 */
export function OfficeOnly({ children, buyer = false, purchases = false }: { children: ReactNode; buyer?: boolean; purchases?: boolean }) {
  const data = useWeekData();
  const office = useSeesOffice();
  const seesPurchases = useSeesPurchases();
  const isBuyer = useCurrentUser()?.role === "buyer";
  const router = useRouter();
  const sees = purchases ? seesPurchases : office || (buyer && isBuyer);
  const leave = Boolean(data?.sessionId) && !sees;
  useEffect(() => {
    if (leave) router.replace("/week");
  }, [leave, router]);
  return leave ? null : children;
}
