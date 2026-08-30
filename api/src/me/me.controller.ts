import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  @Get()
  getMe(@Request() req: { user: JwtPayload }) {
    return req.user;
  }
}
