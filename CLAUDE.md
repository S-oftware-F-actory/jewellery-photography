# CLAUDE.md — GemLens AI Jewellery Photography

## Project Overview
SaaS platform for jewellery stores. Stores upload 3-8 photos of a piece, AI generates professional product shots (white background), model shots (jewellery on AI women), and interactive 3D models with embeddable viewers. Credit-based pricing (seasonal business model). Targeting MENA market, launching in Lebanon.

**Repo:** `S-oftware-F-actory/jewellery-photography`
**Live:** TBD (Vercel)

## Tech Stack
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui (base-ui, NOT radix)
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage)
- **AI Pipeline:** Replicate API (rembg, Flux schnell/dev, Real-ESRGAN, TripoSR)
- **3D Viewer:** Google `<model-viewer>` web component
- **Hosting:** Vercel (frontend) + Supabase (backend)
- **Payment:** NONE for v1. Manual credits from admin. Payment providers (3pay, Whish, Stripe) added later.

## Frontend Rules
- **shadcn/ui ONLY** — no extra component libraries (no Tremor, no MUI, no Chakra)
- shadcn/ui v4 uses **base-ui**, NOT radix. No `asChild` prop on triggers.
- Use predefined Card, Table, Badge, Tabs components for dashboard layouts
- Keep it simple and straightforward — no over-designed custom components

## AI Models (Replicate)
| Task | Model | Est. Cost |
|------|-------|-----------|
| Background removal | cjwbw/rembg | ~$0.002/image |
| Product shot | black-forest-labs/flux-schnell | ~$0.003/image |
| Model shot | black-forest-labs/flux-dev | ~$0.03/image |
| Upscaling | nightmareai/real-esrgan | ~$0.01/image |
| 3D reconstruction | stability-ai/triposr | ~$0.10-0.30/model |

## Credit System
- Credits with expiry (`credits_expires_at` on users table)
- 5 free credits on signup
- Credit costs: product shot = 1, model shot = 2, 3D model = 5
- Admin can manually add/adjust credits for any user
- Credits page shows "Coming Soon" placeholder for payment
- **No Stripe, no payment integration in v1**

## Loading UX (Critical)
All generation loading states MUST show pipeline step progress:
```
Step 1/4: Removing background...
Step 2/4: Generating product shot...
Step 3/4: Enhancing quality...
Step 4/4: Saving to gallery...
```
Use `generation_queue.current_step` + Supabase Realtime to push updates. NEVER show a frozen spinner.

## Architecture

### Generation Pipeline (Async Webhook Flow)
```
User triggers generation
  → POST /api/generate
  → Atomic credit deduction (WHERE credits >= cost)
  → createPrediction() on Replicate (async)
  → Insert generation_queue entry (status: pending)
  → Return 202 Accepted

Replicate completes (30-90 seconds)
  → POST /api/webhook (from Replicate)
  → Download output to Supabase Storage (persistent!)
  → Update generation_queue + generated_images
  → Supabase Realtime notifies frontend
```

### Key Rules
- **Persistent image storage:** ALWAYS download Replicate output URLs to Supabase Storage. Replicate URLs expire after ~1 hour.
- **Atomic credits:** Use `UPDATE users SET credits_remaining = credits_remaining - $cost WHERE credits_remaining >= $cost` — never read-then-write.
- **Atomic uploads:** Upload all images first, then create project + source_images. On any failure, clean up storage.
- **Parallel uploads:** Use Promise.all for multi-image uploads (not sequential for loop).
- **Error sanitization:** Never return raw error messages to client. Log internally, return generic "Something went wrong" for unexpected errors.

## Database Schema

### Tables
- **users** — id, email, name, store_name, credits_remaining, credits_expires_at, plan_tier, avatar_url
- **credit_packs** — id, name, credits, price_usd, popular, active (seed data, for future payment)
- **purchases** — id, user_id, pack_id, credits_added (for future payment tracking)
- **projects** — id, user_id, name, jewellery_type, status, source/generated counts
- **source_images** — id, project_id, storage_path, file_name, file_size, order
- **generated_images** — id, project_id, type, storage_path, model_placement, prompt_used, replicate_prediction_id, status, credits_cost
- **generation_queue** — id, project_id, type, status, current_step, current_step_label, replicate_prediction_id, started_at, completed_at, error
- **embed_configs** — id, project_id, user_id, bg_color, autorotate, lighting_preset, public_token
- **brand_kits** — id, user_id, logo_path, primary_color, secondary_color, watermark_enabled, watermark_position
- **export_presets** — id, user_id, platform, width, height, aspect_ratio, format

