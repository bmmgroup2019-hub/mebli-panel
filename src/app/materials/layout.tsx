import { OfficeOnly } from "@/components/OfficeOnly";

// Розділ не для складальників.
export default function Layout({ children }: LayoutProps<"/materials">) {
  return <OfficeOnly>{children}</OfficeOnly>;
}
