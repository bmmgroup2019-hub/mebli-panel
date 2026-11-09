import { MaterialsSection } from "@/components/admin/MaterialsAdmin";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function MaterialsAdminPage() {
  return <MaterialsSection />;
}
