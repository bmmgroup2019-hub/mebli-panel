import { PeopleAdmin } from "@/components/admin/PeopleAdmin";

// Вміст з'являється лише після входу, який поки перевіряється в браузері.
export const instant = false;

export default function PeoplePage() {
  return <PeopleAdmin />;
}
