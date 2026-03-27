import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin: hasAccess } = await isAdmin();

  if (!hasAccess) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen">
      <AdminSidebar />
      <main className="lg:pl-64">
        <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