### Storage Buckets
- `raw-uploads` — original photos (private)
- `generated` — AI output images (private, signed URLs)
- `3d-models` — GLB/GLTF files (public for embed widget)
- `brand-assets` — logos and watermarks (private)

## Pages / Routes
```
/                           → Landing page
/login                      → Auth
/register                   → Auth
/dashboard                  → Project list + credit balance
/project/new                → Create project + upload
/project/[id]               → Project detail + generation triggers
/project/[id]/3d            → 3D viewer page
/gallery/[id]               → Full gallery view
/credits                    → "Coming Soon" placeholder
/settings                   → Account settings + Brand Kit
/admin                      → Admin dashboard
/admin/users                → User management + credit adjustment
/admin/generations          → Generation monitoring
/embed/[token]              → Public embeddable 3D viewer
/api/generate               → Generation trigger (POST)
/api/webhook                → Replicate webhook handler (POST)
/api/embed/[token]          → Public embed config API (GET)
/api/download/[projectId]   → ZIP download (GET)
```

## Accepted Scope Expansions (from CEO Review)
1. **Brand Kit** — logo upload, brand colors, auto-watermark on all outputs
2. **Social Media Export** — Instagram (1:1), Pinterest (2:3), Facebook (16:9), WhatsApp catalog presets
3. **Before/After Slider** — draggable comparison on project detail + landing page
4. **AR Try-On** — WebXR-based try-on for rings (hand), necklaces (neck), earrings (ears)

## Build Phases

### Phase 1: Architecture Fixes ✅
- [x] Async webhook flow (replace synchronous generation)
- [x] Atomic credit deduction (deduct_credits RPC)
- [x] Atomic upload transaction with cleanup
- [x] Persistent image storage (download Replicate output to Supabase Storage)
- [x] Error message sanitization (generic messages to client, details logged server-side)
- [x] Parallel image uploads (Promise.all)
- [x] Pipeline step progress (generation_queue.current_step + Supabase Realtime)

### Phase 2: Schema Expansions ✅ → ☐
- [ ] Migration: credits_expires_at on users
- [ ] Migration: current_step + current_step_label on generation_queue
- [ ] Migration: brand_kits table
- [ ] Migration: export_presets table
- [ ] Migration: ar_sessions table (for AR Try-On tracking)
- [ ] TypeScript types for new tables

### Phase 3: Admin Dashboard ✅ → ☐
- [ ] Admin layout + auth guard
- [ ] User management page (list, search, credit adjustment)
- [ ] Generation monitoring page (list, filter by status/type, retry failed)
- [ ] Manual credit add/remove with audit log

### Phase 4: Core UX Polish ✅
- [x] Dashboard with shadcn/ui Cards (stats, recent projects, thumbnail previews via signed URLs)
- [x] Credits page "Coming Soon" placeholder (payment buttons disabled, contact CTA)
- [x] Generation progress UI (step-by-step with Realtime, completion/failure states, toast notifications)
- [x] Gallery with actual images (signed URLs from Supabase Storage, working lightbox)
- [x] Download individual images + ZIP download (archiver-based /api/download/[projectId])
- [x] Before/After comparison slider (drag-to-compare component on product shots)

### Phase 5: Brand Kit + Social Export ✅ → ☐
- [ ] Brand Kit settings page (logo upload, color picker, watermark toggle)
- [ ] Auto-watermark on generated images
- [ ] Social export presets (crop/resize to platform dimensions)
- [ ] Export UI on gallery page

### Phase 6: 3D + Embed + AR ✅ → ☐
- [ ] 3D viewer page with model-viewer
- [ ] Embed code generator UI
- [ ] Public embed page
- [ ] AR Try-On (WebXR) — ring/necklace/earring placement

### Phase 7: Logging, Rate Limiting, Polish ✅ → ☐
- [ ] Structured logging on all API routes
- [ ] Rate limiting (/api/generate, /api/embed)
- [ ] Mobile responsive pass
- [ ] Empty states, error states, loading states
- [ ] Landing page polish

## Review Status
- **CEO Review:** CLEARED (2026-03-27) — 4 expansions accepted
- **Eng Review:** CLEARED (2026-03-27) — 6 issues found, all resolved
- **Design Review:** Not yet run
- **Tests:** Deferred (0 tests currently)

## Known Technical Risks
1. **IP-Adapter jewellery placement** — preserving exact design details (stones, settings) on AI models is hard. May need fallback to simpler overlay approach.
2. **3D reconstruction from phone photos** — reflective/metallic jewellery surfaces challenge TripoSR. Quality may vary. Flag as "beta" to users.
3. **AR Try-On (WebXR)** — browser support varies. Needs graceful degradation for unsupported browsers.
