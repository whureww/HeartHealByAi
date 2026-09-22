/**
 * 消息提醒：提示音 + 应用内轻提示
 * 设置读取走 localStorage（与 settings store 持久化同源），避免循环依赖
 * 提示音用 WebAudio 合成两音阶，无音频资源依赖
 */
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

function ensureHost(): HTMLElement {
  let host = document.getElementById('xinyu-toasts')
  if (!host) {
    host = document.createElement('div')
    host.id = 'xinyu-toasts'
    document.body.appendChild(host)
  }
  return host
}

/** 应用内轻提示：右下角浮出 4s 自动消失（不申请系统通知权限） */
export function showToast(title: string, body: string, important = false) {
  if (!shouldNotify(important)) return
  playChime()

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
