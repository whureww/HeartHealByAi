import { type ComponentPublicInstance } from 'vue'

let dialogInstance: ComponentPublicInstance | null = null
let callCount = 0
const MAX_CALLS = 15
const WINDOW_MS = 5000

export function setDialogInstance(instance: any) {
  dialogInstance = instance
}

export async function showDialog(options: {
  title?: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  showCancel?: boolean
  cancelText?: string
  confirmText?: string
  confirmClass?: string
}): Promise<boolean> {
  if (!dialogInstance) {
    console.error('Dialog instance not found')
    return false
  }

  const safeOptions = {
    ...options,
    title: String(options?.title || '提示'),
    message: String(options?.message || '未知错误')
  }

  callCount++
  setTimeout(() => {
    callCount = Math.max(0, callCount - 1)
  }, WINDOW_MS)

  if (callCount > MAX_CALLS) {
    console.warn('[Dialog] Rate limit exceeded, skipping:', safeOptions.message)
    return false
  }

  try {
    const result = await (dialogInstance as any).show(safeOptions)
    return result
  } catch (e) {
    console.error('Dialog show failed:', e)
    return false
  }
}

export const alert = (message: string, title?: string) => {
  return showDialog({ title: title || '提示', message: String(message || ''), type: 'info' })
}

export const confirm = (message: string, title?: string) => {
  return showDialog({ title: title || '确认', message: String(message || ''), type: 'warning', showCancel: true })
}

export const success = (message: string, title?: string) => {
  return showDialog({ title: title || '成功', message: String(message || ''), type: 'success' })
}

export const error = (message: string, title?: string) => {
  return showDialog({ title: title || '错误', message: String(message || '未知错误'), type: 'error' })
}
