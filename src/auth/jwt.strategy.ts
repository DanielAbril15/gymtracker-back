import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback_secret_key',
    });
  }

  async validate(payload: JwtPayload) {
    const userRepo = this.moduleRef.get<Repository<User>>(getRepositoryToken(User), { strict: false });
    const user = await userRepo.findOne({
      where: { id: Number(payload.sub) },
      select: ['id', 'email', 'name', 'createdAt', 'updatedAt'],
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o token inválido');
    }
    return user;
  }
}
