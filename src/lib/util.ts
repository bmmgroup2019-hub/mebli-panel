// Дрібні спільні помічники.

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
