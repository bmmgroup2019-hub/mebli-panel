/**
 * Український номер телефону у вигляді «067 123 45 67».
 * Можна вписувати як завгодно: «0671234567», «+38 (067) 123-45-67», «380671234567» — код країни 38 відкидаємо.
 */

const LENGTH = 10;

/** Цифри номера без коду країни, не більше 10. */
function digitsOf(text: string) {
  let digits = text.replace(/\D/g, "");
  if (digits.startsWith("38")) digits = digits.slice(2);
  return digits.slice(0, LENGTH);
}

/** Розставляє пробіли 3-3-2-2 під час набору. */
export function formatPhone(text: string) {
  const digits = digitsOf(text);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean).join(" ");
}

/** Повний номер: 10 цифр і починається з 0. Порожній теж годиться — телефон не обов'язковий. */
export function phoneComplete(text: string) {
  const digits = digitsOf(text);
  return digits.length === 0 || (digits.length === LENGTH && digits.startsWith("0"));
}

export const PHONE_HINT = "Телефон: 10 цифр, наприклад 067 123 45 67.";
