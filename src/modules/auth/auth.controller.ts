// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  MagicLinkDto,
  PushTokenDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @ApiOperation({ summary: 'Create a new user account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @ApiOperation({ summary: 'Log in with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('magic-link')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @ApiOperation({ summary: 'Request a magic link sign-in email' })
  async magicLink(@Body() dto: MagicLinkDto) {
    await this.authService.sendMagicLink(dto.email);
    return {
      message:
        'If an account exists for this email, a sign-in link has been sent.',
    };
  }

  @Get('magic-link/verify')
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @ApiOperation({ summary: 'Verify a magic link token' })
  verifyMagicLink(@Query('token') token: string) {
    return this.authService.verifyMagicLink(token);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile and fresh tokens' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.id);
  }

  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register an Expo push notification token' })
  registerPushToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: PushTokenDto,
  ) {
    return this.authService.registerPushToken(
      user.id,
      dto.token,
      dto.platform,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out (client-side token deletion)' })
  logout() {
    return { success: true };
  }
}
