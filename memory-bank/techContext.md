# Tech context

## Стек
- Next.js 16 (App Router, TypeScript, `src/`), React 19, Tailwind 4. Ця версія Next.js відрізняється від старіших: перед кодом дивись `node_modules/next/dist/docs/`.
- Пакети Supabase й PGlite встановлено, у сайті поки не використовуються.

## Запуск
`npm.cmd run dev` → http://localhost:3000. У застосунку Claude: конфігурація `panel` у `.claude/launch.json`. Якщо сервер уже запущено з іншої сесії (друга копія падає з «Another next dev server is already running»), відкривати `preview_start` з `url` http://localhost:3000.

Перевірка: `npx.cmd tsc --noEmit` і `npm.cmd run lint`.

## Середовище ПК (Windows 11)
- Node.js і Git встановлено. Docker і Python немає.
- Новий шелл PowerShell може не бачити PATH, тому на початку команди: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
- Викликати `npm.cmd` і `npx.cmd`: `npm.ps1` може блокувати політика виконання.
- Bash-heredoc з апострофами й зворотними лапками ламається: великі заміни писати JS-скриптом (інструментом Write у тимчасовий файл) і запускати `node`. Python немає.

## Особливості коду
- Лінтер із React Compiler: ручний `useMemo` дає помилку `preserve-manual-memoization`, дрібні обчислення писати без нього.
- Кожна сторінка має `export const instant = false`: вхід перевіряється в браузері, а сторінка з `params` без цього дає помилку про prerender.
- Апостроф у тексті JSX писати як `&apos;`.
- Вікна — нативний `<dialog>` з `showModal()` у ref (`MaterialDialog.tsx`).
- Якщо `tsc` скаржиться на `.next/types/validator.ts` (стара або прибрана сторінка), допомагає `npx.cmd next typegen`.
- Після нового експорту в наявному клієнтському файлі сервер розробки може віддавати «Element type is invalid … got undefined». Допомагає перезапуск сервера або винесення в новий файл.

## Перевірка в браузері
- Панель у фоні може не робити скриншоти й не передавати фокус: перевіряти через JS. Поле з onBlur зберігати так: задати value через сеттер, потім `dispatchEvent(new FocusEvent("focusout", { bubbles: true }))`.
- Сховище тримає дані в пам'яті: після ручної зміни localStorage (наприклад, `sessionId` для входу іншою роллю) перезавантажити сторінку, інакше наступний запис затре зміну.
- Скрипт, що перезавантажує або змінює `location`, обривається: перезавантаження — окремим викликом, перевірка — наступним. Без перезавантаження між сторінками — `window.next.router.push(path)`.
- Next 16 тримає попередню сторінку прихованою в DOM: шукати лише у видимому `main` (`[...document.querySelectorAll('main')].find(m => m.checkVisibility())`).

## Git (з 2026-11-09)
- Репозиторій у `E:\DB`, гілка `main`, автор комітів (лише в цьому репозиторії): bmmgroup2019 / bmmgroup2019@gmail.com. Перший коміт — «Прототип панелі виробництва меблів».
- `.gitignore`: без `node_modules`, `.next`, `.env*` (крім `.env.example`), `*.tsbuildinfo`. У репозиторії `memory-bank` і `.claude/skills` — переїжджають на інший ПК.
- Віддалений: приватний https://github.com/bmmgroup2019-hub/mebli-panel (`origin`, `main` відстежує `origin/main`), вхід через Git Credential Manager уже збережено на цьому ПК. Мета — працювати з двох ПК: перед роботою `git pull`, після — коміт і `git push`. Комітити й пушити лише на прохання користувача.

## Другий ПК (з 2026-11-10)
- Репозиторій у `D:\DB` (клон з GitHub). Git 2.56 і Node.js 26.13 LTS поставлено через winget; winget тут падає на джерелі msstore, тому з `--source winget`.
- Автора комітів задано лише в цьому репозиторії, як на першому ПК. `git` у PATH може не бути — викликати `C:\Program Files\Git\cmd\git.exe`.

## Не налаштовано
Проект Supabase, сервіс Render.
