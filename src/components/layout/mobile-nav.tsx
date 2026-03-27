"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderPlus,
  CreditCard,
  Settings,
  Diamond,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "New Project", href: "/project/new", icon: FolderPlus },
  { name: "Credits", href: "/credits", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-card px-4 py-4 shadow-sm border-b border-border lg:hidden">
      <button onClick={() => setOpen(true)} className="-m-2.5 p-2.5 text-foreground">
        <Menu className="h-6 w-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
              <Diamond className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold tracking-tight">GemLens</span>
            </div>
            <nav className="flex-1 px-4 py-4">
              <ul className="space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
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
            </nav>
            <div className="border-t border-border p-4">
              <button
                onClick={handleSignOut}
                className="group flex w-full gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex-1 flex items-center gap-2">
        <Diamond className="h-5 w-5 text-primary" />
        <span className="text-lg font-bold">GemLens</span>
      </div>
    </div>
  );
}
