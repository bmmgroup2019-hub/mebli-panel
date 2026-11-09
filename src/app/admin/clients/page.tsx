import { ClientsAdmin } from "@/components/admin/ClientsAdmin";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function ClientsPage() {
  return <ClientsAdmin />;
}
