-- ============================================================
-- 心愈 · 心理健康服务平台 数据库初始化脚本
-- 在云服务器 MySQL 上执行：mysql -u root -p < schema.sql
-- ============================================================
CREATE DATABASE IF NOT EXISTS xinyu DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xinyu;

-- ========== 用户表 ==========
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role TINYINT NOT NULL DEFAULT 1 COMMENT '1=普通用户 2=专家 3=管理员',
    avatar LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_email (email),
    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 专家表 ==========
CREATE TABLE IF NOT EXISTS doctors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    title VARCHAR(50) DEFAULT '',
    specialty VARCHAR(200) DEFAULT '',
    intro TEXT COMMENT '专家名片简介',
    user_id INT UNSIGNED DEFAULT NULL COMMENT '关联 users.id（role=2）',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '0 下架/1 上架/2 待审核',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 预约记录表 ==========
CREATE TABLE IF NOT EXISTS appointment_records (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    doctor_id INT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/confirmed/completed/cancelled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_appointment_user (user_id),
    KEY idx_appointment_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 心理测评量表表 ==========
CREATE TABLE IF NOT EXISTS psychological_tests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT '',
    total_questions INT NOT NULL DEFAULT 0,
    estimated_minutes INT NOT NULL DEFAULT 5,
    scoring_method VARCHAR(30) DEFAULT 'sum',
    result_levels TEXT COMMENT 'JSON: [{min,max,level,desc}]',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0=待审核 1=已上架 2=已下架',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 测评题目表 ==========
CREATE TABLE IF NOT EXISTS test_questions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    test_id INT UNSIGNED NOT NULL,
    question_number INT NOT NULL,
    content TEXT NOT NULL,
    dimension VARCHAR(50) DEFAULT NULL,
    reverse_scoring TINYINT NOT NULL DEFAULT 0,
    options TEXT COMMENT 'JSON: [{score,text}]',
    KEY idx_question_test (test_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 测评结果表 ==========
CREATE TABLE IF NOT EXISTS test_results (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    test_id INT UNSIGNED NOT NULL,
    test_code VARCHAR(30) DEFAULT '',
    answers TEXT COMMENT 'JSON',
    total_score INT NOT NULL DEFAULT 0,
    result_level VARCHAR(30) DEFAULT '',
    result_desc TEXT,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_result_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== AI 聊天记录表 ==========
CREATE TABLE IF NOT EXISTS chat_records (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'user' COMMENT 'user/ai',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_chat_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== AI 分析报告表 ==========
CREATE TABLE IF NOT EXISTS analysis_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    content LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_report_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 专家咨询聊天表 ==========
CREATE TABLE IF NOT EXISTS expert_chat (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_id INT UNSIGNED NOT NULL,
    receiver_id INT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    appointment_id INT UNSIGNED NOT NULL,
    is_read TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_chat_appointment (appointment_id),
    KEY idx_chat_receiver (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 第三方 OAuth 绑定表 ==========
CREATE TABLE IF NOT EXISTS user_oauth (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    provider VARCHAR(20) NOT NULL COMMENT 'wechat/qq',
    openid VARCHAR(100) NOT NULL,
    unionid VARCHAR(100) DEFAULT NULL,
    access_token VARCHAR(255) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_oauth (provider, openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 示例数据
-- ============================================================

-- 示例专家（如需专家登录：先注册账号，再执行
--   UPDATE users SET role=2 WHERE email='专家邮箱';
--   UPDATE doctors SET user_id=(SELECT id FROM users WHERE email='专家邮箱') WHERE id=1;
-- ）
INSERT INTO doctors (name, title, specialty, status)
SELECT '示例咨询师', '国家二级心理咨询师', '情绪困扰、压力管理、人际关系', 1
WHERE NOT EXISTS (SELECT 1 FROM doctors WHERE name = '示例咨询师');

-- 管理员提升方式（先在 App 里注册账号，再执行）：
--   UPDATE users SET role=3 WHERE email='你的邮箱';

-- 示例测评：心理健康自评（PHQ-9 简化示例）
INSERT INTO psychological_tests (code, name, description, category, total_questions, estimated_minutes, scoring_method, result_levels, status)
SELECT 'PHQ9-DEMO', '情绪自评量表（示例）', '用于初步了解自己近两周的情绪状态，结果不作为诊断依据。',
       '情绪', 9, 5, 'sum',
       '[{"min":0,"max":4,"level":"正常","desc":"您的情绪状态良好，请继续保持。"},{"min":5,"max":9,"level":"轻度","desc":"您可能存在轻度情绪困扰，建议关注自身状态。"},{"min":10,"max":14,"level":"中度","desc":"您的情绪困扰较明显，建议寻求专业帮助。"},{"min":15,"max":27,"level":"重度","desc":"您的情绪困扰较严重，强烈建议尽快寻求专业帮助。"}]',
       1
WHERE NOT EXISTS (SELECT 1 FROM psychological_tests WHERE code = 'PHQ9-DEMO');

INSERT INTO test_questions (test_id, question_number, content, reverse_scoring, options)
SELECT t.id, n.num, n.txt, 0,
       '[{"score":0,"text":"完全没有"},{"score":1,"text":"有几天"},{"score":2,"text":"一半以上时间"},{"score":3,"text":"几乎每天"}]'
FROM psychological_tests t
JOIN (
    SELECT 1 AS num, '做事时提不起劲或没有兴趣' AS txt UNION ALL
    SELECT 2, '感到心情低落、沮丧或绝望' UNION ALL
    SELECT 3, '入睡困难、睡不安稳或睡眠过多' UNION ALL
    SELECT 4, '感觉疲倦或没有活力' UNION ALL
    SELECT 5, '食欲不振或吃太多' UNION ALL
    SELECT 6, '觉得自己很糟，或觉得自己很失败' UNION ALL
    SELECT 7, '对事物专注有困难，例如阅读或看电视时' UNION ALL
    SELECT 8, '动作或说话速度缓慢到别人已察觉，或正好相反' UNION ALL
    SELECT 9, '有不如死掉或用某种方式伤害自己的念头'
) n ON 1=1
WHERE t.code = 'PHQ9-DEMO'
  AND NOT EXISTS (SELECT 1 FROM test_questions q WHERE q.test_id = t.id);
