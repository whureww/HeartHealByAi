"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFound = exports.asyncHandler = exports.BusinessError = void 0;
const zod_1 = require("zod");
class BusinessError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.BusinessError = BusinessError;
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncHandler = asyncHandler;
const notFound = (req, res, next) => {
    const error = new BusinessError(`Not found - ${req.originalUrl}`, 404);
    next(error);
};
exports.notFound = notFound;
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || '服务器错误';
    if (err instanceof zod_1.ZodError) {
        statusCode = 400;
        message = err.errors.map(e => e.message).join(', ');
    }
    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
};
exports.errorHandler = errorHandler;
