"use client";

import type { ReactNode } from "react";

// Спільні стилі й оболонки інтерфейсу: один вигляд полів, кнопок і вікон на всіх сторінках.

/** Поле вводу й список. */
export const field = "w-full min-w-0 rounded-lg border border-line px-2.5 py-2 text-sm text-ink";
/** Звичайна кнопка. */
export const button = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-wash";
/** Головна дія у формі чи вікні: «Зберегти», «Додати», «Створити». */
export const primaryButton = "rounded-lg bg-accent-fill px-3.5 py-2 text-sm font-semibold text-accent-on hover:bg-accent-fill-hover";

/**
 * Вікно поверх сторінки (нативний <dialog>). Закривається Esc, кліком повз вікно або формою method="dialog".
 * labelledBy — id заголовка всередині; size — ширина: md для коротких форм, lg для звичайних.
 */
export function Modal({
  labelledBy,
  onClose,
  size = "lg",
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      aria-labelledby={labelledBy}
      className={`m-auto w-[calc(100%-32px)] ${size === "md" ? "max-w-md" : "max-w-lg"} rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
    >
      {children}
    </dialog>
  );
}
