# MockMate

AI-powered mock interview web app that lets users practice HR, Technical, and Case Study interviews with voice input, real-time transcription, and Gemini AI feedback.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/interview-app run dev` — run the frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 + shadcn/ui + Wouter routing
- Auth: Clerk (@clerk/react + @clerk/express + shadcn theme)
- AI: Anthropic Claude (`claude-sonnet-4-6`) via `@workspace/integrations-anthropic-ai`
- API: Express 5 with OpenAPI-first codegen (Orval → TanStack Query hooks + Zod schemas)
- DB: PostgreSQL + Drizzle ORM
- Voice: Web Speech API (SpeechRecognition + SpeechSynthesis)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all endpoints)
- `lib/api-client-react/src/generated/` — generated TanStack Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/db/src/schema/interviews.ts` — DB schema
- `artifacts/api-server/src/routes/interviews/index.ts` — all interview API routes
- `artifacts/interview-app/src/App.tsx` — Clerk + routing setup
- `artifacts/interview-app/src/pages/` — Landing, Dashboard, InterviewSession, Results
- `artifacts/interview-app/src/index.css` — dark navy + electric blue theme vars

## Architecture decisions

- **OpenAPI-first**: All endpoints defined in `openapi.yaml`; client hooks and Zod validators are generated — never written by hand.
- **Clerk on both sides**: `@clerk/react` wraps the frontend; `@clerk/express` middleware validates JWT on every API route via `getAuth(req)`.
- **Voice via Web Speech API**: No third-party voice SDK needed; SpeechRecognition handles mic input, SpeechSynthesis reads questions aloud.
- **Structured AI feedback**: Claude is prompted to return strict JSON with scores, strengths, improvements, per-question feedback, and a summary.
- **Dark-only theme**: CSS vars are set identically in `:root` and `.dark`; `html.dark` class is force-added in App.tsx useEffect.

## Product

- **Landing page**: Marketing hero with feature cards, Sign In / Get Started CTAs.
- **Auth**: Clerk-powered sign up / sign in with email+password, styled to match the dark theme.
- **Dashboard**: Welcome banner, stats bar (total sessions, completed, avg score, HR count), 3 interview type cards (HR / Technical / Case Study), past interviews table with score rings and delete.
- **Interview Session**: Rules screen → voice interview (AI speaks question via TTS, user records answer via STT with live transcript) → AI feedback generation screen.
- **Results page**: Animated SVG score ring, 4 score bars, summary, strengths/improvements bullets, per-question accordion with AI feedback.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Web Speech API requires HTTPS in production (works in dev via Replit proxy).
- `SpeechRecognition` / `SpeechRecognitionEvent` are not in TypeScript's default DOM lib — use local interface declarations and `any` for event types.
- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`.
- Do not run `pnpm dev` at the workspace root — use workflow restart or `pnpm --filter` commands.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
