// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

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

/// 注册 Windows 通知中心的 AUMID（AppUserModelId）：
/// tauri-plugin-notification 以应用 identifier 作为 AUMID 发通知，
/// 但不会写注册表——缺 DisplayName/IconUri 时通知中心显示黑色默认图标。
/// 此处在 HKCU\Software\Classes\AppUserModelId\{identifier} 写入显示名与 exe 图标路径，
/// 通知即可展示心愈的应用图标（幂等，每次启动覆盖写入）。
#[cfg(target_os = "windows")]
fn register_notification_app_id(app: &tauri::AppHandle) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    let app_id = app.config().identifier.clone();
    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };
    let key = format!(r"HKCU\Software\Classes\AppUserModelId\{app_id}");

    let _ = Command::new("reg")
        .args(["add", &key, "/v", "DisplayName", "/t", "REG_SZ", "/d", "心愈", "/f"])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW，避免闪黑框
        .spawn();
    let _ = Command::new("reg")
        .args([
            "add", &key, "/v", "IconUri", "/t", "REG_SZ", "/d", &exe.to_string_lossy(), "/f",
        ])
        .creation_flags(0x0800_0000)
        .spawn();
}

#[cfg(not(target_os = "windows"))]
fn register_notification_app_id(_app: &tauri::AppHandle) {}

// ===== macOS 平台适配 =====
// Windows 专属提醒在 macOS 上的对应实现：
// - 未读数 → Dock 图标角标（NSDockTile setBadgeLabel）
// - 任务栏频闪 → Dock 图标弹跳（requestUserAttention / cancelUserAttentionRequest）
// 所有 AppKit 调用都派发到主线程执行（fire-and-forget，不阻塞命令线程）

#[cfg(target_os = "macos")]
mod macos_ui {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSApplication, NSRequestUserAttentionType};
    use objc2_foundation::NSString;
    use std::sync::atomic::{AtomicIsize, Ordering};

    /// 最近一次 requestUserAttention 返回的请求 id（用于取消弹跳）
    static ATTENTION_REQ: AtomicIsize = AtomicIsize::new(0);

    pub fn set_dock_badge(app: &tauri::AppHandle, count: Option<u32>) {
        let _ = app.run_on_main_thread(move || {
            if let Some(mtm) = MainThreadMarker::new() {
                let ns_app = NSApplication::sharedApplication(mtm);
                let dock = ns_app.dockTile();
                match count {
                    Some(n) => dock.setBadgeLabel(Some(&NSString::from_str(&n.to_string()))),
                    None => dock.setBadgeLabel(None),
                }
            }
        });
    }

    pub fn request_attention(app: &tauri::AppHandle) {
        let _ = app.run_on_main_thread(move || {
            if let Some(mtm) = MainThreadMarker::new() {
                let ns_app = NSApplication::sharedApplication(mtm);
                let req =
                    ns_app.requestUserAttention(NSRequestUserAttentionType::CriticalRequest);
                ATTENTION_REQ.store(req, Ordering::SeqCst);
            }
        });
    }

    pub fn cancel_attention(app: &tauri::AppHandle) {
        let prev = ATTENTION_REQ.swap(0, Ordering::SeqCst);
        if prev != 0 {
            let _ = app.run_on_main_thread(move || {
                if let Some(mtm) = MainThreadMarker::new() {
                    let ns_app = NSApplication::sharedApplication(mtm);
                    ns_app.cancelUserAttentionRequest(prev);
                }
            });
        }
    }
}

