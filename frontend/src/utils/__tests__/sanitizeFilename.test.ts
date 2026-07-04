import { describe, it, expect } from 'vitest'
import { sanitizeFilename } from '@/utils/sanitizeFilename'

function textToBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer
}

describe('sanitizeFilename', () => {
  it('replaces spaces with underscores', async () => {
    const result = await sanitizeFilename('hello world.pdf', textToBuffer('test'))
    expect(result.sanitizedName).toMatch(/^hello_world_[a-f0-9]{6}\.pdf$/)
  })

  it('replaces slashes and colons', async () => {
    const result = await sanitizeFilename('2025/09/03:goldman sachs.pdf', textToBuffer('content'))
    expect(result.sanitizedName).toMatch(/^2025_09_03_goldman_sachs_[a-f0-9]{6}\.pdf$/)
  })

  it('collapses consecutive underscores', async () => {
    const result = await sanitizeFilename('a///b:::c.txt', textToBuffer('x'))
    expect(result.sanitizedName).not.toContain('__')
  })

  it('trims leading and trailing underscores', async () => {
    const result = await sanitizeFilename(' leading.txt', textToBuffer('x'))
    expect(result.sanitizedName).not.toMatch(/^_/)
  })

  it('appends 6-char hash', async () => {
    const result = await sanitizeFilename('test.pdf', textToBuffer('hello'))
    expect(result.hash6).toHaveLength(6)
    expect(result.hash6).toMatch(/^[a-f0-9]{6}$/)
    expect(result.sanitizedName).toContain(`_${result.hash6}.pdf`)
  })

  it('preserves extension in lowercase', async () => {
    const result = await sanitizeFilename('Report.PDF', textToBuffer('data'))
    expect(result.sanitizedName).toMatch(/\.pdf$/)
  })

  it('handles files with no extension', async () => {
    const result = await sanitizeFilename('Makefile', textToBuffer('all:'))
    expect(result.sanitizedName).toMatch(/^Makefile_[a-f0-9]{6}$/)
  })

  it('replaces all unfavorable characters', async () => {
    const result = await sanitizeFilename('a?b*c"d<e>f|g#h.txt', textToBuffer('x'))
    expect(result.sanitizedName).not.toMatch(/[?*"<>|#]/)
  })

  it('produces deterministic hash for same content', async () => {
    const buf = textToBuffer('identical content')
    const r1 = await sanitizeFilename('file1.txt', buf)
    const r2 = await sanitizeFilename('file2.txt', buf)
    expect(r1.hash6).toBe(r2.hash6)
  })

  it('produces different hash for different content', async () => {
    const r1 = await sanitizeFilename('file.txt', textToBuffer('content A'))
    const r2 = await sanitizeFilename('file.txt', textToBuffer('content B'))
    expect(r1.hash6).not.toBe(r2.hash6)
  })

  it('returns original name in result', async () => {
    const result = await sanitizeFilename('original name.pdf', textToBuffer('x'))
    expect(result.originalName).toBe('original name.pdf')
  })
})
