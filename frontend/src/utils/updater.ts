/**
 * 检查更新（Gitee Releases）
 * Rust 侧提供四个命令：check_update / download_update / cancel_download / install_update
 * 流程：比对版本 → 发现新版交由用户决定 → 下载（进度条+可取消）→ 退出程序并唤起安装器
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@/utils/secureStore'

export interface UpdateInfo {
  has_update: boolean
  latest_version: string
  current_version: string
  download_url: string
  release_notes: string
}

export interface DownloadProgress {
  received: number
  total: number
  percent: number
}

export type UpdatePhase =
  | 'idle' // 初始（未检查）
  | 'checking' // 检查中
  | 'available' // 发现新版，等待用户决定是否下载
  | 'downloading' // 下载中（进度条 + 可取消）
  | 'ready' // 下载完成，等待安装

/** 检查更新：返回最新版本信息（无网络/解析失败时抛错） */
export function checkUpdate(): Promise<UpdateInfo> {
  if (!isTauri()) return Promise.reject(new Error('仅桌面端支持检查更新'))
  return invoke<UpdateInfo>('check_update')
}

/** 下载安装包（流式，进度经 update-progress 事件广播），返回本地文件路径 */
export function downloadUpdate(url: string): Promise<string> {
  return invoke<string>('download_update', { downloadUrl: url })
}

/** 取消正在进行的下载（Rust 侧会删除临时文件并中断） */
export function cancelDownload(): Promise<void> {
  return invoke<void>('cancel_download')
}

/** 退出程序并启动安装器（不返回） */
export function installUpdate(installerPath: string): Promise<void> {
  return invoke<void>('install_update', { installerPath })
}

/** 订阅下载进度事件，返回取消订阅函数 */
export function onUpdateProgress(
  cb: (p: DownloadProgress) => void
): Promise<() => void> {
  return listen<DownloadProgress>('update-progress', (e) => cb(e.payload))
}

// ===== 新版本提醒去重（每次应用运行只提醒一次） =====
// 模块级状态：Dashboard 从管理后台返回时会重新挂载，但模块不会重新加载，
// 由此保证静默检查的 toast 在一次运行内只弹一次
let updateRemindedThisRun = false

export function hasRemindedUpdate(): boolean {
  return updateRemindedThisRun
}

export function markUpdateReminded(): void {
  updateRemindedThisRun = true
}
