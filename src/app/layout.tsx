import type { Metadata, Viewport } from "next";
import { Fira_Code, Manrope } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import { MainNav } from "@/components/MainNav";
import "./globals.css";

// Manrope — геометричний, як напис у лого; Fira Code — для цифр. Обидва з кирилицею.
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});
const firaCode = Fira_Code({
  subsets: ["latin", "cyrillic"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Luxury Mebli — система управління виробництвом",
  description: "Система управління виробництвом корпусних меблів: планування цеху, замовлення, замовники, калькуляція, зарплата, закупка",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={`h-full antialiased ${manrope.variable} ${firaCode.variable}`}>
      <body className="min-h-full">
        <AuthGate>
          <MainNav />
          {/* На ПК місце під бічне меню, на телефоні — під нижню панель. */}
          <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-[var(--nav-w)] lg:transition-[padding] lg:duration-200 print:p-0">{children}</div>
        </AuthGate>
      </body>
    </html>
  );
}
