import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
export function notFound(_req: Request, res: Response) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }); }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.flatten() } });
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