/// 任务栏闪烁提醒（QQ 式新消息）：窗口失焦时橙色频闪任务栏图标直至回到前台。
/// stop=true 立即停止闪烁（获得焦点/已读时由前端调用）。
/// macOS 上对应 Dock 图标弹跳（requestUserAttention）。
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
    #[cfg(target_os = "macos")]
    {
        let app = window.app_handle().clone();
        if stop {
            macos_ui::cancel_attention(&app);
        } else {
            macos_ui::request_attention(&app);
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let _ = (window, stop);
    Ok(())
}

// ===== 任务栏缩略图消息卡片（QQ 式悬浮预览） =====
// 原理：DWM「图标位图」——后台未读时对主窗口启用 FORCE_ICONIC_REPRESENTATION，
// 任务栏悬浮缩略图改由本进程提供（GDI 绘制的消息卡片：发送者/内容/未读数），
// 还原前台后关闭该模式，缩略图恢复实时窗口内容。

#[cfg(target_os = "windows")]
mod iconic_preview {
    use std::sync::Mutex;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows_sys::Win32::Graphics::Dwm::{
        DwmInvalidateIconicBitmaps, DwmSetIconicLivePreviewBitmap, DwmSetIconicThumbnail,
        DwmSetWindowAttribute,
    };
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, CreateFontW, CreateSolidBrush, DeleteDC,
        DeleteObject, DrawTextW, FillRect, GetDC, ReleaseDC, SelectObject, SetBkMode,
        SetTextColor, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, DT_END_ELLIPSIS,
        DT_WORDBREAK, HDC, HFONT, HBITMAP,
    };
    use windows_sys::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
    use windows_sys::Win32::UI::WindowsAndMessaging::GetClientRect;

    pub const WM_DWMSENDICONICTHUMBNAIL: u32 = 0x0323;
    pub const WM_DWMSENDICONICLIVEPREVIEWBITMAP: u32 = 0x0326;
    const DWMWA_HAS_ICONIC_BITMAP: u32 = 10;
    const DWMWA_FORCE_ICONIC_REPRESENTATION: u32 = 11;
    const SUBCLASS_ID: usize = 0x5849_4E59; // "XINY"

    #[derive(Clone)]
    struct PreviewData {
        sender: String,
        content: String,
        unread: u32,
    }

    pub static PREVIEW: Mutex<Option<PreviewData>> = Mutex::new(None);
    static SUBCLASS_INSTALLED: std::sync::atomic::AtomicBool =
        std::sync::atomic::AtomicBool::new(false);

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    // COLORREF = 0x00BBGGRR
    fn rgb(r: u32, g: u32, b: u32) -> u32 {
        (b << 16) | (g << 8) | r
    }

    unsafe fn make_font(size: i32, bold: bool) -> HFONT {
        CreateFontW(
            -size, 0, 0, 0,
            if bold { 700 } else { 400 },
            0, 0, 0,
            1, // DEFAULT_CHARSET
            0, 0, 5, // OUT_DEFAULT / CLIP_DEFAULT / CLEARTYPE_QUALITY
            0,
            wide("Microsoft YaHei UI").as_ptr(),
        )
    }

    /// 绘制消息卡片位图（深色底 + 发送者 + 摘要 + 未读数）
    unsafe fn render_card(w: i32, h: i32) -> Option<HBITMAP> {
        if w <= 0 || h <= 0 {
            return None;
        }
        let data = PREVIEW.lock().ok()?.clone();
        let (sender, content, unread) = match data {
            Some(d) => (d.sender, d.content, d.unread),
            None => ("心愈".to_string(), String::new(), 0),
        };

        let screen: HDC = GetDC(0);
        if screen == 0 {
            return None;
        }
        let mut bi: BITMAPINFO = unsafe { std::mem::zeroed() };
        bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bi.bmiHeader.biWidth = w;
        bi.bmiHeader.biHeight = -h; // top-down
        bi.bmiHeader.biPlanes = 1;
        bi.bmiHeader.biBitCount = 32;
        bi.bmiHeader.biCompression = 0; // BI_RGB
        let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
        let bmp = CreateDIBSection(screen, &bi, DIB_RGB_COLORS, &mut bits, 0, 0);
        if bmp == 0 {
            ReleaseDC(0, screen);
            return None;
        }
        let mem = CreateCompatibleDC(screen);
        let old = SelectObject(mem, bmp as _);

        // 背景
        let full = RECT { left: 0, top: 0, right: w, bottom: h };
        let bg = CreateSolidBrush(rgb(24, 30, 42));
        FillRect(mem, &full, bg);
        DeleteObject(bg as _);

        // 顶部强调条
        let bar = RECT { left: 0, top: 0, right: w, bottom: 4 };
        let accent = CreateSolidBrush(rgb(122, 156, 245));
        FillRect(mem, &bar, accent);
        DeleteObject(accent as _);

        SetBkMode(mem, 1); // TRANSPARENT

        // 发送者行
        let f1 = make_font(if h > 90 { 20 } else { 17 }, true);
        let old_font = SelectObject(mem, f1 as _);
        SetTextColor(mem, rgb(140, 172, 246));
        let title = if unread > 1 {
            wide(format!("【新消息 ×{unread}】{}", sender).as_str())
        } else {
            wide(format!("【新消息】{}", sender).as_str())
        };
        let mut rc1 = RECT { left: 14, top: 12, right: w - 14, bottom: 44 };
        // DT_SINGLELINE | DT_NOPREFIX | DT_END_ELLIPSIS：单行截断
        DrawTextW(mem, title.as_ptr() as *mut u16, -1, &mut rc1, 0x0020 | 0x0800 | DT_END_ELLIPSIS);

        // 内容行
        let f2 = make_font(if h > 90 { 18 } else { 15 }, false);
        SelectObject(mem, f2 as _);
        SetTextColor(mem, rgb(214, 222, 236));
        let mut rc2 = RECT { left: 14, top: 46, right: w - 14, bottom: h - 12 };
        if h <= 90 {
            rc2.top = 38;
        }
        if !content.is_empty() {
            let body = wide(content.as_str());
            // DT_WORDBREAK | DT_NOPREFIX：多行折行
            DrawTextW(mem, body.as_ptr() as *mut u16, -1, &mut rc2, DT_WORDBREAK | 0x0800);
        }

        SelectObject(mem, old_font as _);
        SelectObject(mem, old);
        DeleteObject(f1 as _);
        DeleteObject(f2 as _);
        DeleteDC(mem);
        ReleaseDC(0, screen);
        Some(bmp)
    }

    unsafe fn set_iconic(hwnd: HWND, on: bool) {
        let v: i32 = if on { 1 } else { 0 };
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_HAS_ICONIC_BITMAP,
            &v as *const i32 as *const core::ffi::c_void,
            4,
        );
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_FORCE_ICONIC_REPRESENTATION,
            &v as *const i32 as *const core::ffi::c_void,
            4,
        );
    }

    unsafe extern "system" fn preview_proc(
        hwnd: HWND,
        msg: u32,
        wp: WPARAM,
        lp: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        if msg == WM_DWMSENDICONICTHUMBNAIL {
            // lParam：HIWORD = 最大宽，LOWORD = 最大高
            let max_w = ((lp as usize >> 16) & 0xFFFF) as i32;
            let max_h = ((lp as usize) & 0xFFFF) as i32;
            let w = max_w.min(480);
            let h = max_h.min(300);
            if let Some(bmp) = render_card(w, h) {
                DwmSetIconicThumbnail(hwnd, bmp, 0);
                DeleteObject(bmp as _);
            }
            return 0;
        }
        if msg == WM_DWMSENDICONICLIVEPREVIEWBITMAP {
            let mut rc = RECT { left: 0, top: 0, right: 0, bottom: 0 };
            GetClientRect(hwnd, &mut rc);
            let w = (rc.right - rc.left).clamp(120, 640);
            let h = (rc.bottom - rc.top).clamp(80, 480);
            if let Some(bmp) = render_card(w, h) {
                DwmSetIconicLivePreviewBitmap(hwnd, bmp, std::ptr::null(), 0);
                DeleteObject(bmp as _);
            }
            return 0;
        }
        DefSubclassProc(hwnd, msg, wp, lp)
    }

    /// 未读状态：启用图标位图模式并刷新缩略图
    pub fn activate(hwnd: isize, sender: String, content: String, unread: u32) {
        unsafe {
            *PREVIEW.lock().unwrap() = Some(PreviewData { sender, content, unread });
            if !SUBCLASS_INSTALLED.swap(true, std::sync::atomic::Ordering::SeqCst) {
                SetWindowSubclass(hwnd, Some(preview_proc), SUBCLASS_ID, 0);
            }
            set_iconic(hwnd, true);
            DwmInvalidateIconicBitmaps(hwnd);
        }
    }

    /// 已读还原：关闭图标位图模式，缩略图恢复窗口实时内容
    pub fn deactivate(hwnd: isize) {
        unsafe {
            *PREVIEW.lock().unwrap() = None;
            set_iconic(hwnd, false);
            DwmInvalidateIconicBitmaps(hwnd);
        }
    }
}

