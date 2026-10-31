/**
 * 消息提醒：真实系统通知（Windows 通知中心弹窗）+ 应用内轻提示兜底
 * - 桌面端（Tauri）：走 tauri-plugin-notification，通知出现在系统通知中心，
 *   窗口最小化到托盘/后台时用户依然能看到
 * - 浏览器端：Web Notification API
 * - 系统通知不可用（权限拒绝/环境不支持）时降级为应用内 toast
 * 设置读取走 localStorage（与 settings store 持久化同源），避免循环依赖
 * 提示音用 WebAudio 合成两音阶，无音频资源依赖
 */
import { isTauri } from '@/utils/secureStore'

let audioCtx: AudioContext | null = null

export function playChime() {
  if (localStorage.getItem('soundEnabled') === 'false') return
  try {
    audioCtx = audioCtx || new AudioContext()
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    // A5 → D6 两音，柔和短音
    ;[880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = t + i * 0.18
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.12, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.55)
    })
  } catch {
    // 无声环境（音频设备缺失等）静默失败
  }
}

export function shouldNotify(important = false): boolean {
  const mode = localStorage.getItem('notifications') || 'all'
  if (mode === 'none') return false
  if (mode === 'important' && !important) return false
  return true
}

/** 发送真实系统通知；成功返回 true，失败/不支持返回 false（调用方降级到应用内 toast） */
export async function sendSystemNotification(title: string, body: string): Promise<boolean> {
  try {
    if (isTauri()) {
      const plugin = await import('@tauri-apps/plugin-notification')
      let granted = await plugin.isPermissionGranted()
      if (!granted) {
        granted = (await plugin.requestPermission()) === 'granted'
      }
      if (!granted) return false
      await plugin.sendNotification({ title, body })
      return true
    }

    // 浏览器回退：Web Notification API
    if (!('Notification' in window)) return false
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body, silent: true })
      return true
    }
    return false
  } catch {
    return false
  }
}

function ensureHost(): HTMLElement {
  let host = document.getElementById('xinyu-toasts')
  if (!host) {
    host = document.createElement('div')
    host.id = 'xinyu-toasts'
    document.body.appendChild(host)
  }
  return host
}

/** 应用内轻提示：右下角浮出 4s 自动消失（降级通道，测试通知等场景直接复用） */
export function inAppToast(title: string, body: string) {
  const el = document.createElement('div')
  el.className = 'xinyu-toast'

  const t = document.createElement('div')
  t.className = 'xinyu-toast-title'
  t.textContent = title
  const b = document.createElement('div')
  b.className = 'xinyu-toast-body'
  b.textContent = body
  el.appendChild(t)
  el.appendChild(b)

  ensureHost().appendChild(el)
  requestAnimationFrame(() => el.classList.add('show'))
  window.setTimeout(() => {
    el.classList.remove('show')
    window.setTimeout(() => el.remove(), 300)
  }, 4000)
}

// 通知去重：同一消息可能经多条链路（全局 chat-notification + 页面 new-message）到达，
// 按「内容」做 3 秒窗口去重，保证一条消息只弹一次系统通知（忽略标题措辞差异）
const recentToasts = new Map<string, number>()

function isDuplicateToast(body: string): boolean {
  const now = Date.now()
  for (const [k, t] of recentToasts) {
    if (now - t > 3000) recentToasts.delete(k)
  }
  if (recentToasts.has(body)) return true
  recentToasts.set(body, now)
  return false
}

/**
 * 消息提醒统一入口：提示音 + 真实系统通知（不可用时降级为应用内 toast）。
 * 调用方签名保持不变。
 */
export function showToast(title: string, body: string, important = false) {
  if (!shouldNotify(important)) return
  if (isDuplicateToast(body)) return
  playChime()
  void sendSystemNotification(title, body).then((sent) => {
    if (!sent) inAppToast(title, body)
  })
}
