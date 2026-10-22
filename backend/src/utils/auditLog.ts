// AI 对话审查日志表懒迁移（幂等，服务启动/首次访问时兜底建表）
// 用途：管理员每次查看用户 AI 会话都落一条审计记录（谁、何时、看了谁的哪个会话），
// 实现「对话可审查、可追溯」的合规闭环；全新部署由 schema.sql 直接就绪，此处供存量库补表
import { pool } from '../db/mysql';

let ensured = false;

export async function ensureAuditSchema(): Promise<void> {
    if (ensured) return;
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS ai_audit_logs (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            admin_id INT UNSIGNED NOT NULL COMMENT '操作管理员',
            target_user_id INT UNSIGNED NOT NULL COMMENT '被查看会话归属用户',
            session_id VARCHAR(40) NOT NULL COMMENT '被查看的会话 id',
            action VARCHAR(20) NOT NULL DEFAULT 'view' COMMENT '动作（当前仅 view）',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            KEY idx_audit_admin (admin_id),
            KEY idx_audit_target (target_user_id),
            KEY idx_audit_time (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    ensured = true;
}
