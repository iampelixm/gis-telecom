import { Controller, Get, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  @Get()
  getMe(@Request() req: { user: JwtPayload }, @Res({ passthrough: true }) res: Response) {
    const types = new Set<string>();
    for (const p of req.user.permissions) {
      const m = /^objects:([a-z_]+):read$/.exec(p);
      if (m) {
        types.add(m[1]);
      } else if (p === '*') {
        types.add('*');
      }
    }
    res.header('X-Object-Types', [...types].join(','));
    return req.user;
  }
}