/// 设置任务栏缩略图消息卡片（后台未读时悬浮任务栏显示发送者/内容/未读数）
#[tauri::command]
fn set_taskbar_preview(
    window: tauri::WebviewWindow,
    sender: String,
    content: String,
    unread: u32,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
        iconic_preview::activate(hwnd, sender, content, unread);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (window, sender, content, unread);
    Ok(())
}

/// 清除缩略图消息卡片（回前台/已读时调用）
#[tauri::command]
fn clear_taskbar_preview(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
        iconic_preview::deactivate(hwnd);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = window;
    Ok(())
}

// ===== 托盘 QQ 化：未读角标 + 整图标不透明/透明交替频闪 + 动态 tooltip + 悬浮消息卡片 =====
// 后台收到消息时托盘图标叠加红色数字角标，并与「透明帧」交替（QQ 式闪烁，
// 托盘槽位保留不移除）；鼠标悬浮托盘图标弹出消息卡片小窗，点击直达聊天。

const TRAY_ID: &str = "xinyu-tray";
const TRAY_TOOLTIP_DEFAULT: &str = "心愈 · 心理健康系统";

static TRAY_FLASH: AtomicBool = AtomicBool::new(false);
/// 当前角标档位：1..=8 显示数字，9 表示 9+
static TRAY_BADGE: AtomicUsize = AtomicUsize::new(1);

/// 托盘悬浮卡片展示的未读消息（最新一条 + 未读总数 + 所属预约 id + 发送者头像）
#[derive(Clone, serde::Serialize)]
struct TrayMsg {
    sender: String,
    content: String,
    unread: u32,
    appointment_id: Option<u64>,
    avatar: Option<String>,
}
static TRAY_MSG: std::sync::Mutex<Option<TrayMsg>> = std::sync::Mutex::new(None);
/// 鼠标是否悬浮在托盘卡片上（悬浮期间不隐藏）
static POPUP_HOVER: AtomicBool = AtomicBool::new(false);
/// 卡片隐藏任务代际：每次重新触发隐藏时递增，旧任务发现代际不符自行作废
static POPUP_HIDE_GEN: AtomicUsize = AtomicUsize::new(0);

