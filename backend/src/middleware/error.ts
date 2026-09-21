import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class BusinessError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (fn: AsyncRequestHandler) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

export const notFound = (req: Request, res: Response, next: NextFunction) => {
    const error = new BusinessError(`Not found - ${req.originalUrl}`, 404);
    next(error);
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || '服务器错误';

    if (err instanceof ZodError) {
        statusCode = 400;
        message = err.errors.map(e => e.message).join(', ');
    }

    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
};
