import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import { MainNav } from "@/components/MainNav";
import "./globals.css";

// Шрифти адмін-панелі (UI UX Pro Max, «Dashboard Data»), з кирилицею.
const firaSans = Fira_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});
const firaCode = Fira_Code({
  subsets: ["latin", "cyrillic"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Панель виробництва",
  description: "Планування виробництва меблів",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={`h-full antialiased ${firaSans.variable} ${firaCode.variable}`}>
      <body className="min-h-full">
        <AuthGate>
          <MainNav />
          {children}
        </AuthGate>
      </body>
    </html>
  );
}
