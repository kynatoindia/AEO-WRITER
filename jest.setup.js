import '@testing-library/jest-dom'

// Polyfills for Node.js environment - use built-in fetch in Node 18+
if (!global.fetch) {
  global.fetch = require('node-fetch')
  global.Request = require('node-fetch').Request
  global.Response = require('node-fetch').Response
}

// Add Web Streams API polyfills for Node < 18
if (!global.ReadableStream) {
  try {
    const { ReadableStream, WritableStream, TransformStream } = require('node:stream/web')
    global.ReadableStream = ReadableStream
    global.WritableStream = WritableStream
    global.TransformStream = TransformStream
  } catch (e) {
    // Fallback for older Node versions
    const { ReadableStream, WritableStream, TransformStream } = require('web-streams-polyfill')
    global.ReadableStream = ReadableStream
    global.WritableStream = WritableStream
    global.TransformStream = TransformStream
  }
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ''
  },
}))

// Mock Supabase
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  })),
  createServerComponentClient: jest.fn(),
  createRouteHandlerClient: jest.fn(),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.GOOGLE_AI_API_KEY = 'test-google-key'
process.env.TAVILY_API_KEY = 'test-tavily-key'
process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token'