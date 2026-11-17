import { OfficeOnly } from "@/components/OfficeOnly";

// Лише для тих, хто веде закупки: адміністратор, менеджери, закупівельник.
export default function Layout({ children }: LayoutProps<"/purchases">) {
  return <OfficeOnly purchases>{children}</OfficeOnly>;
}
