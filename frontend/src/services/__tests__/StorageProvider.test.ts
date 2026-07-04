import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStorageProvider } from '@/services/createStorageProvider'

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        list: vi.fn().mockResolvedValue({ data: [{ name: 'file.txt', id: '1', metadata: { size: 100 } }], error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(['hello']), error: null }),
        upload: vi.fn().mockResolvedValue({ data: { path: 'proj/file.txt' }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: [{ name: 'file.txt' }], error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
      })),
    },
  },
}))

// Mock config
vi.mock('@/config/api', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-key',
  hasSupabase: () => true,
}))

describe('createStorageProvider', () => {
  it('returns a StorageProvider for a project ID', () => {
    const provider = createStorageProvider('test-project-id')
    expect(provider).toBeDefined()
    expect(provider.list).toBeDefined()
    expect(provider.read).toBeDefined()
    expect(provider.readText).toBeDefined()
    expect(provider.write).toBeDefined()
    expect(provider.delete).toBeDefined()
  })
})

describe('SupabaseStorageProvider', () => {
  let provider: ReturnType<typeof createStorageProvider>

  beforeEach(() => {
    provider = createStorageProvider('test-project-id')
  })

  it('list returns file entries', async () => {
    const entries = await provider.list('/')
    expect(entries).toBeDefined()
    expect(Array.isArray(entries)).toBe(true)
  })

  it('readText returns string content', async () => {
    const text = await provider.readText('file.txt')
    expect(typeof text).toBe('string')
  })

  it('write uploads content', async () => {
    await expect(provider.write('file.txt', new Uint8Array([1, 2, 3]))).resolves.not.toThrow()
  })

  it('delete removes a file', async () => {
    await expect(provider.delete('file.txt')).resolves.not.toThrow()
  })

  it('exists checks file presence', async () => {
    const result = await provider.exists('file.txt')
    expect(typeof result).toBe('boolean')
  })
})