/// 内置托盘图标资源：cache[0..7]=badge_1..8，cache[8]=badge_9p
fn tray_icon_cache() -> &'static [Option<tauri::image::Image<'static>>; 9] {
    static CACHE: std::sync::OnceLock<[Option<tauri::image::Image<'static>>; 9]> =
        std::sync::OnceLock::new();
    CACHE.get_or_init(|| {
        const ENTRIES: [(&[u8], usize); 9] = [
            (include_bytes!("../icons/tray/badge_1.png"), 0),
            (include_bytes!("../icons/tray/badge_2.png"), 1),
            (include_bytes!("../icons/tray/badge_3.png"), 2),
            (include_bytes!("../icons/tray/badge_4.png"), 3),
            (include_bytes!("../icons/tray/badge_5.png"), 4),
            (include_bytes!("../icons/tray/badge_6.png"), 5),
            (include_bytes!("../icons/tray/badge_7.png"), 6),
            (include_bytes!("../icons/tray/badge_8.png"), 7),
            (include_bytes!("../icons/tray/badge_9p.png"), 8),
        ];
        let mut arr: [Option<tauri::image::Image<'static>>; 9] = std::array::from_fn(|_| None);
        for (bytes, slot) in ENTRIES {
            arr[slot] = tauri::image::Image::from_bytes(bytes).ok();
        }
        arr
    })
}

fn badge_image(n: usize) -> Option<tauri::image::Image<'static>> {
    let idx = if n >= 9 { 8 } else { n.checked_sub(1)? };
    let img = tray_icon_cache()[idx].clone()?;
    #[cfg(target_os = "macos")]
    return resize_for_menu_bar(&img);
    #[cfg(not(target_os = "macos"))]
    Some(img)
}

/// macOS 菜单栏状态图标按约 22pt 显示：内置角标图为 32×32，直接使用会撑高菜单栏，
/// 这里统一缩放到 22×22（Retina 下由系统放大，视觉可接受）
#[cfg(target_os = "macos")]
fn resize_for_menu_bar(img: &tauri::image::Image<'_>) -> Option<tauri::image::Image<'static>> {
    use image::{imageops, ImageBuffer, Rgba};
    const MENU_BAR_SIZE: u32 = 22;
    let w = img.width() as u32;
    let h = img.height() as u32;
    let rgba = img.rgba();
    if w == 0 || h == 0 || rgba.is_empty() {
        return None;
    }
    let src = ImageBuffer::<Rgba<u8>, &[u8]>::from_raw(w, h, rgba)?;
    let resized = imageops::resize(&src, MENU_BAR_SIZE, MENU_BAR_SIZE, imageops::FilterType::Lanczos3);
    Some(tauri::image::Image::new_owned(
        resized.into_raw(),
        MENU_BAR_SIZE.into(),
        MENU_BAR_SIZE.into(),
    ))
}

/// 托盘常态图标：Windows 直接用应用图标；macOS 需缩放到菜单栏尺寸
fn default_tray_icon(app: &tauri::AppHandle) -> Option<tauri::image::Image<'static>> {
    // default_window_icon() 返回借用自 app 的引用，to_owned() 不会抹掉生命周期；
    // 必须把像素数据复制进 Vec，用 new_owned 构造真正拥有数据的 'static 图像
    let icon = app.default_window_icon()?;
    #[cfg(target_os = "macos")]
    return resize_for_menu_bar(icon);
    #[cfg(not(target_os = "macos"))]
    Some(tauri::image::Image::new_owned(
        icon.rgba().to_vec(),
        icon.width() as u32,
        icon.height() as u32,
    ))
}

/// 系统任务栏是否为浅色主题（读 SystemUsesLightTheme，失败默认浅色）
#[cfg(target_os = "windows")]
fn taskbar_is_light() -> bool {
    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
    unsafe {
        let subkey: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\0"
            .encode_utf16()
            .collect();
        let value: Vec<u16> = "SystemUsesLightTheme\0".encode_utf16().collect();
        let mut data: u32 = 1;
        let mut size: u32 = 4;
        let ok = RegGetValueW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            value.as_ptr(),
            RRF_RT_REG_DWORD,
            std::ptr::null_mut(),
            &mut data as *mut u32 as *mut core::ffi::c_void,
            &mut size,
        ) == 0;
        if ok { data == 1 } else { true }
    }
}

#[cfg(target_os = "windows")]
static TASKBAR_LIGHT: std::sync::OnceLock<bool> = std::sync::OnceLock::new();

