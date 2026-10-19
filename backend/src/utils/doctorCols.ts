// doctors 表英文列懒迁移（双语名片）：name_en/title_en/specialty_en/intro_en
// 英文界面按语言优先显示 _en 字段，留空回落中文原文。
// 首次调用检查 information_schema 并补列，之后进程内短路；失败允许下次重试。
import { pool } from '../db/mysql';

let enColsReady: Promise<void> | null = null;

export function ensureDoctorEnColumns(): Promise<void> {
    if (!enColsReady) {
        enColsReady = (async () => {
            const [cols] = await pool.query(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'doctors'
                   AND COLUMN_NAME IN ('name_en','title_en','specialty_en','intro_en')`
            );
            const have = new Set((cols as any[]).map((c) => c.COLUMN_NAME));
            const want: [string, string][] = [
                ['name_en', "VARCHAR(80) DEFAULT ''"],
                ['title_en', "VARCHAR(80) DEFAULT ''"],
                ['specialty_en', "VARCHAR(300) DEFAULT ''"],
                ['intro_en', 'TEXT']
            ];
            for (const [col, def] of want) {
                if (!have.has(col)) {
                    await pool.execute(`ALTER TABLE doctors ADD COLUMN ${col} ${def}`);
                }
            }
        })().catch((e) => {
            enColsReady = null;
            throw e;
        });
    }
    return enColsReady;
}
