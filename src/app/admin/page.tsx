"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, Activity, AlertCircle } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalCreditsIssued: number;
  totalGenerations: number;
  failedGenerations: number;
  recentUsers: Array<{ id: string; email: string; name: string | null; created_at: string }>;
  recentGenerations: Array<{ id: string; type: string; status: string; created_at: string }>;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, gensRes] = await Promise.all([
          fetch("/api/admin/users?page=1"),
          fetch("/api/admin/generations?page=1"),
        ]);

        const usersData = await usersRes.json();
        const gensData = await gensRes.json();

        const users = usersData.users || [];
        const generations = gensData.generations || [];
        const totalCredits = users.reduce(
          (sum: number, u: { credits_remaining: number }) => sum + u.credits_remaining,
          0
        );
        const failed = generations.filter(
          (g: { status: string }) => g.status === "failed"
        ).length;

        setStats({
          totalUsers: usersData.total || 0,
          totalCreditsIssued: totalCredits,
          totalGenerations: gensData.total || 0,
          failedGenerations: failed,
          recentUsers: users.slice(0, 5),
          recentGenerations: generations.slice(0, 5),
        });
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits in Circulation</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCreditsIssued || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalGenerations || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Generations</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats?.failedGenerations || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet</p>
            ) : (
              <div className="space-y-3">
                {stats?.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{user.name || "No name"}</p>
                      <p className="text-muted-foreground">{user.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Generations</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentGenerations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No generations yet</p>
            ) : (
              <div className="space-y-3">
                {stats?.recentGenerations.map((gen) => (
                  <div key={gen.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={gen.status === "completed" ? "default" : gen.status === "failed" ? "destructive" : "secondary"}>
                        {gen.status}
                      </Badge>
                      <span className="capitalize">{gen.type.replace("_", " ")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(gen.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
