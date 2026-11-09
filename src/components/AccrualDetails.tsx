import { amount, money } from "@/lib/materials";
import type { Accrual } from "@/lib/salary";

/** Як порахована сума етапу: відсоток від матеріалів кошторису, роботи, заноска. */
export function AccrualDetails({ accrual }: { accrual: Accrual }) {
  if (accrual.emptyEstimate && !accrual.carry) {
    return <span className="text-critical">Кошторис ще не складено: сума з&apos;явиться, коли менеджер його заповнить</span>;
  }
  if (accrual.kind === "none" && !accrual.carry) return <span>Зарплата за етап не нараховується</span>;
  return (
    <>
      {accrual.kind === "percent" && (
        <span className="block">
          {accrual.percent > 0 && accrual.handover > 0
            ? `${amount(accrual.percent)}% за прийом + ${amount(accrual.handover)}% за здачу`
            : accrual.part === "handover"
              ? `${amount(accrual.handover)}% за здачу`
              : `${amount(accrual.percent)}%`}{" "}
          від матеріалів на {money(accrual.base)}
        </span>
      )}
      {accrual.kind === "works" &&
        (accrual.lines.length ? (
          accrual.lines.map((line) => (
            <span key={line.name} className="block">
              {line.name}: {amount(line.quantity)} {line.unit} × {money(line.price)}
            </span>
          ))
        ) : (
          <span className="block">Немає матеріалів із роботою цього етапу</span>
        ))}
      {accrual.carry && (
        <span className="block">
          Заноска: {accrual.carry.floor} поверх × {money(accrual.carry.rate)}
        </span>
      )}
      {accrual.missing > 0 && <span className="block text-critical">Не враховано рядків без кількості чи ціни: {accrual.missing}</span>}
    </>
  );
}
