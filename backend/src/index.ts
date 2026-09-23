import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import testRoutes from './routes/tests';
import morgan from 'morgan';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import { errorHandler, notFound } from './middleware/error';
import adminRouter from './routes/admin';
import expertRouter from './routes/expert';
import { pool } from './db/mysql';
import aiRouter from './routes/ai';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware/auth';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// ===== 1. 日志中间件（最先）=====
app.use(morgan('dev'));

// ===== 2. CORS 中间件（必须在所有路由之前）=====
app.use(cors({ origin: '*', credentials: false }));

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
// 放宽到 5MB：头像以 base64 存储（体积膨胀约 1/3），Express 默认 100KB 会导致 413
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 暴露 io 和 userSockets 给路由使用
app.set('io', io);

// ===== 4. 测试路由 =====
app.get('/test-cors', (req, res) => {
  res.json({ message: 'CORS OK' })
});

app.get('/health', (req, res) => {
  res.json({ name: 'Server1', time: new Date().toISOString() });
});

// ===== 5. API 路由 =====
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/tests', testRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/expert', expertRouter);
app.use('/api/ai', aiRouter);

// ===== 6. 错误处理（最后）=====
app.use(notFound);
app.use(errorHandler);

// ===== Socket.IO 实时聊天 =====
// 支持一个用户多连接（多窗口/多设备）
const userSockets = new Map<number, Set<string>>(); // userId -> Set<socketId>
const userOnlineStatus = new Map<number, boolean>(); // userId -> 是否在线

// 暴露给路由使用
app.set('userSockets', userSockets);
app.set('userOnlineStatus', userOnlineStatus);

// 广播用户在线状态变更的辅助函数
const broadcastUserStatus = (userId: number, isOnline: boolean) => {
    const currentStatus = userOnlineStatus.get(userId);
    if (currentStatus !== isOnline) {
        userOnlineStatus.set(userId, isOnline);
        io.emit('user-status-change', { userId, isOnline });
        console.log(`用户 ${userId} 状态变更为: ${isOnline ? '在线' : '离线'}`);
    }
};

// 获取用户的某个 socket 实例（用于定向发送通知）
const getUserSocket = (userId: number): any => {
    const socketIds = userSockets.get(userId);
    if (!socketIds || socketIds.size === 0) return null;
    const socketId = Array.from(socketIds).pop();
    return socketId ? io.sockets.sockets.get(socketId) : null;
};

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 用户认证并绑定 userId（安全修复：必须携带有效 JWT，身份以 token 为准）
    socket.on('authenticate', (payload: any) => {
        let token: string | undefined;
        if (payload && typeof payload === 'object' && payload.token) {
            token = payload.token;
        } else if (typeof payload === 'string') {
            token = payload;
        }

        let userId: number | null = null;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                userId = decoded.userId;
            } catch {
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
        (socket as any).userId = userId;

        broadcastUserStatus(userId, true);
        console.log(`用户 ${userId} 已认证，当前连接数: ${socketSet.size}`);
    });

    // 查询用户在线状态
    socket.on('query-user-status', (userId: number) => {
        const isOnline = userOnlineStatus.get(userId) || false;
        socket.emit('user-status-change', { userId, isOnline });
        console.log(`查询用户 ${userId} 状态: ${isOnline ? '在线' : '离线'}`);
    });

    // 用户主动登出/离线
    socket.on('user-logout', (userId: number) => {
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
    socket.on('join-room', (appointmentId: number) => {
        socket.join(`appointment-${appointmentId}`);
        console.log(`用户 ${(socket as any).userId} 加入房间: appointment-${appointmentId}`);
        
        // 推送房间内已在线的其他用户状态给当前用户
        const room = io.sockets.adapter.rooms.get(`appointment-${appointmentId}`);
        if (room) {
            for (const socketId of room) {
                if (socketId === socket.id) continue;
                const otherSocket = io.sockets.sockets.get(socketId);
                if (otherSocket) {
                    const otherUserId = (otherSocket as any).userId;
                    if (otherUserId) {
                        console.log(`推送用户 ${otherUserId} 在线状态给新加入的用户 ${(socket as any).userId}`);
                        socket.emit('user-status-change', { userId: otherUserId, isOnline: true });
                    }
                }
            }
        }
        
        socket.to(`appointment-${appointmentId}`).emit('user-joined-room', {
            appointmentId,
            userId: (socket as any).userId
        });
    });

    // 离开预约房间
    socket.on('leave-room', (appointmentId: number) => {
        socket.leave(`appointment-${appointmentId}`);
        console.log(`用户离开房间: appointment-${appointmentId}`);
    });

    // 发送消息
    socket.on('send-message', async (data: {
        appointmentId: number,
        senderId: number,
        receiverId: number,
        content: string
    }) => {
        try {
            // 安全修复：senderId 以服务端校验的身份为准，忽略客户端传值
            const senderId = (socket as any).userId;
            if (!senderId || senderId !== data.senderId) {
                socket.emit('error', { message: '身份校验失败，请重新登录' });
                return;
            }

            await pool.execute(
                `INSERT INTO expert_chat (sender_id, receiver_id, content, appointment_id, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [senderId, data.receiverId, data.content, data.appointmentId]
            );

            const [senderRows] = await pool.execute(
                'SELECT username FROM users WHERE id = ?',
                [senderId]
            );
            const senderName = (senderRows as any[])[0]?.username || '未知用户';

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
        } catch (e) {
            console.error('发送消息失败:', e);
            socket.emit('error', { message: '发送消息失败' });
        }
    });

    // 标记消息已读
    socket.on('mark-read', async (data: { appointmentId: number, userId: number }) => {
        try {
            await pool.execute(
                `UPDATE expert_chat SET is_read = TRUE 
                 WHERE appointment_id = ? AND receiver_id = ?`,
                [data.appointmentId, data.userId]
            );
        } catch (e) {
            console.error('标记已读失败:', e);
        }
    });

    socket.on('disconnect', () => {
        const userId = (socket as any).userId;
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
    console.log(`✅ 服务已启动: http://localhost:${PORT}`);
    console.log(`✅ Socket.IO 已启用`);
});
