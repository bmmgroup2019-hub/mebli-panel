// Вигадані дані прототипу. Дати рахуються від поточного тижня, щоб календар завжди виглядав актуально.
import { addDays, mondayOf } from "./dates";

export const STAGES = [
  { id: "zamir", label: "Замір" },
  { id: "proekt", label: "Проект" },
  { id: "materialy", label: "Матеріали" },
  { id: "vyrobnytstvo", label: "Виробництво" },
  { id: "montazh", label: "Монтаж" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export type PlanStage = { stage: StageId; start: string; end: string };

export type PlanOrder = { id: string; name: string; deadline: string; stages: PlanStage[] };

type Span = [start: number, end: number];

// Зсуви в днях від понеділка поточного тижня, по одному проміжку на етап.
const SEED: { id: string; name: string; deadline: number; spans: Span[] }[] = [
  { id: "m1", name: "Гардеробна", deadline: 7, spans: [[-28, -28], [-27, -18], [-17, -7], [-6, 3], [4, 6]] },
  { id: "m2", name: "Кухня кутова", deadline: 13, spans: [[-21, -21], [-20, -11], [-10, -1], [0, 9], [10, 12]] },
  { id: "m3", name: "Офісні меблі", deadline: 14, spans: [[-14, -14], [-13, -6], [-5, 2], [3, 12], [13, 16]] },
  { id: "m4", name: "Шафа-купе", deadline: 15, spans: [[-10, -10], [-9, -3], [-2, 6], [7, 14], [15, 16]] },
  { id: "m5", name: "Передпокій", deadline: 24, spans: [[-3, -3], [-2, 5], [6, 12], [13, 19], [20, 21]] },
  { id: "m6", name: "Меблі у ванну", deadline: 28, spans: [[8, 8], [9, 14], [15, 19], [20, 24], [25, 25]] },
  { id: "m7", name: "Дитяча кімната", deadline: 35, spans: [[3, 3], [4, 13], [14, 20], [21, 29], [30, 31]] },
];

export function mockOrders(today: string): PlanOrder[] {
  const monday = mondayOf(today);
  return SEED.map(({ id, name, deadline, spans }) => ({
    id,
    name,
    deadline: addDays(monday, deadline),
    stages: spans.map(([start, end], index) => ({
      stage: STAGES[index].id,
      start: addDays(monday, start),
      end: addDays(monday, end),
    })),
  }));
}
