import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <AdminShell>{children}</AdminShell>
    </main>
  );
}
