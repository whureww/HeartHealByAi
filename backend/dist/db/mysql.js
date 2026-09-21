"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.queryWithCache = queryWithCache;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const redis_1 = __importDefault(require("./redis"));
dotenv_1.default.config();
function requireEnv(key) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        throw new Error(`❌ 环境变量 ${key} 未配置`);
    }
    return value;
}
const pool = promise_1.default.createPool({
    host: requireEnv('MYSQL_HOST'),
    port: Number(requireEnv('MYSQL_PORT')),
    user: requireEnv('MYSQL_USER'),
    password: requireEnv('MYSQL_PASSWORD'),
    database: requireEnv('MYSQL_DATABASE'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
exports.pool = pool;
async function queryWithCache(sql, params, cacheKey, ttl = 60) {
    try {
        const cached = await redis_1.default.get(cacheKey);
        if (cached)
            return JSON.parse(cached);
        const [rows] = await pool.execute(sql, params);
        await redis_1.default.set(cacheKey, JSON.stringify(rows), { EX: ttl });
        return rows;
    }
    catch (err) {
        console.error('Redis cache failed, fallback to DB:', err);
        const [rows] = await pool.execute(sql, params);
        return rows;
    }
}
