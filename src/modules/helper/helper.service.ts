import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class HelperService {
  private readonly logger = new Logger(HelperService.name);
  constructor(private readonly configService: ConfigService) {}
  async hashPassword(password: string) {
    try {
      return await argon2.hash(password, {
        secret: Buffer.from(this.configService.getOrThrow('PASSWORD_SECRET')),
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        hashLength: 50,
        timeCost: 3,
      });
    } catch (error) {
      this.logger.error('Failed to hash password due to: %s', error);
      throw error;
    }
  }

  async verifyPassword(password: string, hash: string) {
    try {
      return await argon2.verify(hash, password, {
        secret: Buffer.from(this.configService.getOrThrow('PASSWORD_SECRET')),
      });
    } catch (error) {
      this.logger.error('Failed to verify password due to: %s', error);
      throw error;
    }
  }
}
