"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Activity,
  LayoutDashboard,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const adminNav = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Generations", href: "/admin/generations", icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
        {/* Admin Header */}
        <div className="flex h-16 shrink-0 items-center gap-2">
          <Shield className="h-7 w-7 text-destructive" />
          <span className="text-xl font-bold tracking-tight">Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {adminNav.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 transition-colors",
                        pathname === item.href
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>

            {/* Back to dashboard */}
            <li className="mt-auto space-y-1">
              <Link
                href="/dashboard"
                className="group flex gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" />
                Back to Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="group flex w-full gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Sign out
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
}
