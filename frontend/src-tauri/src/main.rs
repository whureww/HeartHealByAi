// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::Manager;

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![secure_write, secure_read, secure_delete])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
