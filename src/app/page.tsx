import Link from "next/link";
import { Diamond, Camera, Sparkles, Box, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Diamond className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">GemLens</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-sm text-muted-foreground mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Jewellery Photography
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
            Professional jewellery photos
            <br />
            <span className="text-muted-foreground">in seconds, not days</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload a few photos of any piece. Get studio-quality product shots, lifestyle model images,
            and interactive 3D viewers — all powered by AI, at a fraction of the cost.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline">
                See How It Works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Three tools, one platform</h2>
            <p className="mt-4 text-muted-foreground">
              Everything you need for stunning jewellery imagery
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Camera,
                title: "Product Shots",
                description:
                  "Clean white backgrounds, perfect lighting, studio quality. Upload your photos, get e-commerce ready images instantly.",
              },
              {
                icon: Sparkles,
                title: "Model Placement",
                description:
                  "See your jewellery on AI-generated models — rings on hands, necklaces on necks, earrings on ears. Multiple skin tones and poses.",
              },
              {
                icon: Box,
                title: "Interactive 3D",
                description:
                  "Generate a rotatable 3D model from your photos. Embed it on your website with one line of code. Customers can explore every angle.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-8 hover:shadow-md transition-shadow"
              >
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            A fraction of the cost
          </h2>
          <p className="text-muted-foreground mb-12">
            Traditional product photography costs $5-15 per image. With GemLens, generate unlimited
            professional photos for pennies.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: "Starter", credits: 10, price: 15, perImage: "1.50" },
              { name: "Pro", credits: 50, price: 60, perImage: "1.20", popular: true },
              { name: "Studio", credits: 200, price: 200, perImage: "1.00" },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.popular
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="text-xs font-medium text-primary mb-2">Most Popular</div>
                )}
                <div className="text-lg font-semibold">{plan.name}</div>
                <div className="mt-2 text-3xl font-bold">${plan.price}</div>
                <div className="text-sm text-muted-foreground">{plan.credits} credits</div>
                <div className="mt-4 text-sm text-muted-foreground">
                  ~${plan.perImage}/image
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Ready to transform your jewellery photography?
          </h2>
          <p className="text-primary-foreground/80 mb-8">
            Join jewellery stores already saving thousands on product photography.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Diamond className="h-4 w-4" />
            <span>GemLens</span>
          </div>
          <div>&copy; {new Date().getFullYear()} Software Factory. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
