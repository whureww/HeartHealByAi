use commands::test::DbState;
use std::sync::Mutex;

pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = rusqlite::Connection::open("app.db").expect("数据库连接失败");
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            total_questions INTEGER,
            estimated_minutes INTEGER,
            scoring_method TEXT,
            result_levels TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )",
        [],
    ).expect("创建 tests 表失败");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL,
            question_number INTEGER NOT NULL,
            content TEXT NOT NULL,
            dimension TEXT,
            reverse_scoring INTEGER DEFAULT 0,
            options TEXT NOT NULL,
            FOREIGN KEY (test_id) REFERENCES tests(id)
        )",
        [],
    ).expect("创建 test_questions 表失败");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            test_id INTEGER NOT NULL,
            test_code TEXT NOT NULL,
            answers TEXT NOT NULL,
            total_score REAL,
            dimension_scores TEXT,
            result_level TEXT,
            result_desc TEXT,
            suggestions TEXT,
            completed_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (test_id) REFERENCES tests(id)
        )",
        [],
    ).expect("创建 test_results 表失败");

    tauri::Builder::default()
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            commands::test::init_test_data,
            commands::test::get_tests,
            commands::test::get_test_questions,
            commands::test::submit_test_result,
            commands::test::get_user_test_results,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
