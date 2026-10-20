// psychological_tests 表 created_by 列懒迁移（专家自建问卷，0.6.0）
// 存量部署的云端库建表时无此列（schema.sql 已更新但无自动迁移），
// 首次访问专家问卷路由时检查 information_schema 并补列，之后进程内短路；失败允许下次重试。
import { pool } from '../db/mysql';

let testColsReady: Promise<void> | null = null;

export function ensureTestCreatedByColumn(): Promise<void> {
    if (!testColsReady) {
        testColsReady = (async () => {
            const [cols] = await pool.query(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'psychological_tests'
                   AND COLUMN_NAME = 'created_by'`
            );
            if (!((cols as any[]).length)) {
                await pool.execute(
                    "ALTER TABLE psychological_tests ADD COLUMN created_by INT UNSIGNED DEFAULT NULL COMMENT '创建者用户ID（专家创建的问卷）；NULL=管理员/系统创建'"
                );
            }
        })().catch((e) => {
            testColsReady = null;
            throw e;
        });
    }
    return testColsReady;
}
