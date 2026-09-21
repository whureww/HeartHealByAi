import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient: RedisClientType = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err: Error) => {
    console.error('Redis error:', err);
});

redisClient.connect()
    .then(() => {
        console.log('Redis connected');
    })
    .catch((err: Error) => {
        console.error('Redis connect failed:', err);
        process.exit(1);
    });

export default redisClient;
