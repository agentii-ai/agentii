/**
 * Coalesces rapid terminal writes into a single xterm.js write() per microtask.
 *
 * Problem: CLIs like goose (reedline) emit multi-part escape sequences for
 * operations like backspace: cursor-left + line-redraw + erase-to-end. When
 * these arrive as separate WebSocket messages, they can land in different
 * render frames if we use requestAnimationFrame, causing xterm.js to paint
 * intermediate states (text shifted left with trailing ghost characters).
 *
 * Solution: Buffer incoming PTY data and flush via queueMicrotask(). This
 * runs at the end of the current event loop tick — after all pending
 * WebSocket onmessage handlers have fired, but before the browser paints.
 * The result: xterm.js always sees the complete escape sequence atomically.
 *
 * Why not requestAnimationFrame?
 * - rAF fires once per paint frame (~16ms). WebSocket messages arriving in
 *   rapid succession within one frame get batched correctly, but messages
 *   that straddle a frame boundary get split — the first batch renders an
 *   incomplete state that's visible for one frame (the "ghost space" bug).
 * - queueMicrotask fires at the end of each event loop task. Since the
 *   browser processes all pending WebSocket messages in one task before
 *   painting, the microtask flush always captures the complete burst.
 *
 * Supports both string and Uint8Array inputs (the two paths in our terminal stack).
 */
export class TerminalWriteCoalescer {
  private pending: Uint8Array[] = []
  private scheduled = false
  private writer: ((data: Uint8Array) => void) | null = null

  constructor(writer: (data: Uint8Array) => void) {
    this.writer = writer
  }

  /** Queue data for the next microtask flush. */
  write(data: string | Uint8Array): void {
    if (typeof data === 'string') {
      this.pending.push(new TextEncoder().encode(data))
    } else {
      this.pending.push(data)
    }

    if (!this.scheduled) {
      this.scheduled = true
      queueMicrotask(() => this.flush())
    }
  }

  /** Flush all pending data as a single concatenated write. */
  private flush(): void {
    this.scheduled = false

    if (this.pending.length === 0) return

    if (this.pending.length === 1) {
      // Fast path — no concatenation needed
      this.writer?.(this.pending[0])
      this.pending.length = 0
      return
    }

    // Concatenate all pending chunks into one buffer
    let totalLen = 0
    for (const chunk of this.pending) {
      totalLen += chunk.byteLength
    }

    const merged = new Uint8Array(totalLen)
    let offset = 0
    for (const chunk of this.pending) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }

    this.pending.length = 0
    this.writer?.(merged)
  }

  /** Cancel any pending flush and release references. */
  dispose(): void {
    // queueMicrotask cannot be cancelled, but setting scheduled=false
    // and clearing pending ensures the next flush is a no-op.
    this.scheduled = false
    this.pending.length = 0
    this.writer = null
  }
}