/// 频闪「灭」帧：近乎全透明图标（alpha=1/255），像素底色取任务栏背景色。
/// tray-icon 0.24 建 HICON 的 AND 掩码有缺陷（alpha=0 回绕成 1 且掩码行宽未对齐），
/// 纯透明图会被 GDI 掩码路径渲染成黑色色块；改为「低 alpha + 任务栏同色底」双保险：
/// 若走 alpha 路径则 99.6% 透明不可见，若走掩码路径则渲染为任务栏同色同样不可见——
/// 两种管线下都表现为「图标消失但托盘槽位保留」，即 QQ 式不透明/透明交替闪烁
#[cfg(target_os = "windows")]
fn blank_image() -> tauri::image::Image<'static> {
    let light = TASKBAR_LIGHT.get_or_init(taskbar_is_light);
    let (r, g, b) = if *light {
        (0xF3u8, 0xF3u8, 0xF3u8) // Win11 浅色任务栏
    } else {
        (0x20u8, 0x20u8, 0x20u8) // Win11 深色任务栏
    };
    let mut rgba = vec![0u8; 32 * 32 * 4];
    for px in rgba.chunks_exact_mut(4) {
        px[0] = r;
        px[1] = g;
        px[2] = b;
        px[3] = 1; // 近乎全透明
    }
    tauri::image::Image::new_owned(rgba, 32, 32)
}

/// 频闪线程：未读时 600ms 交替「角标帧 ↔ 透明帧」（QQ 式不透明/透明交替，
/// 托盘槽位保留不移除）；停止后恢复常态图标（仅恢复一次）。
/// 仅 Windows：macOS 菜单栏图标不做透明频闪（非惯例），改用 Dock 角标。
#[cfg(target_os = "windows")]
fn spawn_tray_flasher(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut blank_shown = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(600));
            let Some(tray) = app.tray_by_id(TRAY_ID) else { continue };
            if !TRAY_FLASH.load(Ordering::SeqCst) {
                if blank_shown {
                    blank_shown = false;
                    if let Some(icon) = app.default_window_icon().cloned() {
                        let _ = tray.set_icon(Some(icon));
                    }
                }
                continue;
            }
            let next = if blank_shown {
                badge_image(TRAY_BADGE.load(Ordering::SeqCst))
            } else {
                Some(blank_image())
            };
            if let Some(img) = next {
                let _ = tray.set_icon(Some(img));
            }
            blank_shown = !blank_shown;
        }
    });
}

/// 托盘未读提醒：叠加数字角标、开始频闪、tooltip 变为消息预览，
/// 同时记录卡片数据（弹窗已显示时同步刷新内容）。
/// tip：由前端按当前语言拼好的 tooltip；缺省时回退到内置中文格式。
/// macOS：不频闪，菜单栏图标切到角标帧，同时写 Dock 角标数字。
#[tauri::command]
fn update_tray_unread(
    app: tauri::AppHandle,
    sender: String,
    content: String,
    unread: u32,
    appointment_id: Option<u64>,
    avatar: Option<String>,
    tip: Option<String>,
) -> Result<(), String> {
    let idx = if unread >= 9 { 9 } else { (unread as usize).clamp(1, 8) };
    TRAY_BADGE.store(idx, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    TRAY_FLASH.store(true, Ordering::SeqCst);

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let brief: String = content.chars().take(24).collect();
        let tip = tip.unwrap_or_else(|| {
            if unread > 1 {
                format!("心愈 · 【{unread}条未读】{sender}：{brief}")
            } else {
                format!("心愈 · {sender}：{brief}")
            }
        });
        let _ = tray.set_tooltip(Some(&tip));
        if let Some(img) = badge_image(idx) {
            let _ = tray.set_icon(Some(img));
        }
    }

    #[cfg(target_os = "macos")]
    macos_ui::set_dock_badge(&app, Some(unread));

    let msg = TrayMsg {
        sender: sender.clone(),
        content: content.clone(),
        unread,
        appointment_id,
        avatar,
    };
    if let Ok(mut slot) = TRAY_MSG.lock() {
        *slot = Some(msg.clone());
    }
    if let Some(popup) = app.get_webview_window("tray-popup") {
        if popup.is_visible().unwrap_or(false) {
            let _ = app.emit_to("tray-popup", "tray-msg", msg);
        }
    }
    Ok(())
}

/// 托盘恢复常态：停止频闪、还原图标与 tooltip、清空卡片数据并隐藏悬浮卡片。
/// macOS 同时清除 Dock 角标。
#[tauri::command]
fn clear_tray_unread(app: tauri::AppHandle) {
    TRAY_FLASH.store(false, Ordering::SeqCst);
    if let Ok(mut slot) = TRAY_MSG.lock() {
        *slot = None;
    }
    if let Some(popup) = app.get_webview_window("tray-popup") {
        let _ = popup.hide();
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(TRAY_TOOLTIP_DEFAULT));
        if let Some(icon) = default_tray_icon(&app) {
            let _ = tray.set_icon(Some(icon));
        }
    }
    #[cfg(target_os = "macos")]
    macos_ui::set_dock_badge(&app, None);
}

