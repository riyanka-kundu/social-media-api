import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { User } from '@/modules/users/entities/user.entity';

type RequestWithUser = Request & { user: Partial<User> };

export const LoginUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request: RequestWithUser = context.switchToHttp().getRequest();
    return request.user;
  },
);
