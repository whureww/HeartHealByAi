"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const tests_1 = __importDefault(require("./routes/tests"));
const morgan_1 = __importDefault(require("morgan"));
const users_1 = __importDefault(require("./routes/users"));
const auth_1 = __importDefault(require("./routes/auth"));
const error_1 = require("./middleware/error");
const admin_1 = __importDefault(require("./routes/admin"));
const expert_1 = __importDefault(require("./routes/expert"));
const mysql_1 = require("./db/mysql");
const ai_1 = __importDefault(require("./routes/ai"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_2 = require("./middleware/auth");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: true,
        credentials: true
    }
});
const PORT = process.env.PORT || 3001;
// ===== 1. 日志中间件（最先）=====
app.use((0, morgan_1.default)('dev'));
// ===== 2. CORS 中间件（必须在所有路由之前）=====
app.use((0, cors_1.default)({ origin: '*', credentials: false }));
// 手动 CORS 头（备用，确保覆盖所有情况）
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});
// ===== 3. 解析请求体 =====
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 暴露 io 和 userSockets 给路由使用
app.set('io', io);
// ===== 4. 测试路由 =====
app.get('/test-cors', (req, res) => {
    res.json({ message: 'CORS OK' });
});
app.get('/health', (req, res) => {
    res.json({ name: 'Server1', time: new Date().toISOString() });
});
// ===== 5. API 路由 =====
app.use('/api/users', users_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/tests', tests_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/expert', expert_1.default);
app.use('/api/ai', ai_1.default);
// ===== 6. 错误处理（最后）=====
app.use(error_1.notFound);
app.use(error_1.errorHandler);
// ===== Socket.IO 实时聊天 =====
// 支持一个用户多连接（多窗口/多设备）
const userSockets = new Map(); // userId -> Set<socketId>
const userOnlineStatus = new Map(); // userId -> 是否在线
// 暴露给路由使用
app.set('userSockets', userSockets);
app.set('userOnlineStatus', userOnlineStatus);
// 广播用户在线状态变更的辅助函数
const broadcastUserStatus = (userId, isOnline) => {
    const currentStatus = userOnlineStatus.get(userId);
    if (currentStatus !== isOnline) {
        userOnlineStatus.set(userId, isOnline);
        io.emit('user-status-change', { userId, isOnline });
        console.log(`用户 ${userId} 状态变更为: ${isOnline ? '在线' : '离线'}`);
    }
};
// 获取用户的某个 socket 实例（用于定向发送通知）
const getUserSocket = (userId) => {
    const socketIds = userSockets.get(userId);
    if (!socketIds || socketIds.size === 0)
        return null;
    const socketId = Array.from(socketIds).pop();
    return socketId ? io.sockets.sockets.get(socketId) : null;
};
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);
    // 用户认证并绑定 userId（安全修复：必须携带有效 JWT，身份以 token 为准）
    socket.on('authenticate', (payload) => {
        let token;
        if (payload && typeof payload === 'object' && payload.token) {
            token = payload.token;
        }
        else if (typeof payload === 'string') {
            token = payload;
        }
        let userId = null;
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, auth_2.JWT_SECRET);
                userId = decoded.userId;
            }
            catch {
                userId = null;
            }
        }
        if (!userId) {
            socket.emit('auth-error', { message: '登录状态无效，请重新登录' });
            socket.disconnect(true);
            return;
        }
        let socketSet = userSockets.get(userId);
        if (!socketSet) {
            socketSet = new Set();
            userSockets.set(userId, socketSet);
        }
        socketSet.add(socket.id);
        socket.userId = userId;
        broadcastUserStatus(userId, true);
        console.log(`用户 ${userId} 已认证，当前连接数: ${socketSet.size}`);
    });
    // 查询用户在线状态
    socket.on('query-user-status', (userId) => {
        const isOnline = userOnlineStatus.get(userId) || false;
        socket.emit('user-status-change', { userId, isOnline });
        console.log(`查询用户 ${userId} 状态: ${isOnline ? '在线' : '离线'}`);
    });
    // 用户主动登出/离线
    socket.on('user-logout', (userId) => {
        const socketSet = userSockets.get(userId);
        if (socketSet) {
            socketSet.delete(socket.id);
            if (socketSet.size === 0) {
                userSockets.delete(userId);
                broadcastUserStatus(userId, false);
            }
        }
        socket.disconnect(true);
        console.log(`用户 ${userId} 主动登出`);
    });
    // 加入预约房间
    socket.on('join-room', (appointmentId) => {
        socket.join(`appointment-${appointmentId}`);
        console.log(`用户 ${socket.userId} 加入房间: appointment-${appointmentId}`);
        // 推送房间内已在线的其他用户状态给当前用户
        const room = io.sockets.adapter.rooms.get(`appointment-${appointmentId}`);
        if (room) {
            for (const socketId of room) {
                if (socketId === socket.id)
                    continue;
                const otherSocket = io.sockets.sockets.get(socketId);
                if (otherSocket) {
                    const otherUserId = otherSocket.userId;
                    if (otherUserId) {
                        console.log(`推送用户 ${otherUserId} 在线状态给新加入的用户 ${socket.userId}`);
                        socket.emit('user-status-change', { userId: otherUserId, isOnline: true });
                    }
                }
            }
        }
        socket.to(`appointment-${appointmentId}`).emit('user-joined-room', {
            appointmentId,
            userId: socket.userId
        });
    });
    // 离开预约房间
    socket.on('leave-room', (appointmentId) => {
        socket.leave(`appointment-${appointmentId}`);
        console.log(`用户离开房间: appointment-${appointmentId}`);
    });
    // 发送消息
    socket.on('send-message', async (data) => {
        try {
            // 安全修复：senderId 以服务端校验的身份为准，忽略客户端传值
            const senderId = socket.userId;
            if (!senderId || senderId !== data.senderId) {
                socket.emit('error', { message: '身份校验失败，请重新登录' });
                return;
            }
            await mysql_1.pool.execute(`INSERT INTO expert_chat (sender_id, receiver_id, content, appointment_id, created_at)
                 VALUES (?, ?, ?, ?, NOW())`, [senderId, data.receiverId, data.content, data.appointmentId]);
            const [senderRows] = await mysql_1.pool.execute('SELECT username FROM users WHERE id = ?', [senderId]);
            const senderName = senderRows[0]?.username || '未知用户';
            const messageData = {
                id: Date.now(),
                sender_id: senderId,
                receiver_id: data.receiverId,
                content: data.content,
                appointment_id: data.appointmentId,
                sender_name: senderName,
                created_at: new Date().toISOString()
            };
            io.to(`appointment-${data.appointmentId}`).emit('new-message', messageData);
            const receiverSocket = getUserSocket(data.receiverId);
            if (receiverSocket) {
                receiverSocket.emit('chat-notification', {
                    appointmentId: data.appointmentId,
                    senderName,
                    content: data.content
                });
            }
        }
        catch (e) {
            console.error('发送消息失败:', e);
            socket.emit('error', { message: '发送消息失败' });
        }
    });
    // 标记消息已读
    socket.on('mark-read', async (data) => {
        try {
            await mysql_1.pool.execute(`UPDATE expert_chat SET is_read = TRUE 
                 WHERE appointment_id = ? AND receiver_id = ?`, [data.appointmentId, data.userId]);
        }
        catch (e) {
            console.error('标记已读失败:', e);
        }
    });
    socket.on('disconnect', () => {
        const userId = socket.userId;
        if (userId) {
            const socketSet = userSockets.get(userId);
            if (socketSet) {
                socketSet.delete(socket.id);
                if (socketSet.size === 0) {
                    userSockets.delete(userId);
                    broadcastUserStatus(userId, false);
                }
            }
        }
        console.log('用户断开连接:', socket.id);
    });
});
httpServer.listen(PORT, () => {
    console.log(`✅ 服务已启动: http://your-server-ip:${PORT}`);
    console.log(`✅ Socket.IO 已启用`);
});
