import { pool } from '../db/mysql';

/**
 * 校验用户是否为某预约的参与方（预约本人或对应专家）。
 * 聊天记录读取/发送、Socket 房间加入、已读标记等敏感操作前必须先过此校验，
 * 防止任意登录用户越权读写他人咨询会话。
 *
 * 返回参与方 userId，供服务端推导消息接收方（忽略客户端传值）。
 */
export async function isAppointmentParticipant(
    appointmentId: number,
    userId: number
): Promise<{ ok: boolean; userId?: number; doctorUserId?: number }> {
    const [rows] = await pool.execute(
        `SELECT ar.user_id, d.user_id AS doctor_user_id
         FROM appointment_records ar
         LEFT JOIN doctors d ON ar.doctor_id = d.id
         WHERE ar.id = ?`,
        [appointmentId]
    );
    const apt = (rows as any[])[0];
    if (!apt) return { ok: false };
    if (apt.user_id === userId || apt.doctor_user_id === userId) {
        return { ok: true, userId: apt.user_id, doctorUserId: apt.doctor_user_id };
    }
    return { ok: false };
}
