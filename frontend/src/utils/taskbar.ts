// 任务栏消息提醒（QQ 式）：
// 收到新消息且窗口不在前台时——任务栏图标橙色频闪 + 窗口标题改为消息预览
// + 任务栏缩略图由 Rust 侧渲染成消息卡片（DWM 图标位图，悬浮即见发送者/内容/未读数）；
// 回到前台自动停止闪烁、还原标题，并直接跳转到未读消息对应的聊天界面（QQ 式点击直达）。
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@/utils/secureStore'

const APP_TITLE = '心愈 · 心理系统'
let unreadCount = 0
let flashing = false
let lastUnreadChatId: number | null = null

// 点击直达聊天：由用户端（Dashboard）与专家端（ExpertLayout）注册各自的路由跳转
let chatOpener: ((appointmentId: number) => void) | null = null

/** 注册「跳转到聊天」回调（后注册者覆盖，两端各自挂载时注册） */
export function registerChatOpener(fn: (appointmentId: number) => void) {
  chatOpener = fn
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

/** 新消息到达：窗口失焦/隐藏时闪烁任务栏 + 标题预览 + 缩略图消息卡片 */
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

    // DWM 图标位图：任务栏悬浮缩略图渲染成消息卡片（发送者 + 内容 + 未读数）
    invoke('set_taskbar_preview', {
      sender,
      content: String(content || '').slice(0, 120),
      unread: unreadCount
    }).catch(() => {})

    if (!flashing) {
      flashing = true
      invoke('flash_taskbar', { stop: false }).catch(() => {})
    }
  } catch (e) {
    console.error('任务栏提醒失败:', e)
  }
}

/** 回到前台/已读：停止闪烁、还原标题、还原缩略图，并跳转到未读聊天 */
export async function clearUnreadFlash() {
  if (!isTauri() || !flashing) return
  unreadCount = 0
  flashing = false
  invoke('clear_taskbar_preview').catch(() => {})
  await getCurrentWindow().setTitle(APP_TITLE).catch(() => {})

  // QQ 式点击直达：回到前台时有未读目标则跳到对应聊天页
  const target = lastUnreadChatId
  lastUnreadChatId = null
  if (target && chatOpener) {
    try {
      chatOpener(target)
    } catch (e) {
      console.error('跳转聊天失败:', e)
    }
  }
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

/**
 * 后台消息提醒统一入口：仅在窗口不在前台（最小化/隐藏/失焦）时触发——
 * 系统通知（Windows 通知中心）+ 任务栏频闪 + 缩略图消息卡片 + 标题预览。
 * 窗口在前台时不打扰（聊天页内的来信提示由页面自身处理）。
 * @param appointmentId 未读消息所属预约 id，回前台时据此跳转聊天
 */
export async function notifyIfBackground(sender: string, content: string, appointmentId?: number) {
  if (!isTauri()) return
  if (isDuplicateNotify(sender, content)) return
  try {
    const win = getCurrentWindow()
    const [focused, visible] = await Promise.all([win.isFocused(), win.isVisible()])
    if (focused && visible) return

    if (appointmentId) lastUnreadChatId = Number(appointmentId)
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
  s.on('chat-notification', (data: { senderName?: string; content?: string; appointmentId?: number }) => {
    void notifyIfBackground(
      String(data?.senderName || '新消息'),
      String(data?.content || ''),
      data?.appointmentId
    )
  })
}
