// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

/// 下载取消标志（update 流程）
static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

// 应用内置密钥（AES-256-GCM，32 字节）
// 说明：密钥编译进二进制，可防止数据文件被随意读取/篡改，但无法对抗深度逆向
const APP_SECRET: &[u8; 32] = b"XinYu@2026$Secure$Local$Key!!32b";

fn cipher() -> Aes256Gcm {
    Aes256Gcm::new_from_slice(APP_SECRET).expect("invalid key length")
}

fn secure_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {e}"))?
        .join("secure");
    fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {e}"))?;
    Ok(dir)
}

fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("非法的文件名".into());
    }
    Ok(())
}

/// 加密写入本地数据文件（格式: base64(nonce + ciphertext)）
#[tauri::command]
fn secure_write(app: tauri::AppHandle, name: String, plaintext: String) -> Result<(), String> {
    validate_name(&name)?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher()
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| format!("加密失败: {e}"))?;

    let mut payload = nonce.to_vec();
    payload.extend_from_slice(&ciphertext);

    let file = secure_dir(&app)?.join(format!("{name}.dat"));
    fs::write(file, STANDARD.encode(payload)).map_err(|e| format!("写入失败: {e}"))
}

/// 读取并解密本地数据文件，文件不存在或已损坏时返回 null
#[tauri::command]
fn secure_read(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
    validate_name(&name)?;
    let file = secure_dir(&app)?.join(format!("{name}.dat"));
    let raw = match fs::read_to_string(file) {
        Ok(raw) => raw,
        Err(_) => return Ok(None),
    };

    let payload = match STANDARD.decode(raw.trim()) {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };
    if payload.len() < 12 {
        return Ok(None);
    }
    let (nonce_bytes, ciphertext) = payload.split_at(12);
    let plaintext = match cipher().decrypt(Nonce::from_slice(nonce_bytes), ciphertext) {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };
    String::from_utf8(plaintext)
        .map(Some)
        .map_err(|e| format!("解码失败: {e}"))
}

/// 删除本地数据文件
#[tauri::command]
fn secure_delete(app: tauri::AppHandle, name: String) -> Result<(), String> {
    validate_name(&name)?;
    let file = secure_dir(&app)?.join(format!("{name}.dat"));
    if file.exists() {
        fs::remove_file(file).map_err(|e| format!("删除失败: {e}"))?;
    }
    Ok(())
}

/// 真正退出应用（前端“直接退出”选项走此命令，绕过关闭拦截）
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 任务栏闪烁提醒（QQ 式新消息）：窗口失焦时橙色频闪任务栏图标直至回到前台。
/// stop=true 立即停止闪烁（获得焦点/已读时由前端调用）。
#[tauri::command]
fn flash_taskbar(window: tauri::WebviewWindow, stop: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            FlashWindowEx, FLASHWINFO, FLASHW_ALL, FLASHW_STOP, FLASHW_TIMERNOFG,
        };
        // tauri 的 HWND.0 为 *mut c_void，windows-sys 0.52 的 HWND 为 isize，需转换
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
        let dw_flags = if stop { FLASHW_STOP } else { FLASHW_ALL | FLASHW_TIMERNOFG };
        let mut info = FLASHWINFO {
            cbSize: std::mem::size_of::<FLASHWINFO>() as u32,
            hwnd,
            dwFlags: dw_flags,
            uCount: 0, // 0 = 持续闪烁直到 FLASHW_STOP 或窗口到前台
            dwTimeout: 0,
        };
        unsafe { FlashWindowEx(&mut info) };
    }
    Ok(())
}

// ===== 检查更新（Gitee Releases） =====

const GITEE_RELEASES_LATEST: &str =
    "https://gitee.com/api/v5/repos/yxpil/aisprithill/releases/latest";
const SETUP_SUFFIX: &str = "_x64-setup.exe";

