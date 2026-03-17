// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { addHours } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import type { User, UserProfile } from '@prisma/client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: SafeUser;
  profile: UserProfile | null;
}

export type SafeUser = Pick<User, 'id' | 'email' | 'createdAt'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Register ────────────────────────────────────────────────────────────────
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        profile: {
          create: {
            displayName: dto.displayName,
            timezone: dto.timezone ?? 'UTC',
            primaryGoals: [],
          },
        },
      },
      include: { profile: true },
    });

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'user_registered' },
    });

    this.logger.log(`New user registered: ${user.email}`);
    const tokens = await this.generateTokens(user.id);
    return { tokens, user: this.sanitize(user), profile: user.profile };
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'user_logged_in' },
    });

    const tokens = await this.generateTokens(user.id);
    return { tokens, user: this.sanitize(user), profile: user.profile };
  }

  // ── Magic link ──────────────────────────────────────────────────────────────
  async sendMagicLink(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) return;

    const token = uuid();
    const expiresAt = addHours(new Date(), 1);

    await this.prisma.magicLink.create({
      data: { userId: user.id, token, expiresAt },
    });

    await this.notifications.sendMagicLinkEmail(email, token);
  }

  async verifyMagicLink(token: string): Promise<AuthResponse> {
    const link = await this.prisma.magicLink.findUnique({ where: { token } });

    if (!link) throw new BadRequestException('Invalid or expired magic link.');
    if (link.usedAt) throw new BadRequestException('This magic link has already been used.');
    if (link.expiresAt < new Date()) throw new BadRequestException('This magic link has expired.');

    await this.prisma.magicLink.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: link.userId },
      include: { profile: true },
    });

    if (!user) throw new NotFoundException('User not found.');

    const tokens = await this.generateTokens(user.id);
    return { tokens, user: this.sanitize(user), profile: user.profile };
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwt.verify<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      // Verify user still exists
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException('User not found.');
      return this.generateTokens(user.id);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  // ── Push token ──────────────────────────────────────────────────────────────
  async registerPushToken(userId: string, token: string, platform: string) {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  // ── Me ──────────────────────────────────────────────────────────────────────
  async getMe(userId: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    // Generate fresh tokens on /me call so clients can seamlessly refresh
    const tokens = await this.generateTokens(user.id);
    return { tokens, user: this.sanitize(user), profile: user.profile };
  }

  // ── Validate (for LocalStrategy) ────────────────────────────────────────────
  async validateUser(email: string, password: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user || !user.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? this.sanitize(user) : null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private async generateTokens(userId: string): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId },
        {
          secret: this.config.get<string>('JWT_SECRET'),
          expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      ),
      this.jwt.signAsync(
        { sub: userId },
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '30d' as any,
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private sanitize(user: User): SafeUser {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
