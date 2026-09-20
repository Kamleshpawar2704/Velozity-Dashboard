import type { Role } from '@prisma/client';
import type { Request } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';

export type AuthUser = { id: string; role: Role; name: string; email: string };
export type AuthedRequest = Request<ParamsDictionary> & { user?: AuthUser };
