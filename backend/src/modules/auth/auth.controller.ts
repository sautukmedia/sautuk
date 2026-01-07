import { Controller, Post, Body, Req, Res, Get, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as express from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Google Login Endpoint
  @Post('google-login')
  async googleLogin(
    @Body() body: GoogleLoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const authData = await this.authService.loginWithGoogle(body.token);
    this.setRefreshTokenCookie(res, authData.refreshToken);
    return {
      accessToken: authData.accessToken,
      user: authData.user,
    };
  }

  // Credentials Login Endpoint (Email + Password)
  @Post('login')
  async credentialsLogin(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const authData = await this.authService.loginWithCredentials(body.email, body.password);
    this.setRefreshTokenCookie(res, authData.refreshToken);
    return {
      accessToken: authData.accessToken,
      user: authData.user,
    };
  }

  // Token Refresh Endpoint
  @Post('refresh')
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing from cookies');
    }

    const authData = await this.authService.refreshSession(refreshToken);
    // Optionally rotate the refresh token here if desired, but simple refresh is stable
    return {
      accessToken: authData.accessToken,
      user: authData.user,
    };
  }

  // Logout Endpoint
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: express.Response) {
    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully' };
  }

  // Profile Endpoint
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: express.Request) {
    return { user: req.user };
  }

  // Change Password Endpoint
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: express.Request,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      (req.user as any).sub,
      body.oldPassword,
      body.newPassword,
    );
  }

  // Helper: Set secure cookie
  private setRefreshTokenCookie(res: express.Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT expiration)
    });
  }

  // Helper: Clear cookie
  private clearRefreshTokenCookie(res: express.Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
  }
}