/// 语义化版本比较：返回 Some(true) 表示 remote 更新，None 表示解析失败
fn version_is_newer(remote: &str, local: &str) -> Option<bool> {
    let parse = |s: &str| -> Option<Vec<u64>> {
        let core = s.trim().trim_start_matches('v');
        let core = core.split(['-', '_']).next()?; // 去掉 -beta 等后缀
        let mut parts = Vec::new();
        for seg in core.split('.') {
            parts.push(seg.parse::<u64>().ok()?);
        }
        if parts.is_empty() { None } else { Some(parts) }
    };
    let (r, l) = (parse(remote)?, parse(local)?);
    let len = r.len().max(l.len());
    for i in 0..len {
        let rv = r.get(i).copied().unwrap_or(0);
        let lv = l.get(i).copied().unwrap_or(0);
        if rv != lv {
            return Some(rv > lv);
        }
    }
    Some(false) // 相等
}

#[derive(serde::Serialize)]
struct UpdateInfo {
    has_update: bool,
    latest_version: String,
    current_version: String,
    download_url: String,
    release_notes: String,
}

/// 从 release 的 assets 里找 `*_x64-setup.exe` 附件的下载地址
fn find_setup_asset(rel: &serde_json::Value) -> Option<String> {
    let assets = rel.get("assets")?.as_array()?;
    for a in assets {
        let name = a.get("name")?.as_str().unwrap_or("");
        if name.ends_with(SETUP_SUFFIX) {
            if let Some(url) = a.get("browser_download_url").and_then(|v| v.as_str()) {
                return Some(url.to_string());
            }
        }
    }
    None
}

/// 检查更新：对比 Gitee 最新 release 与当前程序版本
#[tauri::command]
fn check_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();

    let resp = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("网络客户端初始化失败: {e}"))?
        .get(GITEE_RELEASES_LATEST)
        .send()
        .map_err(|e| format!("无法连接更新服务器: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("更新服务器响应异常: {}", resp.status()));
    }

    let latest: serde_json::Value =
        resp.json().map_err(|e| format!("解析更新信息失败: {e}"))?;

    if latest.get("tag_name").is_none() {
        return Err("仓库尚未发布任何 Release".into());
    }

    let tag = latest
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let body = latest
        .get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let download_url = find_setup_asset(&latest).unwrap_or_default();

    // tag 形如 v0.0.6_UpDate，先粗提数字段再做精确比较
    let remote_ver = tag
        .split(['_', '-'])
        .find(|seg| seg.starts_with('v') && seg.contains('.'))
        .unwrap_or(tag);

    let has_update = version_is_newer(remote_ver, &current).unwrap_or(false);

    Ok(UpdateInfo {
        has_update,
        latest_version: remote_ver.trim_start_matches('v').to_string(),
        current_version: current,
        download_url,
        release_notes: body,
    })
}

