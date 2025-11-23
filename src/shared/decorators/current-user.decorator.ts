import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  role: string;
  cooperativeId?: string;
  status: string;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | any => {
    const request = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user: AuthenticatedUser }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
