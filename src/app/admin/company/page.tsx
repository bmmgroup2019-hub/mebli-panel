import { CompanySettings } from "@/components/admin/CompanySettings";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function CompanyPage() {
  return <CompanySettings />;
}
