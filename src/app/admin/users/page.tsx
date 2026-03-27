"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Minus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/types/database";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Credit adjustment dialog
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();

      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleAdjustCredits = async () => {
    if (!selectedUser || !creditAmount || !creditReason.trim()) return;

    setAdjusting(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: parseInt(creditAmount),
          reason: creditReason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to adjust credits");
        return;
      }

      toast.success(
        `Credits adjusted: ${data.previousCredits} → ${data.newCredits}`
      );
      setSelectedUser(null);
      setCreditAmount("");
      setCreditReason("");
      fetchUsers();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">{total} total users</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or store..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || "—"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.store_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.plan_tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {user.credits_remaining}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        Adjust Credits
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Credit Adjustment Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
            <DialogDescription>
              {selectedUser?.email} — Current balance:{" "}
              <strong>{selectedUser?.credits_remaining}</strong> credits
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (positive to add, negative to remove)</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setCreditAmount("10")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  10
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setCreditAmount("50")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  50
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setCreditAmount("100")}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  100
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setCreditAmount("-10")}
                >
                  <Minus className="h-3 w-3 mr-1" />
                  10
                </Button>
              </div>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason (required for audit trail)</Label>
              <Input
                placeholder="e.g., Promotional credits, refund, test account..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
              />
            </div>

            {creditAmount && (
              <p className="text-sm text-muted-foreground">
                New balance will be:{" "}
                <strong>
                  {Math.max(0, (selectedUser?.credits_remaining || 0) + parseInt(creditAmount || "0"))}
                </strong>{" "}
                credits
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustCredits}
              disabled={!creditAmount || parseInt(creditAmount) === 0 || !creditReason.trim() || adjusting}
            >
              {adjusting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
