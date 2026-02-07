'use client'

import { Toaster, toast } from 'sonner'

// 1. Hii ndio component inayowekwa kwa Layout
export function ToastProvider() {
  return (
    <Toaster 
      position="top-right"
      expand={true}
      richColors
      closeButton
      theme="light"
    />
  )
}

// 2. Hii ndio function unayotumia kutoa alerts mahali popote
export const showToast = {
  success: (title: string, message: string) => {
    toast.success(title, {
      description: message,
    })
  },
  error: (title: string, message: string) => {
    toast.error(title, {
      description: message,
    })
  },
  info: (title: string, message: string) => {
    toast.info(title, {
      description: message,
    })
  },
  promise: (promise: Promise<any>, loading: string, success: string, error: string) => {
    toast.promise(promise, {
      loading: loading,
      success: success,
      error: error,
    })
  }
}