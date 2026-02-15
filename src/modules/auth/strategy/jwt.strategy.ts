import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { ExtractJwt, Strategy, VerifiedCallback } from 'passport-jwt';
import { Repository } from 'typeorm';

import { User } from '@/modules/users/entities/user.entity';

export type JwtPayloadType = {
  sub: string;
  iat?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayloadType,
    done: VerifiedCallback,
  ) {
    const { sub } = payload;

    const user = await this.userRepository.findOne({
      where: { id: sub },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return done(new UnauthorizedException(), false);

    return done(null, user, payload.iat);
  }
}
