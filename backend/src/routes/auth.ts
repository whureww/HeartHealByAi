import { Router, Request, Response } from 'express';
import { pool } from '../db/mysql';
import { generateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { BusinessError } from '../middleware/error';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import redis from '../db/redis';
import axios from 'axios';
import { TokenManager } from '../utils/tokenManager';

const router = Router();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

// ========== 图形验证码 ==========
router.get('/captcha', asyncHandler(async (req: Request, res: Response) => {
    const width = 120;
    const height = 40;
    const code = randomInt(1000, 9999).toString();
    const captchaId = `captcha:${Date.now()}:${randomInt(1000, 9999)}`;

    await redis.set(captchaId, code, { EX: 300 });

    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="Arial" font-size="24" fill="#333"
              transform="rotate(${randomInt(-10, 10)} 60 20)">
            ${code}
        </text>
        <line x1="0" y1="${randomInt(5, 35)}" x2="120" y2="${randomInt(5, 35)}" stroke="#999" stroke-width="1"/>
        <line x1="${randomInt(10, 110)}" y1="0" x2="${randomInt(10, 110)}" y2="40" stroke="#999" stroke-width="1"/>
    </svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('X-Captcha-Id', captchaId);
    res.send(svg);
}));

// ========== 验证图形验证码 ==========
const verifyCaptcha = async (captchaId: string, code: string): Promise<boolean> => {
    const stored = await redis.get(captchaId);
    if (!stored || stored !== code) return false;
    await redis.del(captchaId);
    return true;
};

// ========== 发送短信验证码 ==========
router.post('/sms-code', asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
        phone: z.string().regex(/^1[3-9]\d{9}$/, { message: "请输入有效的手机号" }),
        captchaId: z.string(),
        captchaCode: z.string().length(4)
    });

    const { phone, captchaId, captchaCode } = schema.parse(req.body);

    const captchaValid = await verifyCaptcha(captchaId, captchaCode);
    if (!captchaValid) {
        throw new BusinessError('图形验证码错误或已过期', 400);
    }

    const rateKey = `rate_limit:sms:${phone}`;
    const exists = await redis.get(rateKey);
    if (exists) {
        throw new BusinessError('发送过于频繁，请60秒后再试', 429);
    }

    const code = randomInt(100000, 999999).toString();

    await redis.set(`sms:${phone}`, code, { EX: 300 });
    await redis.set(rateKey, '1', { EX: 60 });

    console.log(`[SMS] Phone: ${phone}, Code: ${code}`);

    res.json({
        success: true,
        message: '验证码已发送',
        // 安全修复：生产环境不回传验证码
        ...(process.env.NODE_ENV !== 'production' ? { debugCode: code } : {})
    });
}));

// ========== 短信登录/注册 ==========
router.post('/sms-login', asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
        phone: z.string().regex(/^1[3-9]\d{9}$/),
        code: z.string().length(6)
    });

    const { phone, code } = schema.parse(req.body);

    const stored = await redis.get(`sms:${phone}`);
    if (!stored || stored !== code) {
        throw new BusinessError('验证码错误或已过期', 400);
    }

    await redis.del(`sms:${phone}`);

    const [rows] = await pool.execute(
        'SELECT id, role, username FROM users WHERE phone = ?',
        [phone]
    );
    const users = rows as any[];

    let userId: number;
    let role: number;
    let username: string;

    if (users.length === 0) {
        const hashedPwd = await bcrypt.hash(randomInt(100000, 999999).toString(), BCRYPT_ROUNDS);
        const [result] = await pool.execute(
            'INSERT INTO users (username, phone, password_hash, role, email) VALUES (?, ?, ?, ?, ?)',
            [`user_${phone.slice(-4)}`, phone, hashedPwd, 1, `${phone}@placeholder.com`]
        );
        userId = (result as any).insertId;
        role = 1;
        username = `user_${phone.slice(-4)}`;
    } else {
        userId = users[0].id;
        role = users[0].role;
        username = users[0].username;
    }

    // 生成唯一 onlyId 和 Token（单点登录）
    const onlyId = TokenManager.generateOnlyId();
    const token = generateToken(userId, onlyId);
    await TokenManager.saveToken(userId, token, onlyId);

    res.json({
        success: true,
        message: '登录成功',
        data: {
            token,
            onlyId,
            userId,
            role,
            username,
            isNewUser: users.length === 0
        }
    });
}));

