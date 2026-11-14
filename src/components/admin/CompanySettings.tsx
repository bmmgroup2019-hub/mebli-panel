"use client";

import { useState } from "react";
import { updateCompany, useWeekData, type Company } from "@/lib/week-store";

const input = "w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";

const FIELDS: { key: Exclude<keyof Company, "installTerms" | "logo">; label: string; placeholder: string }[] = [
  { key: "name", label: "Назва", placeholder: "Назва фірми" },
  { key: "phone", label: "Телефон", placeholder: "Телефон для замовників" },
  { key: "address", label: "Адреса", placeholder: "Адреса майстерні або офісу" },
  { key: "extra", label: "Додатково", placeholder: "Сайт, e-mail, ЄДРПОУ — що треба на бланку" },
];

/** Логотип для шапки бланка: зменшуємо до 400 px по довшій стороні, щоб не роздувати дані. */
function LogoField({ logo }: { logo: string }) {
  const [error, setError] = useState("");
  return (
    <div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-ink-2">Логотип</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-20 w-40 place-items-center rounded-md border border-dashed border-line bg-white p-1">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- логотип із даних (data URL), не з файлів сайту
            <img src={logo} alt="Логотип фірми" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-black/50">Немає логотипу</span>
          )}
        </div>
        <label className="cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash">
          {logo ? "Замінити" : "Завантажити"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                updateCompany({ logo: await shrinkImage(file, 400) });
                setError("");
              } catch {
                setError("Не вдалося прочитати зображення. Спробуйте PNG або JPG.");
              }
            }}
          />
        </label>
        {logo && (
          <button type="button" className="rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-wash" onClick={() => updateCompany({ logo: "" })}>
            Прибрати
          </button>
        )}
      </div>
      <p className="text-xs text-ink-2">PNG, JPG або SVG; краще на прозорому чи білому тлі.</p>
      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
    </div>
  );
}

/** Зображення → PNG data URL не більше size px по довшій стороні. */
function shrinkImage(file: File, size: number) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, size / Math.max(image.naturalWidth || size, image.naturalHeight || size));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((image.naturalWidth || size) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || size) * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    image.src = url;
  });
}

/** Реквізити фірми: друкуються в шапці бланка прийому замовлення. Зберігаються, щойно поле втрачає фокус. */
export function CompanySettings() {
  const data = useWeekData();
  if (!data) return null;
  return (
    <section className="grid gap-3">
      <p className="text-sm text-ink-2">Ці дані друкуються в бланку прийому замовлення.</p>
      <LogoField logo={data.company.logo} />
      <div className="grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2">
        {FIELDS.map(({ key, label, placeholder }) => (
          <label key={key} className={`grid gap-0.5 text-xs text-ink-2 ${key === "address" || key === "extra" ? "sm:col-span-2" : ""}`}>
            {label}
            <input
              defaultValue={data.company[key]}
              placeholder={placeholder}
              className={input}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== data.company[key]) updateCompany({ [key]: value });
              }}
            />
          </label>
        ))}
        <label className="grid gap-0.5 text-xs text-ink-2 sm:col-span-2">
          Умови підготовки до монтажу (друкуються в кожному бланку)
          <textarea
            rows={4}
            defaultValue={data.company.installTerms}
            placeholder="Що замовник має зробити до монтажу: рівність стін, електрика, вода…"
            className={input}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value !== data.company.installTerms) updateCompany({ installTerms: value });
            }}
          />
        </label>
      </div>
    </section>
  );
}
