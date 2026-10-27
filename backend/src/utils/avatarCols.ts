// 头像存储迁移（懒执行，幂等）：users.avatar 列曾存 base64 图片数据，
// 现头像改存 MinIO 对象（avatar/{userId}.jpg，无需数据库列），
// 首次访问头像相关路由时自动删除该列及其中的 base64 数据
import { pool } from '../db/mysql';

let ensured: Promise<void> | null = null;

export function ensureUsersAvatarColumnDropped(): Promise<void> {
    if (!ensured) {
        ensured = (async () => {
            const [rows] = await pool.execute(
                `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'`
            );
            if (Number((rows as any[])[0]?.c || 0) > 0) {
                await pool.execute('ALTER TABLE users DROP COLUMN avatar');
                console.log('[avatar-migration] users.avatar 列已删除（base64 头像数据随列清除，新头像改存 MinIO）');
            }
        })().catch((e) => {
            ensured = null;
            throw e;
        });
    }
    return ensured;
}
