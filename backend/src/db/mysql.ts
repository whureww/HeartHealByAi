import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import redisClient from './redis';

dotenv.config();

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        throw new Error(`❌ 环境变量 ${key} 未配置`);
    }
    return value;
}

const pool = mysql.createPool({
    host: requireEnv('MYSQL_HOST'),
    port: Number(requireEnv('MYSQL_PORT')),
    user: requireEnv('MYSQL_USER'),
    password: requireEnv('MYSQL_PASSWORD'),
    database: requireEnv('MYSQL_DATABASE'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function queryWithCache<T>(
    sql: string,
    params: any[],
    cacheKey: string,
    ttl = 60
): Promise<T> {
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const [rows] = await pool.execute(sql, params);
        await redisClient.set(cacheKey, JSON.stringify(rows), { EX: ttl });
        return rows as T;
    } catch (err) {
        console.error('Redis cache failed, fallback to DB:', err);
        const [rows] = await pool.execute(sql, params);
        return rows as T;
    }
}

export { pool };
