// Допоміжне для довідника матеріалів: формати чисел, пошук.
import type { Material } from "./mock-projects";

export const money = (value: number) =>
  `${value.toLocaleString("uk-UA", { maximumFractionDigits: 2 })} грн`;
export const amount = (value: number) => value.toLocaleString("uk-UA", { maximumFractionDigits: 2 });

/** «рядок / рядки / рядків» за правилами української мови. */
export function rowsWord(count: number) {
  const tens = count % 100;
  const ones = count % 10;
  if (tens >= 11 && tens <= 14) return "рядків";
  if (ones === 1) return "рядок";
  if (ones >= 2 && ones <= 4) return "рядки";
  return "рядків";
}

/** Матеріал довідника з такою назвою, без різниці у великих літерах. */
export const findMaterial = (materials: Material[], name: string) =>
  materials.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());

/** Текст для пошуку: усі слова мають знайтися в назві або виробнику. */
export function matches(material: Material, query: string) {
  const text = `${material.name} ${material.maker}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));
}

/** Число з поля: кома теж працює; порожнє, від'ємне або не число дає null. */
export function parseNumber(value: string) {
  const number = Number(value.replace(",", ".").replace(/\s/g, ""));
  return value.trim() === "" || !Number.isFinite(number) || number < 0 ? null : number;
}
