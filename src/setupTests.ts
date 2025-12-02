// Mock Supabase client
jest.mock('@/integrations/supabase/client', () => ({
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    },
  }));
  
  // Define import.meta for tests
  Object.defineProperty(globalThis, 'import', {
    value: {
      meta: {
        env: {
          VITE_SUPABASE_URL: 'https://mock-project.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'mock-anon-key',
        },
      },
    },
    writable: true,
  });