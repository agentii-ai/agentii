import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning'
  createdAt: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type: Toast['type']) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],

  addToast: (message, type) => {
    const id = `toast-${Date.now()}-${++toastCounter}`
    const toast: Toast = { id, message, type, createdAt: Date.now() }

    set((state) => ({ toasts: [...state.toasts, toast] }))

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 5000)
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
