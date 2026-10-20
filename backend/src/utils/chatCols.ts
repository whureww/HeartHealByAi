// expert_chat 表懒迁移：新增 msg_type / test_id（专家发送问卷卡片消息）
// 存量库的表是旧结构，读写这两列会报 Unknown column；首次调用检查 information_schema 并补列，
// 之后进程内短路，失败允许下次重试（沿用 doctorCols / testCols 的模式）。
import { pool } from '../db/mysql';

let chatColsReady: Promise<void> | null = null;

export function ensureChatCols(): Promise<void> {
    if (!chatColsReady) {
        chatColsReady = (async () => {
            const [cols] = await pool.query(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expert_chat'
                   AND COLUMN_NAME IN ('msg_type','test_id')`
            );
            const have = new Set((cols as any[]).map((c) => c.COLUMN_NAME));
            const want: [string, string][] = [
                ['msg_type', "VARCHAR(16) NOT NULL DEFAULT 'text'"],
                ['test_id', 'INT UNSIGNED DEFAULT NULL']
            ];
            for (const [col, def] of want) {
                if (!have.has(col)) {
                    await pool.execute(`ALTER TABLE expert_chat ADD COLUMN ${col} ${def}`);
                }
            }
        })().catch((e) => {
            chatColsReady = null;
            throw e;
        });
    }
    return chatColsReady;
}
