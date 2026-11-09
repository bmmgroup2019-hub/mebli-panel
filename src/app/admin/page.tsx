import { AdminHome } from "@/components/admin/AdminShell";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function AdminPage() {
  return <AdminHome />;
}
