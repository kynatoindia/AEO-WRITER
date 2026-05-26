# AEO Writer

**Answer Engine Optimization content platform.** Generate research-backed, long-form articles structured for AI search engines (ChatGPT, Perplexity, Google SGE) — not just traditional SEO.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)

---

## What It Does

AEO Writer runs a multi-stage AI pipeline to produce content that answers questions directly — the format AI search engines prefer to cite.

1. **Research** — Scrapes competitor pages and live search results via Tavily
2. **Blueprint** — Builds a structured content outline with SEO metadata and section goals
3. **Generate** — Writes each section in sequence, streaming output live to the editor
4. **Export** — Downloads finished content as Markdown, HTML, or PDF

## Features

- Live streaming writer — watch content appear word by word
- Content blueprint sidebar with per-section progress tracking
- Multi-provider AI: OpenAI, Google Gemini, OpenRouter (bring your own keys)
- Competitor research and SERP analysis baked into every generation
- Project workspace to manage multiple articles
- Supabase auth — email/password and OAuth
- Rate limiting via Upstash Redis
- Event-driven pipeline via Inngest (retries, observability, no timeout limits)
- Self-hostable — deploy to Vercel or any Node.js host

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Background Jobs | Inngest |
| Caching / Rate Limits | Upstash Redis |
| AI Providers | OpenAI, Google Gemini, OpenRouter |
| Research | Tavily API |
| Deployment | Vercel (or self-hosted) |

## Self-Hosting

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Inngest](https://www.inngest.com) account (free tier works)
- An [Upstash](https://upstash.com) Redis database (free tier works)
- At least one AI provider key (OpenAI, Google AI, or OpenRouter)
- A [Tavily](https://tavily.com) API key

### 1. Clone and install

```bash
git clone https://github.com/your-username/aeo-writer.git
cd aeo-writer
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` — see the [Environment Variables](#environment-variables) section below.

### 3. Set up the database

Run the Supabase migrations:

```bash
# Apply migrations to your Supabase project
npx supabase db push
```

Or use the setup script:

```bash
bash scripts/setup-database.sh
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For background jobs (Inngest pipelines) to work locally, also run the Inngest dev server in a separate terminal:

```bash
npx inngest-cli@latest dev
```

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel deploy
```

Set all environment variables in your Vercel project dashboard (or via `vercel env add`).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server only) |
| `DATABASE_URL` | Yes | Postgres connection string (use transaction pooler port 6543) |
| `INNGEST_EVENT_KEY` | Yes | Inngest event key |
| `INNGEST_SIGNING_KEY` | Yes | Inngest signing key |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token |
| `OPENAI_API_KEY` | One AI provider required | OpenAI API key |
| `GOOGLE_AI_API_KEY` | One AI provider required | Google Gemini API key |
| `OPENROUTER_API_KEY` | One AI provider required | OpenRouter API key |
| `TAVILY_API_KEY` | Yes | Tavily web search API key |
| `NEXT_PUBLIC_APP_URL` | Yes | Your deployment URL (e.g. `https://yourdomain.com`) |

See `.env.example` for the full list including optional monitoring and feature flag variables.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes and Inngest handler
│   ├── auth/               # Login / signup pages
│   ├── dashboard/          # Project dashboard
│   └── projects/           # Per-project writer pages
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── dashboard/          # Dashboard views
│   ├── writer/             # Live writer, blueprint sidebar, streaming display
│   ├── project/            # Project creation and management
│   └── auth/               # Auth forms and user nav
├── lib/
│   ├── inngest/            # Background job functions and pipeline logic
│   ├── services/           # AI providers, Tavily, Redis
│   ├── supabase/           # Supabase client helpers
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Utility functions
supabase/
└── migrations/             # SQL migration files
```

## Available Scripts

```bash
npm run dev          # Start development server (Turbopack)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a pull request against `main`

For larger changes, open an issue first to discuss the approach.

## License

MIT License — see [LICENSE](LICENSE) for details.

You are free to use, modify, and distribute this software. Attribution appreciated but not required.
