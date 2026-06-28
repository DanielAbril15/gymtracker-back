import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { JwtPayload } from './interfaces/jwt-payload.interface';

import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private get userRepo(): Repository<User> {
    return this.moduleRef.get(getRepositoryToken(User), { strict: false });
  }

  async register(dto: RegisterDto, res: Response): Promise<{ accessToken: string; user: { _id: string; email: string; name: string; createdAt: Date } }> {
    const email = dto.email.toLowerCase();
    
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = this.userRepo.create({
      email,
      passwordHash,
      name: dto.name,
    });

    const saved = await this.userRepo.save(user);

    // Auto-login after registration (same as login flow)
    const sub = saved.id.toString();
    const payload: JwtPayload = { sub, email: saved.email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '15m') as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken,
      user: {
        _id: saved.id.toString(),
        email: saved.email,
        name: saved.name,
        createdAt: saved.createdAt,
      },
    };
  }

  async login(dto: LoginDto, res: Response): Promise<{ accessToken: string; user: { _id: string; email: string; name: string; createdAt: Date } }> {
    const email = dto.email.toLowerCase();
    const dbUser = await this.userRepo.findOne({ where: { email } });

    if (!dbUser) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const matched = await bcrypt.compare(dto.password, dbUser.passwordHash);
    if (!matched) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const sub = dbUser.id.toString();
    const payload: JwtPayload = { sub, email: dbUser.email };
    
    // Generate Access Token (short lived: 15m)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '15m') as any,
    });

    // Generate Refresh Token (long lived: 7d)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any,
    });

    // Set Refresh Token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth', // only sent to auth endpoints
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken,
      user: {
        _id: dbUser.id.toString(),
        email: dbUser.email,
        name: dbUser.name,
        createdAt: dbUser.createdAt,
      },
    };
  }

  async refresh(cookieToken: string, res: Response): Promise<{ accessToken: string; user: { _id: string; email: string; name: string; createdAt: Date } }> {
    if (!cookieToken) {
      throw new UnauthorizedException('No hay token de refresco disponible');
    }

    try {
      const payload: JwtPayload = this.jwtService.verify(cookieToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const dbUser = await this.userRepo.findOne({ where: { id: Number(payload.sub) } });

      if (!dbUser) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      const sub = dbUser.id.toString();
      const newPayload: JwtPayload = { sub, email: dbUser.email };
      
      const accessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '15m') as any,
      });

      // Optionally renew refresh token
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any,
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return {
        accessToken,
        user: {
          _id: dbUser.id.toString(),
          email: dbUser.email,
          name: dbUser.name,
          createdAt: dbUser.createdAt,
        },
      };

    } catch (error) {
      throw new UnauthorizedException('Token de refresco inválido o expirado');
    }
  }

  logout(res: Response): void {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }
}