/// 下载新版本安装包到临时目录（流式，向前端广播进度事件 update-progress），
/// 返回本地文件路径。可被 cancel_download 命令随时中断。
#[tauri::command]
fn download_update(app: tauri::AppHandle, download_url: String) -> Result<String, String> {
    if !download_url.ends_with(SETUP_SUFFIX) {
        return Err("下载地址异常，已阻止".into());
    }

    // 取消标志：cancel_download 置位后，读循环检测到即中断
    CANCEL_FLAG.store(true, Ordering::SeqCst); // 先清掉上次残留
    CANCEL_FLAG.store(false, Ordering::SeqCst);

    let resp = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("网络客户端初始化失败: {e}"))?
        .get(&download_url)
        .send()
        .map_err(|e| format!("下载失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("下载失败: HTTP {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(0);
    let file_name = urldecode(download_url.rsplit('/').next().unwrap_or("setup.exe"));
    let path = std::env::temp_dir().join(&file_name);
    let partial_path = std::env::temp_dir().join(format!("{file_name}.part"));

    let mut file = std::fs::File::create(&partial_path).map_err(|e| format!("创建临时文件失败: {e}"))?;
    let mut reader = resp;
    let mut buffer = [0u8; 65536];
    let mut received: u64 = 0;
    let mut last_pct: i32 = -1;

    use std::io::{Read, Write};
    loop {
        if CANCEL_FLAG.load(Ordering::SeqCst) {
            drop(file);
            let _ = std::fs::remove_file(&partial_path);
            // 恢复标志位供下次下载使用
            CANCEL_FLAG.store(false, Ordering::SeqCst);
            return Err("__CANCELLED__".into());
        }
        match reader.read(&mut buffer) {
            Ok(0) => break, // 下载完成
            Ok(n) => {
                file.write_all(&buffer[..n]).map_err(|e| format!("写入失败: {e}"))?;
                received += n as u64;
                let pct = if total > 0 { (received * 100 / total) as i32 } else { -1 };
                // 进度变化 ≥1% 或首尾时才发事件，避免事件风暴
                if pct != last_pct {
                    last_pct = pct;
                    let _ = app.emit("update-progress", serde_json::json!({
                        "received": received,
                        "total": total,
                        "percent": pct
                    }));
                }
            }
            Err(e) => {
                let _ = std::fs::remove_file(&partial_path);
                return Err(format!("下载中断: {e}"));
            }
        }
    }

    if received < 1024 * 1024 {
        let _ = std::fs::remove_file(&partial_path);
        return Err("下载内容异常（体积过小），已放弃安装".into());
    }

    drop(file);
    std::fs::rename(&partial_path, &path).map_err(|e| format!("保存安装包失败: {e}"))?;
    let _ = app.emit("update-progress", serde_json::json!({
        "received": received,
        "total": total,
        "percent": 100
    }));

    Ok(path.to_string_lossy().to_string())
}

/// 取消正在进行的下载
#[tauri::command]
fn cancel_download() {
    CANCEL_FLAG.store(true, Ordering::SeqCst);
}

/// 简易 URL 解码（处理 Gitee 附件中文文件名的百分号编码）
fn urldecode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() + 1 && i + 2 < bytes.len() + 1 {
            if let (Some(h), Some(l)) = (
                bytes.get(i + 1).and_then(|b| (*b as char).to_digit(16)),
                bytes.get(i + 2).and_then(|b| (*b as char).to_digit(16)),
            ) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    // temp 路径统一按 UTF-8 还原中文文件名
    String::from_utf8(out).unwrap_or_else(|_| s.to_string())
}

/// 退出程序并启动新版本安装器
#[tauri::command]
fn install_update(app: tauri::AppHandle, installer_path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&installer_path);
    if !path.exists() || !path.to_string_lossy().ends_with(SETUP_SUFFIX) {
        return Err("安装包无效".into());
    }

    // 直接以子进程启动安装器（exe 本身可直接执行，彻底规避 cmd start 的
    // 引号/中文路径转义问题），子进程独立于父进程，本程序退出不影响其运行
    let spawn = std::process::Command::new(&path).spawn();

    match spawn {
        Ok(_) => {
            // 给安装器进程一点启动时间再退出，防止父进程退出过快导致 shell 解析中断
            std::thread::sleep(std::time::Duration::from_millis(300));
            app.exit(0);
            Ok(())
        }
        Err(e) => Err(format!("无法启动安装程序: {e}")),
    }
}

fn main() {
    tauri::Builder::default()
        // 系统通知插件：消息提醒走 Windows 通知中心真实弹窗
        .plugin(tauri_plugin_notification::init())
        // 全局快捷键：Ctrl+Alt+H 任意界面（含锁屏、托盘后台）一键呼出/隐藏窗口
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["ctrl+alt+h"])
                .expect("注册全局快捷键失败")
                .with_handler(|app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(w) = app.get_webview_window("main") {
                            let visible = w.is_visible().unwrap_or(false);
                            let minimized = w.is_minimized().unwrap_or(false);
                            if visible && !minimized {
                                // 已在前台：再按一次隐藏到后台（托盘保持运行）
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            secure_write,
            secure_read,
            secure_delete,
            exit_app,
            flash_taskbar,
            check_update,
            download_update,
            cancel_download,
            install_update
        ])
        // 拦截一切关闭请求（标题栏按钮、Alt+F4、任务栏关闭），
        // 统一交给前端按“关闭行为”设置处理：询问 / 最小化到托盘 / 直接退出
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("close-requested", ());
            }
        })
        .setup(|app| {
            // 系统托盘：左键单击唤起窗口，菜单提供“显示心愈 / 退出心愈”
            let show = MenuItem::with_id(app, "show", "显示心愈", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出心愈", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let mut tray = TrayIconBuilder::with_id("xinyu-tray")
                .tooltip("心愈 · 心理健康系统")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
