use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use rusqlite::{Connection, Result as SqliteResult, params};

// ===== 数据结构定义 =====

#[derive(Debug, Serialize, Deserialize)]
pub struct Test {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub total_questions: i32,
    pub estimated_minutes: i32,
    pub scoring_method: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestQuestion {
    pub id: i64,
    pub question_number: i32,
    pub content: String,
    pub dimension: Option<String>,
    pub reverse_scoring: bool,
    pub options: Vec<QuestionOption>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuestionOption {
    pub score: i32,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestResult {
    pub id: i64,
    pub test_code: String,
    pub test_name: String,
    pub total_score: f64,
    pub result_level: String,
    pub result_desc: String,
    pub completed_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitAnswer {
    pub question_id: i64,
    pub option_index: usize,
    pub score: i32,
}

#[derive(Debug, Deserialize)]
pub struct SubmitTestRequest {
    pub test_id: i64,
    pub test_code: String,
    pub answers: Vec<SubmitAnswer>,
}

// ===== 数据库连接状态 =====
pub struct DbState(pub Mutex<Connection>);

// ===== 初始化测评数据 =====
#[tauri::command]
pub fn init_test_data(db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT OR IGNORE INTO tests (code, name, description, category, total_questions, estimated_minutes, scoring_method, result_levels) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            "anxiety",
            "焦虑自评量表 (SAS)",
            "评估您最近一周的焦虑水平，包含20个题目",
            "emotion",
            20,
            5,
            "sum",
            r#"[{"min":20,"max":39,"level":"正常","desc":"您的焦虑水平在正常范围内，请继续保持良好的心态。"},
                {"min":40,"max":49,"level":"轻度焦虑","desc":"您存在轻度焦虑，建议适当放松，必要时可寻求专业帮助。"},
                {"min":50,"max":59,"level":"中度焦虑","desc":"您存在中度焦虑，建议关注心理健康，必要时咨询专业人士。"},
                {"min":60,"max":80,"level":"重度焦虑","desc":"您存在较严重的焦虑，强烈建议尽快寻求专业心理帮助。"}]"#
        ],
    ).map_err(|e| e.to_string())?;

    let questions = vec![
        (1, "我觉得比平常容易紧张和着急", "精神性焦虑", false, 
         vec![(1, "没有或很少时间"), (2, "小部分时间"), (3, "相当多时间"), (4, "绝大部分或全部时间")]),
        (2, "我无缘无故地感到害怕", "精神性焦虑", false,
         vec![(1, "没有或很少时间"), (2, "小部分时间"), (3, "相当多时间"), (4, "绝大部分或全部时间")]),
        (3, "我容易心里烦乱或觉得惊恐", "精神性焦虑", false,
         vec![(1, "没有或很少时间"), (2, "小部分时间"), (3, "相当多时间"), (4, "绝大部分或全部时间")]),
        (4, "我觉得我可能将要发疯", "精神性焦虑", false,
         vec![(1, "没有或很少时间"), (2, "小部分时间"), (3, "相当多时间"), (4, "绝大部分或全部时间")]),
        (5, "我觉得一切都很好，也不会发生什么不幸", "精神性焦虑", true,
         vec![(4, "没有或很少时间"), (3, "小部分时间"), (2, "相当多时间"), (1, "绝大部分或全部时间")]),
    ];

    for (num, content, dimension, reverse, opts) in questions {
        let options_json = serde_json::to_string(
            &opts.iter().map(|(s, t)| QuestionOption { score: *s, text: t.to_string() }).collect::<Vec<_>>()
        ).unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO test_questions (test_id, question_number, content, dimension, reverse_scoring, options) 
             VALUES ((SELECT id FROM tests WHERE code='anxiety'), ?1, ?2, ?3, ?4, ?5)",
            params![num, content, dimension, reverse as i32, options_json],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ===== 获取测评列表 =====
#[tauri::command]
pub fn get_tests(db: State<DbState>) -> Result<Vec<Test>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, code, name, description, category, total_questions, estimated_minutes, scoring_method FROM tests"
    ).map_err(|e| e.to_string())?;

    let tests = stmt.query_map([], |row| {
        Ok(Test {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            category: row.get(4)?,
            total_questions: row.get(5)?,
            estimated_minutes: row.get(6)?,
            scoring_method: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?
      .collect::<SqliteResult<Vec<_>>>().map_err(|e| e.to_string())?;

    Ok(tests)
}

// ===== 获取题目 =====
#[tauri::command]
pub fn get_test_questions(db: State<DbState>, test_id: i64) -> Result<Vec<TestQuestion>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, question_number, content, dimension, reverse_scoring, options 
         FROM test_questions WHERE test_id = ?1 ORDER BY question_number"
    ).map_err(|e| e.to_string())?;

    let questions = stmt.query_map([test_id], |row| {
        let options_json: String = row.get(5)?;
        let options: Vec<QuestionOption> = serde_json::from_str(&options_json).unwrap_or_default();
        Ok(TestQuestion {
            id: row.get(0)?,
            question_number: row.get(1)?,
            content: row.get(2)?,
            dimension: row.get(3)?,
            reverse_scoring: row.get::<_, i32>(4)? != 0,
            options,
        })
    }).map_err(|e| e.to_string())?
      .collect::<SqliteResult<Vec<_>>>().map_err(|e| e.to_string())?;

    Ok(questions)
}

// ===== 提交测评结果 =====
#[tauri::command]
pub fn submit_test_result(
    db: State<DbState>,
    user_id: i64,
    req: SubmitTestRequest,
) -> Result<TestResult, String> {
    println!("收到提交请求: user_id={}, test_id={}, test_code={}", user_id, req.test_id, req.test_code);
    println!("答案数量: {}", req.answers.len());

    let conn = db.0.lock().map_err(|e| {
        println!("数据库锁定失败: {}", e);
        e.to_string()
    })?;

    let (test_name, result_levels_json): (String, String) = match conn.query_row(
        "SELECT name, result_levels FROM tests WHERE id = ?1",
        [req.test_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(result) => result,
        Err(e) => {
            println!("查询测试信息失败: {}", e);
            return Err(format!("查询测试信息失败: {}", e));
        }
    };

    let result_levels: Vec<serde_json::Value> = match serde_json::from_str(&result_levels_json) {
        Ok(levels) => levels,
        Err(e) => {
            println!("解析结果等级失败: {}", e);
            return Err(format!("解析结果等级失败: {}", e));
        }
    };

    let total_score: i32 = req.answers.iter().map(|a| a.score).sum();
    println!("计算总分: {}", total_score);
    
    let mut result_level = "未知".to_string();
    let mut result_desc = "无法评估".to_string();
    
    for level in result_levels {
        let min = level.get("min").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let max = level.get("max").and_then(|v| v.as_i64()).unwrap_or(100) as i32;
        println!("检查等级范围: {}-{}", min, max);
        if total_score >= min && total_score <= max {
            result_level = level.get("level").and_then(|v| v.as_str()).unwrap_or("未知").to_string();
            result_desc = level.get("desc").and_then(|v| v.as_str()).unwrap_or("").to_string();
            println!("匹配等级: {}", result_level);
            break;
        }
    }

    let answers_json = match serde_json::to_string(&req.answers) {
        Ok(json) => json,
        Err(e) => {
            println!("序列化答案失败: {}", e);
            return Err(format!("序列化答案失败: {}", e));
        }
    };
    
    let datetime = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();
    println!("当前时间: {}", datetime);

    println!("准备插入数据库");
    match conn.execute(
        "INSERT INTO test_results (user_id, test_id, test_code, answers, total_score, result_level, result_desc, completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![user_id, req.test_id, req.test_code, answers_json, total_score as f64, result_level, result_desc, datetime],
    ) {
        Ok(rows) => println!("插入成功, 影响行数: {}", rows),
        Err(e) => {
            println!("插入数据库失败: {}", e);
            return Err(format!("保存结果失败: {}", e));
        }
    };

    let result_id = conn.last_insert_rowid();
    println!("生成结果ID: {}", result_id);

    Ok(TestResult {
        id: result_id,
        test_code: req.test_code,
        test_name,
        total_score: total_score as f64,
        result_level,
        result_desc,
        completed_at: datetime,
    })
}

// ===== 获取用户测评历史 =====
#[tauri::command]
pub fn get_user_test_results(db: State<DbState>, user_id: i64) -> Result<Vec<TestResult>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT r.id, t.code, t.name, r.total_score, r.result_level, r.result_desc, r.completed_at
         FROM test_results r
         JOIN tests t ON r.test_id = t.id
         WHERE r.user_id = ?1
         ORDER BY r.completed_at DESC"
    ).map_err(|e| e.to_string())?;

    let results = stmt.query_map([user_id], |row| {
        Ok(TestResult {
            id: row.get(0)?,
            test_code: row.get(1)?,
            test_name: row.get(2)?,
            total_score: row.get(3)?,
            result_level: row.get(4)?,
            result_desc: row.get(5)?,
            completed_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?
      .collect::<SqliteResult<Vec<_>>>().map_err(|e| e.to_string())?;

    Ok(results)
}
