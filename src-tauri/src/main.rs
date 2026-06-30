#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 创建托盘菜单
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;

            let menu = Menu::with_items(app, &[
                &show_item,
                &hide_item,
                &separator,
                &quit_item,
            ])?;

            // 创建系统托盘图标
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("心愈 · AI心理系统")
                .menu(&menu)
                .show_menu_on_left_click(false) 
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        // 左键单击：切换窗口显示/隐藏
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
