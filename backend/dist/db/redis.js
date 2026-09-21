"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});
redisClient.connect()
    .then(() => {
    console.log('Redis connected');
})
    .catch((err) => {
    console.error('Redis connect failed:', err);
    process.exit(1);
});
exports.default = redisClient;
