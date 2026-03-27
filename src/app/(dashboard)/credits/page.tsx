"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

const creditPacks = [
  {
    id: "starter",
    name: "Starter",
    credits: 10,
    price: 15,
    perImage: "1.50",
    features: ["10 product shots", "5 model shots", "1 3D model"],
  },
  {
    id: "pro",
    name: "Pro",
    credits: 50,
    price: 60,
    perImage: "1.20",
    popular: true,
    features: ["50 product shots", "25 model shots", "5 3D models", "Priority processing"],
  },
  {
    id: "studio",
    name: "Studio",
    credits: 200,
    price: 200,
    perImage: "1.00",
    features: ["200 product shots", "100 model shots", "20 3D models", "Priority processing", "Bulk download"],
  },
];

export default function CreditsPage() {
  const [credits, setCredits] = useState(0);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCredits() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("credits_remaining")
          .eq("id", user.id)
          .single();
        if (data) setCredits(data.credits_remaining);
      }
      setLoading(false);
    }
    loadCredits();
  }, []);

  const handlePurchase = async (packId: string) => {
    setPurchasing(packId);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
        <p className="text-muted-foreground">Purchase credits to generate jewellery images</p>
      </div>

      {/* Current Balance */}
      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <div className="rounded-full bg-primary/10 p-3">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Current Balance</div>
            <div className="text-3xl font-bold">{loading ? "..." : credits} credits</div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Costs */}
      <div className="rounded-lg border border-border p-4">
        <div className="text-sm font-medium mb-2">Credit Usage</div>
        <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div>Product Shot = <span className="font-medium text-foreground">1 credit</span></div>
          <div>Model Shot = <span className="font-medium text-foreground">2 credits</span></div>
          <div>3D Model = <span className="font-medium text-foreground">5 credits</span></div>
        </div>
      </div>

      {/* Packs */}
      <div className="grid gap-6 md:grid-cols-3">
        {creditPacks.map((pack) => (
          <Card
            key={pack.id}
            className={pack.popular ? "border-primary ring-1 ring-primary" : ""}
          >
            <CardHeader>
              {pack.popular && (
                <Badge className="w-fit mb-2">
                  <Sparkles className="h-3 w-3 mr-1" /> Most Popular
                </Badge>
              )}
              <CardTitle>{pack.name}</CardTitle>
              <CardDescription>{pack.credits} credits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-bold">${pack.price}</div>
                <div className="text-sm text-muted-foreground">~${pack.perImage}/image</div>
              </div>
              <ul className="space-y-2">
                {pack.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={pack.popular ? "default" : "outline"}
                onClick={() => handlePurchase(pack.id)}
                disabled={purchasing !== null}
              >
                {purchasing === pack.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Buy {pack.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
