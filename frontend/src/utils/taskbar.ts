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