// ========== OAuth登录（微信/QQ） ==========
router.get('/oauth/:provider', asyncHandler(async (req: Request, res: Response) => {
    const provider = req.params.provider;

    if (!['wechat', 'qq'].includes(provider)) {
        throw new BusinessError('不支持的登录方式', 400);
    }

    let authUrl: string;
    const redirectUri = encodeURIComponent(`${process.env.APP_URL}/api/auth/oauth/callback/${provider}`);

    if (provider === 'wechat') {
        authUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${process.env.WECHAT_APPID}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect`;
    } else {
        authUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${process.env.QQ_APPID}&redirect_uri=${redirectUri}&state=STATE&scope=get_user_info`;
    }

    res.json({
        success: true,
        data: { authUrl }
    });
}));

// ========== OAuth回调 ==========
router.get('/oauth/callback/:provider', asyncHandler(async (req: Request, res: Response) => {
    const { provider } = req.params;
    const { code } = req.query;

    if (!code) {
        throw new BusinessError('授权失败，未获取到授权码', 400);
    }

    let openid: string;
    let userInfo: any;

    if (provider === 'wechat') {
        const tokenRes = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
            params: {
                appid: process.env.WECHAT_APPID,
                secret: process.env.WECHAT_SECRET,
                code,
                grant_type: 'authorization_code'
            }
        });
        openid = tokenRes.data.openid;

        const userRes = await axios.get('https://api.weixin.qq.com/sns/userinfo', {
            params: {
                access_token: tokenRes.data.access_token,
                openid
            }
        });
        userInfo = userRes.data;
    } else {
        const tokenRes = await axios.get('https://graph.qq.com/oauth2.0/token', {
            params: {
                grant_type: 'authorization_code',
                client_id: process.env.QQ_APPID,
                client_secret: process.env.QQ_SECRET,
                code,
                redirect_uri: `${process.env.APP_URL}/api/auth/oauth/callback/qq`
            }
        });
        const params = new URLSearchParams(tokenRes.data);
        const accessToken = params.get('access_token');

        const openidRes = await axios.get('https://graph.qq.com/oauth2.0/me', {
            params: { access_token: accessToken }
        });
        openid = openidRes.data.openid;

        const userRes = await axios.get('https://graph.qq.com/user/get_user_info', {
            params: {
                access_token: accessToken,
                oauth_consumer_key: process.env.QQ_APPID,
                openid
            }
        });
        userInfo = userRes.data;
    }

    const [oauthRows] = await pool.execute(
        'SELECT user_id FROM user_oauth WHERE provider = ? AND openid = ?',
        [provider, openid]
    );

    let userId: number;
    let isNewUser = false;

    if ((oauthRows as any[]).length === 0) {
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [userInfo.nickname || `user_${Date.now()}`, `${provider}_${openid}@oauth.com`, await bcrypt.hash(randomInt(100000, 999999).toString(), BCRYPT_ROUNDS), 1]
        );
        userId = (result as any).insertId;

        await pool.execute(
            'INSERT INTO user_oauth (user_id, provider, openid, unionid, access_token) VALUES (?, ?, ?, ?, ?)',
            [userId, provider, openid, userInfo.unionid || null, 'token_placeholder']
        );
        isNewUser = true;
    } else {
        userId = (oauthRows as any[])[0].user_id;
    }

    // 生成唯一 onlyId 和 Token（单点登录）
    const onlyId = TokenManager.generateOnlyId();
    const token = generateToken(userId, onlyId);
    await TokenManager.saveToken(userId, token, onlyId);

    // 重定向到前端，带上token和onlyId
    res.redirect(`${process.env.FRONTEND_URL}/oauth/callback?token=${token}&onlyId=${onlyId}&isNewUser=${isNewUser}`);
}));

export default router;
