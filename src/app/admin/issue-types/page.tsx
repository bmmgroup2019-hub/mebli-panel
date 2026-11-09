import { IssueTypesSection } from "@/components/admin/AdminPages";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function IssueTypesPage() {
  return <IssueTypesSection />;
}
