// 任务栏消息提醒（QQ 式）：
// 收到新消息且窗口不在前台时——任务栏图标橙色频闪 + 窗口标题改为消息预览
// （任务栏悬浮缩略图与 Alt+Tab 会显示该预览文字）；回到前台自动停止并还原标题。
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@/utils/secureStore'

const APP_TITLE = '心愈 · 心理系统'
let unreadCount = 0
let flashing = false

/** 新消息到达：窗口失焦/隐藏时闪烁任务栏并把消息摘要写进窗口标题 */
export async function flashForMessage(sender: string, content: string) {
  if (!isTauri()) return
  try {
    const win = getCurrentWindow()
    const focused = await win.isFocused()
    const visible = await win.isVisible()
    if (focused && visible) return // 就在前台浏览，不打扰

    unreadCount++
    const text = `${sender}：${String(content || '').replace(/\s+/g, ' ').trim()}`.slice(0, 26)
    await win.setTitle(`【新消息${unreadCount > 1 ? ' ×' + unreadCount : ''}】${text}`)

    if (!flashing) {
      flashing = true
      invoke('flash_taskbar', { stop: false }).catch(() => {})
    }
  } catch (e) {
    console.error('任务栏提醒失败:', e)
  }
}

/** 回到前台/已读：停止闪烁并还原窗口标题 */
export async function clearUnreadFlash() {
  if (!isTauri() || !flashing) return
  unreadCount = 0
  flashing = false
  await getCurrentWindow().setTitle(APP_TITLE).catch(() => {})
  invoke('flash_taskbar', { stop: true }).catch(() => {})
}

/** 应用启动时初始化：窗口获得焦点即清除提醒状态（幂等注册） */
export function initTaskbarNotifier() {
  if (!isTauri()) return
  getCurrentWindow()
    .onFocusChanged(({ payload: focused }) => {
      if (focused) void clearUnreadFlash()
    })
    .catch((e) => console.error('注册焦点监听失败:', e))
}

// 通知去重：多页面各自持有 socket 连接（独立实例），同一条消息会经多个连接到达；
// 按「发送者+内容」做 3 秒窗口去重，保证一条消息只提醒一次
const recentNotifies = new Map<string, number>()

function isDuplicateNotify(sender: string, content: string): boolean {
  const key = `${sender}|${content}`
  const now = Date.now()
  for (const [k, t] of recentNotifies) {
    if (now - t > 3000) recentNotifies.delete(k)
  }
  if (recentNotifies.has(key)) return true
  recentNotifies.set(key, now)
  return false
}

/**
 * 后台消息提醒：仅在窗口不在前台（最小化/隐藏/失焦）时触发——
 * 系统通知（Windows 通知中心，隐藏到托盘也可见）+ 任务栏频闪 + 标题预览。
 * 窗口在前台时不打扰（聊天页内的来信提示由页面自身处理）。
 */
export async function notifyIfBackground(sender: string, content: string) {
  if (!isTauri()) return
  if (isDuplicateNotify(sender, content)) return
  try {
    const win = getCurrentWindow()
    const [focused, visible] = await Promise.all([win.isFocused(), win.isVisible()])
    if (focused && visible) return

    const { showToast } = await import('./notify')
    showToast(`${sender} 发来新消息`, String(content || '').slice(0, 80), true)
    await flashForMessage(sender, content)
  } catch (e) {
    console.error('后台消息提醒失败:', e)
  }
}

/**
 * 全局绑定聊天通知事件（幂等：同一 socket 实例只绑一次）。
 * 挂在全局 socket 上，无论用户当前在哪个页面，后台收到私聊消息都能提醒。
 */
export function bindChatNotification(sock: { on: (event: string, cb: (data: any) => void) => unknown }) {
  const s = sock as any
  if (s.__chatNotifyBound__) return
  s.__chatNotifyBound__ = true
  s.on('chat-notification', (data: { senderName?: string; content?: string }) => {
    void notifyIfBackground(String(data?.senderName || '新消息'), String(data?.content || ''))
  })
}
