# AEO Writer Pro

AI-powered SEO content generation platform built with Next.js 14 and Supabase.

## Features

- **AI-Powered Content Generation**: Uses OpenAI GPT-4 and GPT-4-mini for intelligent content creation
- **Competitor Research**: Automated competitor analysis using Tavily API
- **Real-time Writing**: Watch your content being generated in real-time
- **SEO Optimization**: Built-in SEO best practices and metadata generation
- **Multiple Export Formats**: Export content in Markdown, HTML, and PDF formats

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Next.js API Routes, Server Actions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI Services**: OpenAI API (GPT-4, GPT-4-mini)
- **Web Scraping**: Tavily API
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key
- Tavily API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aeo-writer-saas
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Fill in your environment variables in `.env.local`:
- Supabase URL and keys
- OpenAI API key
- Tavily API key

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                # Shadcn/ui components
│   ├── dashboard/         # Dashboard components
│   ├── project/           # Project management components
│   ├── blueprint/         # Content blueprint components
│   ├── writer/            # Live writer components
│   └── export/            # Export components
├── lib/                   # Utility libraries
│   ├── types/             # TypeScript type definitions
│   ├── validations/       # Zod validation schemas
│   ├── services/          # API service integrations
│   ├── hooks/             # Custom React hooks
│   ├── supabase/          # Supabase client configuration
│   └── utils/             # Utility functions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## Environment Variables

See `.env.example` for required environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
# AEO-WRITER
