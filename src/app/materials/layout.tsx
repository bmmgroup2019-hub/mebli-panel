import { OfficeOnly } from "@/components/OfficeOnly";

// Розділ не для складальників; закупівельнику відкритий.
export default function Layout({ children }: LayoutProps<"/materials">) {
  return <OfficeOnly buyer>{children}</OfficeOnly>;
}
