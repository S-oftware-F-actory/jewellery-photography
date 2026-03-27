"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderPlus,
  CreditCard,
  Settings,
  Diamond,
  Images,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "New Project", href: "/project/new", icon: FolderPlus },
  { name: "Credits", href: "/credits", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
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
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2">
          <Diamond className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">GemLens</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 transition-colors",
                        pathname === item.href || pathname.startsWith(item.href + "/")
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

            {/* Recent projects placeholder */}
            <li>
              <div className="text-xs font-semibold leading-6 text-muted-foreground">
                Recent Projects
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                <li className="px-2 py-1.5 text-sm text-muted-foreground/60">
                  <Images className="inline h-4 w-4 mr-2" />
                  No projects yet
                </li>
              </ul>
            </li>

            {/* Sign out */}
            <li className="mt-auto">
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
