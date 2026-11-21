import { useId } from "react";

/**
 * Знак «LM» фірми Luxury Mebli, перемальований у вектор з лого користувача:
 * шафа з дверцятами (L), шухляди, буква M і відчинені дверцята.
 * Колір — currentColor, прорізи — через маску, тож знак видно на будь-якому фоні.
 */
export function LogoMark({ className }: { className?: string }) {
  const mask = useId();
  return (
    <svg viewBox="0 0 916 618" className={className} role="img" aria-label="Luxury Mebli">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="916" height="618">
          {/* Суцільні частини */}
          <rect x="0" y="0" width="166" height="144" fill="#fff" />
          <rect x="0" y="155" width="166" height="463" fill="#fff" />
          <rect x="166" y="452" width="150" height="166" fill="#fff" />
          <path d="M315 0H477L615 374L752 10V447L683 618H546L477 444V618H315Z" fill="#fff" />
          {/* Прорізи: дверцята, ручки, шухляди */}
          <rect x="78" y="12" width="9" height="132" fill="#000" />
          <path d="M14 178H64V580H14" fill="none" stroke="#000" strokeWidth="12" />
          <rect x="79" y="172" width="4" height="415" fill="#000" />
          <rect x="100" y="331" width="8" height="47" fill="#000" />
          <rect x="0" y="588" width="166" height="4" fill="#000" />
          <rect x="166" y="455" width="150" height="4" fill="#000" />
          <rect x="166" y="527" width="150" height="4" fill="#000" />
          <rect x="166" y="607" width="150" height="4" fill="#000" />
          <rect x="251" y="510" width="24" height="4" fill="#000" />
          <rect x="251" y="547" width="24" height="4" fill="#000" />
        </mask>
      </defs>
      <rect width="916" height="618" fill="currentColor" mask={`url(#${mask})`} />
      {/* Відчинені дверцята — контур */}
      <path d="M752 2H914V616H752Z M914 3L877 60L752 447" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

/**
 * Лого з назвою фірми. compact — знак і назва в рядок (верх екрана телефона);
 * інакше як в оригіналі: знак зверху, назва й «Корпусні меблі» під ним (бічне меню).
 */
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-2.5 whitespace-nowrap text-ink ${className}`}>
        <LogoMark className="h-6 w-auto" />
        <span className="text-[13px] font-light uppercase leading-none tracking-[0.2em]">Luxury Mebli</span>
      </span>
    );
  }
  return (
    <span className={`grid justify-items-start gap-3 whitespace-nowrap text-ink ${className}`}>
      <LogoMark className="h-9 w-auto" />
      <span className="grid gap-1.5 leading-none">
        <span className="text-[15px] font-light uppercase tracking-[0.2em]">Luxury Mebli</span>
        <span className="text-[9px] uppercase tracking-[0.34em] text-ink-2">Корпусні меблі</span>
      </span>
    </span>
  );
}
