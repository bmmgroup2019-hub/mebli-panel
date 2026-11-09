import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-4">
      <AdminShell>{children}</AdminShell>
    </main>
  );
}