/// 更新托盘菜单与默认 tooltip 文案（前端切换语言时调用，实现托盘界面跟随语言）
#[tauri::command]
fn set_tray_texts(app: tauri::AppHandle, show: String, quit: String, tooltip: String) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(&tooltip));
        let show_item = MenuItem::with_id(&app, "show", &show, true, None::<&str>);
        let quit_item = MenuItem::with_id(&app, "quit", &quit, true, None::<&str>);
        if let (Ok(s), Ok(q)) = (show_item, quit_item) {
            if let Ok(menu) = Menu::with_items(&app, &[&s, &q]) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    }
}

/// 按托盘图标位置定位并显示悬浮卡片（默认在图标上方，放不下则改到下方）
fn show_tray_popup(app: &tauri::AppHandle, rect: &tauri::Rect) {
    let Some(popup) = app.get_webview_window("tray-popup") else { return };
    let scale = popup.scale_factor().unwrap_or(1.0);
    let pos: tauri::PhysicalPosition<f64> = rect.position.to_physical(scale);
    let icon_size: tauri::PhysicalSize<f64> = rect.size.to_physical(scale);
    let wsize = popup.outer_size().unwrap_or(tauri::PhysicalSize::new(360, 172));
    let mut x = pos.x as i32 + icon_size.width as i32 / 2 - wsize.width as i32 / 2;
    let mut y = pos.y as i32 - wsize.height as i32 - 8;
    if y < 0 {
        // 任务栏位于屏幕顶部：卡片改为托盘图标下方
        y = pos.y as i32 + icon_size.height as i32 + 8;
    }
    if let Ok(Some(mon)) = app.primary_monitor() {
        let mw = mon.size().width as i32;
        if x + wsize.width as i32 > mw {
            x = mw - wsize.width as i32;
        }
    }
    if x < 0 {
        x = 0;
    }
    let _ = popup.set_position(tauri::PhysicalPosition::new(x, y));
    let _ = popup.show();
}

/// 延迟隐藏悬浮卡片：鼠标可能正从托盘图标移向卡片，给 250ms 过渡期
fn schedule_tray_popup_hide(app: tauri::AppHandle) {
    let gen = POPUP_HIDE_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(250));
        if POPUP_HIDE_GEN.load(Ordering::SeqCst) != gen {
            return; // 已被新的 Enter/hover 事件接管
        }
        if POPUP_HOVER.load(Ordering::SeqCst) {
            return; // 鼠标已进入卡片，保持显示
        }
        if let Some(w) = app.get_webview_window("tray-popup") {
            let _ = w.hide();
        }
    });
}

/// 卡片鼠标悬浮状态上报（前端 mouseenter/mouseleave 调用）
#[tauri::command]
fn tray_popup_hover(app: tauri::AppHandle, hover: bool) {
    POPUP_HOVER.store(hover, Ordering::SeqCst);
    if hover {
        // 进入卡片：作废所有挂起的隐藏任务
        POPUP_HIDE_GEN.fetch_add(1, Ordering::SeqCst);
    } else {
        schedule_tray_popup_hide(app);
    }
}

/// 点击卡片：隐藏卡片、唤起主窗口并跳转到对应聊天（QQ 式点击直达）
#[tauri::command]
fn tray_popup_open_chat(app: tauri::AppHandle) {
    let appt = TRAY_MSG
        .lock()
        .ok()
        .and_then(|slot| slot.as_ref().and_then(|m| m.appointment_id));
    if let Some(w) = app.get_webview_window("tray-popup") {
        let _ = w.hide();
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        let _ = app.emit_to("main", "tray-popup-click", appt);
    }
    clear_tray_unread(app);
}

// ===== 检查更新（Gitee + GitHub 双源容灾） =====
// 任一源不可达时自动使用另一源；两源均可达时取版本号最高的 release，
// 其版本高于当前程序版本即标记为新版本可下载更新。

const GITEE_RELEASES_LATEST: &str =
    "https://gitee.com/api/v5/repos/yxpil/aisprithill/releases/latest";
const GITHUB_RELEASES_LATEST: &str =
    "https://api.github.com/repos/whureww/HeartHealByAi/releases/latest";

/// 各平台安装包附件后缀：Windows 为 Inno Setup 安装器；macOS 为 Tauri 产出的
/// DMG（Apple Silicon 优先，其次 Intel）。下载与安装校验均按当前平台后缀执行。
#[cfg(target_os = "windows")]
const INSTALLER_SUFFIXES: [&str; 1] = ["_x64-setup.exe"];
#[cfg(target_os = "macos")]
const INSTALLER_SUFFIXES: [&str; 2] = ["_aarch64.dmg", "_x64.dmg"];

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

