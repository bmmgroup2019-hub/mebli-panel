import { OfficeOnly } from "@/components/OfficeOnly";

// Розділ не для складальників.
export default function Layout({ children }: LayoutProps<"/projects">) {
  return <OfficeOnly>{children}</OfficeOnly>;
}
