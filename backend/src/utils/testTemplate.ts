// 专家问卷模板表懒迁移（幂等，首次访问模板路由时兜底建表）
// 专家可把已编好的完整问卷存为私人模板（含题目/选项/分级标准），
// 之后新建问卷时一键套用；全新部署由 schema.sql 直接就绪，此处供存量库补表
import { pool } from '../db/mysql';

let ensured: Promise<void> | null = null;

export function ensureTemplateSchema(): Promise<void> {
    if (!ensured) {
        ensured = (async () => {
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS test_templates (
                    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    expert_id INT UNSIGNED NOT NULL COMMENT '归属专家用户ID',
                    name VARCHAR(100) NOT NULL COMMENT '模板名称',
                    description TEXT,
                    category VARCHAR(50) DEFAULT '',
                    estimated_minutes INT NOT NULL DEFAULT 5,
                    scoring_method VARCHAR(30) DEFAULT 'sum',
                    result_levels TEXT COMMENT 'JSON: [{min,max,level,desc}]',
                    questions MEDIUMTEXT NOT NULL COMMENT 'JSON: 规整后的完整题目与选项',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    KEY idx_template_expert (expert_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        })().catch((e) => {
            ensured = null;
            throw e;
        });
    }
    return ensured;
}