/// 从 release 的 assets 里找当前平台安装包附件的下载地址（按后缀优先级匹配）
fn find_installer_asset(rel: &serde_json::Value) -> Option<String> {
    let assets = rel.get("assets")?.as_array()?;
    for a in assets {
        let name = a.get("name")?.as_str().unwrap_or("");
        for suffix in INSTALLER_SUFFIXES {
            if name.ends_with(suffix) {
                if let Some(url) = a.get("browser_download_url").and_then(|v| v.as_str()) {
                    return Some(url.to_string());
                }
            }
        }
    }
    None
}

/// 拉取单个更新源的 latest release；网络失败/响应异常/无 tag 均返回 None（由另一源兜底）
fn fetch_release(client: &reqwest::blocking::Client, url: &str, label: &str) -> Option<serde_json::Value> {
    let resp = match client
        .get(url)
        // GitHub API 强制要求 User-Agent，缺失会 403
        .header(reqwest::header::USER_AGENT, "xinyu-updater")
        .send()
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[检查更新] {label} 不可达: {e}");
            return None;
        }
    };
    if !resp.status().is_success() {
        eprintln!("[检查更新] {label} 响应异常: {}", resp.status());
        return None;
    }
    let json: serde_json::Value = match resp.json() {
        Ok(j) => j,
        Err(e) => {
            eprintln!("[检查更新] {label} 解析失败: {e}");
            return None;
        }
    };
    if json.get("tag_name").is_none() {
        eprintln!("[检查更新] {label} 尚未发布任何 Release");
        return None;
    }
    Some(json)
}

/// 从 tag 提取版本号：形如 v0.2.1_UpDate → 0.2.1
fn tag_version(rel: &serde_json::Value) -> String {
    let tag = rel.get("tag_name").and_then(|v| v.as_str()).unwrap_or("");
    tag.split(['_', '-'])
        .find(|seg| seg.starts_with('v') && seg.contains('.'))
        .unwrap_or(tag)
        .trim_start_matches('v')
        .to_string()
}

/// 检查更新：Gitee 与 GitHub 双源并发查询，取可达源中版本号最高的 release
#[tauri::command]
fn check_update(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("网络客户端初始化失败: {e}"))?;

    // 两源并发查询（总耗时≈单源超时上限，而非两源串行累加）
    let (gitee, github) = std::thread::scope(|s| {
        let g = s.spawn(|| fetch_release(&client, GITEE_RELEASES_LATEST, "Gitee"));
        let h = s.spawn(|| fetch_release(&client, GITHUB_RELEASES_LATEST, "GitHub"));
        (g.join().ok().flatten(), h.join().ok().flatten())
    });

    let mut candidates: Vec<(serde_json::Value, String)> = [gitee, github]
        .into_iter()
        .flatten()
        .map(|rel| {
            let ver = tag_version(&rel);
            (rel, ver)
        })
        .filter(|(_, ver)| !ver.is_empty())
        .collect();

    if candidates.is_empty() {
        return Err("无法连接任何更新源（Gitee 与 GitHub 均不可达）".into());
    }

    // 按版本号降序：高版本源在前
    candidates.sort_by(|(_, va), (_, vb)| match version_is_newer(va, vb) {
        Some(true) => std::cmp::Ordering::Less, // va 更新 → 排前
        Some(false) => std::cmp::Ordering::Greater,
        None => std::cmp::Ordering::Equal,
    });

    // 优先取有安装包附件的最高版本源；都没有附件时回退最高版本源（前端会提示地址缺失）
    let (best_rel, latest_ver) = candidates
        .iter()
        .find(|(rel, _)| find_installer_asset(rel).is_some())
        .unwrap_or(&candidates[0])
        .clone();

    let has_update = version_is_newer(&latest_ver, &current).unwrap_or(false);

    Ok(UpdateInfo {
        has_update,
        latest_version: latest_ver,
        current_version: current,
        download_url: find_installer_asset(&best_rel).unwrap_or_default(),
        release_notes: best_rel
            .get("body")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    })
}

/// 下载新版本安装包到临时目录（流式，向前端广播进度事件 update-progress），
/// 返回本地文件路径。可被 cancel_download 命令随时中断。
/// 阻塞工作跑在 blocking 线程池：同步命令会占死主线程，导致 cancel_download
/// 排队到下载结束才执行——表现为「点取消卡一下但继续下载、完成后直接可安装」。
#[tauri::command]
async fn download_update(app: tauri::AppHandle, download_url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || download_update_blocking(app, download_url))
        .await
        .map_err(|e| format!("下载任务异常: {e}"))?
}

