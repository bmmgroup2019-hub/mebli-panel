// Дрібні спільні помічники.

const freshId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Дію виконують двічі: у браузері й на сервері. Щоб нові записи мали однакові id,
// браузер запам'ятовує видані id, а сервер видає ті самі (actions.ts).
let recording: string[] | null = null;
let replaying: string[] | null = null;

export const newId = () => {
  const id = replaying?.shift() ?? freshId();
  recording?.push(id);
  return id;
};

/** Виконати fn, складаючи в into усі видані нею id. */
export function recordIds<T>(into: string[], fn: () => T): T {
  const previous = recording;
  recording = into;
  try {
    return fn();
  } finally {
    recording = previous;
  }
}

/** Виконати fn, видаючи спершу саме ці id. */
export function replayIds<T>(ids: string[], fn: () => T): T {
  const previous = replaying;
  replaying = [...ids];
  try {
    return fn();
  } finally {
    replaying = previous;
  }
}

/** Схоже на id, який видає newId: лише малі латинські літери й цифри. */
export const isIdLike = (id: unknown) => typeof id === "string" && /^[a-z0-9]{8,24}$/.test(id);

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
