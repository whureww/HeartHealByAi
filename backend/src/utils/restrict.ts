// 账号封禁/禁言限制：状态判定（含到期自动解除）+ 管理端实时通知的广播注册器
// users.status: 0=正常 1=禁言 2=封禁；restricted_until: NULL=永久，过期视为自动解除
import { pool } from '../db/mysql';

export interface Restriction {
    type: 'muted' | 'banned';
    until: string | null;   // ISO 时间或 null（永久）
    message: string;
}

// index.ts 在 io 创建后注册广播器，admin 路由据此实时通知/踢线
interface RestrictBroadcaster {
    notify: (userId: number, payload: Restriction) => void;
    disconnect: (userId: number) => void;
    notifyLifted?: (userId: number) => void;
}
let broadcaster: RestrictBroadcaster | null = null;

export function registerRestrictBroadcaster(fn: RestrictBroadcaster) {
    broadcaster = fn;
}

export function notifyUserRestricted(userId: number, payload: Restriction) {
    broadcaster?.notify(userId, payload);
}

export function notifyRestrictionLifted(userId: number) {
    broadcaster?.notifyLifted?.(userId);
}

export function disconnectUser(userId: number) {
    broadcaster?.disconnect(userId);
}

function formatUntil(until: Date | null, type: 'muted' | 'banned'): Restriction {
    const label = type === 'banned' ? '封禁' : '禁言';
    const untilText = until
        ? `${until.toLocaleString('zh-CN', { hour12: false })} 自动解除`
        : '永久生效';
    return {
        type,
        until: until ? until.toISOString() : null,
        message: `您的账号已被管理员${label}（${untilText}），期间无法${type === 'banned' ? '登录和使用' : '发送消息'}`
    };
}

/**
 * 查询用户当前生效的限制；到期限制自动清除（惰性解除）。
 * 无限制时返回 null。
 */
export async function getActiveRestriction(userId: number): Promise<Restriction | null> {
    const [rows] = await pool.execute(
        'SELECT status, restricted_until FROM users WHERE id = ?',
        [userId]
    );
    const row = (rows as any[])[0];
    if (!row || !row.status) return null;

    const until: Date | null = row.restricted_until ? new Date(row.restricted_until) : null;
    if (until && until.getTime() <= Date.now()) {
        // 到期自动解除
        await pool.execute(
            'UPDATE users SET status = 0, restricted_until = NULL WHERE id = ?',
            [userId]
        );
        return null;
    }

    if (Number(row.status) === 2) return formatUntil(until, 'banned');
    if (Number(row.status) === 1) return formatUntil(until, 'muted');
    return null;
}