fn download_update_blocking(app: tauri::AppHandle, download_url: String) -> Result<String, String> {
    if !INSTALLER_SUFFIXES.iter().any(|s| download_url.ends_with(s)) {
        return Err("下载地址异常，已阻止".into());
    }

    // 清掉上次残留的取消标志（取消路径自身也会复位，这里兜底）
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

/// 退出程序并启动新版本安装器。
/// Windows：直接执行 Inno Setup 安装器；macOS：用 open 挂载 DMG 引导安装。
#[tauri::command]
fn install_update(app: tauri::AppHandle, installer_path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&installer_path);
    if !path.exists() || !INSTALLER_SUFFIXES.iter().any(|s| path.to_string_lossy().ends_with(s)) {
        return Err("安装包无效".into());
    }

    // Windows：exe 可直接执行；macOS：open 挂载 dmg（Finder 接管拖拽安装）。
    // 子进程独立于父进程，本程序退出不影响其运行
    #[cfg(target_os = "macos")]
    let spawn = std::process::Command::new("open").arg(&path).spawn();
    #[cfg(not(target_os = "macos"))]
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
            set_taskbar_preview,
            clear_taskbar_preview,
            update_tray_unread,
            clear_tray_unread,
            set_tray_texts,
            tray_popup_hover,
            tray_popup_open_chat,
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
            // 托盘悬浮消息卡片窗口（QQ 式）：无边框透明置顶小窗，默认隐藏、
            // 不进任务栏、不可聚焦（不抢主窗口焦点），仅在有未读时随托盘悬浮弹出
            let popup_window = tauri::WebviewWindowBuilder::new(
                app,
                "tray-popup",
                tauri::WebviewUrl::App("/tray-popup".into()),
            )
            .title("xinyu-tray-popup")
            .visible(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focusable(false)
            .resizable(false)
            .inner_size(360.0, 172.0)
            .build();

            // 去掉 Windows 11 给窗口加的圆角、非客户区边框光晕与 1px 系统边框
            // （透明窗口上会呈现为一圈半透明毛玻璃描边/淡边，用户反馈碍眼）；
            // 仅保留卡片本体自绘的圆角与阴影。仅 Windows：DWM 属性不适用 macOS。
            #[cfg(target_os = "windows")]
            if let Ok(popup) = popup_window {
                if let Ok(hwnd) = popup.hwnd() {
                    let hwnd = hwnd.0 as isize;
                    unsafe {
                        let ncrp: i32 = 2; // DWMNCRP_DISABLED：禁用非客户区边框渲染
                        windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute(
                            hwnd,
                            2, // DWMWA_NCRENDERING_POLICY
                            &ncrp as *const i32 as *const core::ffi::c_void,
                            4,
                        );
                        let pref: i32 = 1; // DWMWCP_DONOTROUND：禁用系统圆角
                        windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute(
                            hwnd,
                            33, // DWMWA_WINDOW_CORNER_PREFERENCE
                            &pref as *const i32 as *const core::ffi::c_void,
                            4,
                        );
                        // DWMWA_COLOR_NONE(0xFFFFFFFE)：彻底移除 DWM 窗口边框描线
                        let border: i32 = -2;
                        windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute(
                            hwnd,
                            34, // DWMWA_BORDER_COLOR
                            &border as *const i32 as *const core::ffi::c_void,
                            4,
                        );
                    }
                }
            }
            #[cfg(not(target_os = "windows"))]
            let _ = popup_window;

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
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        // 左键点击托盘时收起悬浮卡片
                        if let Some(p) = app.get_webview_window("tray-popup") {
                            let _ = p.hide();
                        }
                        if let Some(w) = app.get_webview_window("main") {
                            // QQ 式开关：已在前台点击托盘=隐藏到托盘，否则唤起
                            let visible = w.is_visible().unwrap_or(false);
                            let minimized = w.is_minimized().unwrap_or(false);
                            if visible && !minimized {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                    }
                    // 悬浮托盘图标：有未读消息时弹出消息卡片（QQ 式悬浮预览）
                    TrayIconEvent::Enter { rect, .. } => {
                        let app = tray.app_handle();
                        let has_msg = TRAY_MSG.lock().map(|slot| slot.is_some()).unwrap_or(false);
                        if !has_msg {
                            return;
                        }
                        POPUP_HOVER.store(false, Ordering::SeqCst);
                        POPUP_HIDE_GEN.fetch_add(1, Ordering::SeqCst);
                        show_tray_popup(app, &rect);
                        if let Some(msg) = TRAY_MSG.lock().ok().and_then(|slot| slot.clone()) {
                            let _ = app.emit_to("tray-popup", "tray-msg", msg);
                        }
                    }
                    // 离开托盘图标：延迟隐藏（若鼠标移入卡片则由 hover 状态保活）
                    TrayIconEvent::Leave { .. } => {
                        schedule_tray_popup_hide(tray.app_handle().clone());
                    }
                    _ => {}
                });

            if let Some(icon) = default_tray_icon(app.handle()) {
                tray = tray.icon(icon);
            }
            tray.build(app)?;

            // 托盘角标频闪线程（常驻，未读时交替闪烁；仅 Windows，macOS 走 Dock 角标）
            #[cfg(target_os = "windows")]
            spawn_tray_flasher(app.handle().clone());

            register_notification_app_id(app.handle());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
