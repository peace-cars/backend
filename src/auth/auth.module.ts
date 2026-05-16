import { Module, Global } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsService } from './permissions.service';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PermissionsService, RolesGuard],
  exports: [AuthService, PermissionsService, RolesGuard],
})
export class AuthModule {}
