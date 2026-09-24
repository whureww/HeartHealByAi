/**
 * 检查更新（Gitee Releases）
 * Rust 侧提供三个命令：check_update / download_update / install_update
 * 流程：比对版本 → 有新版则下载到临时目录 → 确认后退出程序并唤起安装器
 */
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/utils/secureStore'

export interface UpdateInfo {
  has_update: boolean
  latest_version: string
  current_version: string
  download_url: string
  release_notes: string
}

export type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'ready'

/** 检查更新：返回最新版本信息（无网络/解析失败时抛错） */
export function checkUpdate(): Promise<UpdateInfo> {
  if (!isTauri()) return Promise.reject(new Error('仅桌面端支持检查更新'))
  return invoke<UpdateInfo>('check_update')
}

/** 下载安装包（约 5MB，Gitee 直链），返回本地文件路径 */
export function downloadUpdate(url: string): Promise<string> {
  return invoke<string>('download_update', { downloadUrl: url })
}

/** 退出程序并启动安装器（不返回） */
export function installUpdate(installerPath: string): Promise<void> {
  return invoke<void>('install_update', { installerPath })
}
