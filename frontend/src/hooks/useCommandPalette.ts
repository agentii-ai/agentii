import { useState } from 'react'

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  const toggle = () => setOpen((prev) => !prev)

  return { open, setOpen, toggle }
}
