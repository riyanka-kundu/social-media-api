import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';

import { LoginDto } from '@/modules/auth/dto/login.dto';
import { RegisterDto } from '@/modules/auth/dto/register.dto';
import { HelperService } from '@/modules/helper/helper.service';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly helperService: HelperService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
  async register(registerDto: RegisterDto) {
    const doesUserExists = await this.userRepository.findOne({
      where: {
        email: registerDto.email,
      },
    });

    if (doesUserExists) throw new BadRequestException('Email already in use!');

    const hashedPassword = await this.helperService.hashPassword(
      registerDto.password,
    );

    if (!hashedPassword) {
      this.logger.error('Failed to hash password due to: %s', hashedPassword);
      throw new InternalServerErrorException('Something went wrong!');
    }

    const newUser = await this.userRepository.save({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
    });

    if (!newUser) {
      this.logger.error('Failed to create a new user due to: %s', newUser);
      throw new UnprocessableEntityException('Something went wrong!');
    }

    return {
      message: 'Registration successful! Please login to continue.',
    };
  }

  async login(loginDto: LoginDto, res: Response) {
    const user = await this.userRepository.findOne({
      where: {
        email: loginDto.email,
      },
      select: [
        'id',
        'email',
        'name',
        'profilePicture',
        'createdAt',
        'dateOfBirth',
        'gender',
        'authTokens',
        'password',
      ],
    });

    if (!user) throw new UnauthorizedException('Invalid credentials!');

    const isPasswordValid = await this.helperService.verifyPassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials!');

    const tokens = await this.generateTokens(user.id, user.email);

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
      },
      accessToken: tokens.accessToken,
    };
  }

  async logout({
    req,
    res,
    user,
  }: {
    user: Partial<User>;
    res: Response;
    req: Request;
  }) {
    if (!user.id) {
      return {
        message: 'Logout successful!',
      };
    }

    const refreshToken = req.cookies['refreshToken'];

    const userToBeLoggedOut = await this.userRepository.findOne({
      where: { id: user.id },
      select: [
        'id',
        'email',
        'name',
        'profilePicture',
        'createdAt',
        'dateOfBirth',
        'gender',
        'authTokens',
        'password',
      ],
    });

    if (!userToBeLoggedOut) {
      throw new UnauthorizedException('Invalid refresh token!');
    }

    if (refreshToken && userToBeLoggedOut.authTokens) {
      userToBeLoggedOut.authTokens = userToBeLoggedOut.authTokens.filter(
        (token) => token !== refreshToken,
      );
      await this.userRepository.save(userToBeLoggedOut);
    }

    this.clearRefreshTokenCookie(res);

    return {
      message: 'Logout successful!',
    };
  }

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken)
      throw new UnauthorizedException('Refresh token not found!');

    let payload: any;

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      this.logger.error('Failed to verify refresh token due to: %s', error);
      throw new UnauthorizedException('Invalid or expired refresh token!');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: [
        'id',
        'email',
        'name',
        'profilePicture',
        'createdAt',
        'dateOfBirth',
        'gender',
        'authTokens',
        'password',
      ],
    });

    if (!user || !user.authTokens || user.authTokens.length === 0) {
      throw new UnauthorizedException('Access denied!');
    }

    const tokenExists = user.authTokens.includes(refreshToken);

    if (!tokenExists) {
      user.authTokens = [];
      await this.userRepository.save(user);
      this.clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Invalid refresh token!');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    await this.updateRefreshToken(user.id, tokens.refreshToken, refreshToken);

    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      message: 'Tokens refreshed successfully!',
      accessToken: tokens.accessToken,
    };
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow('JWT_ACCESS_EXPIRATION'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRATION'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshToken(
    userId: string,
    refreshToken: string,
    oldToken?: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'name',
        'profilePicture',
        'createdAt',
        'dateOfBirth',
        'gender',
        'authTokens',
        'password',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('User not found!');
    }

    if (!user.authTokens) {
      user.authTokens = [];
    }

    if (oldToken) {
      user.authTokens = user.authTokens.filter((token) => token !== oldToken);
    }

    user.authTokens.push(refreshToken);

    if (user.authTokens.length > 5) {
      user.authTokens = user.authTokens.slice(-5);
    }

    await this.userRepository.save(user);

    return;
  }
  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    const isProduction =
      this.configService.getOrThrow<string>('NODE_ENV') === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    const isProduction =
      this.configService.getOrThrow<string>('NODE_ENV') === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 0,
      path: '/',
    });
  }
}
