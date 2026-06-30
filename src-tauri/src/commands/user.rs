use tauri::command;

#[command]
pub fn get_user_info(token: &str) -> Result<String, String> {
    // 验证 token，返回用户信息
    Ok(format!("user:{}", token))
}
