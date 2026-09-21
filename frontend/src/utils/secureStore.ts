/**
 * 本地加密存储（仅桌面端生效）
 * 数据经 Rust 侧 AES-256-GCM 加密后落盘：
 *   AppData\Roaming\com.xinyu.heart\secure\*.dat
 * 浏览器开发模式下自动降级为空操作（不影响功能调试）
 */
import { invoke } from '@tauri-apps/api/core'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 加密写入（fire-and-forget，内部吞掉异常避免影响主流程） */
export async function secureSet(name: string, value: unknown): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke('secure_write', { name, plaintext: JSON.stringify(value) })
  } catch (e) {
    console.error(`[加密存储] 写入 ${name} 失败:`, e)
  }
}

/** 读取并解密，文件不存在或已损坏返回 null */
export async function secureGet<T = Record<string, string>>(name: string): Promise<T | null> {
  if (!isTauri()) return null
  try {
    const raw = await invoke<string | null>('secure_read', { name })
    return raw ? (JSON.parse(raw) as T) : null
  } catch (e) {
    console.error(`[加密存储] 读取 ${name} 失败:`, e)
    return null
  }
}

/** 删除加密文件（登出时清理会话） */
export async function secureRemove(name: string): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke('secure_delete', { name })
  } catch (e) {
    console.error(`[加密存储] 删除 ${name} 失败:`, e)
  }
}
