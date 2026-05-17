import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { AdminRole } from '@modules/admin/roles.enum';

// Higher index = higher privilege; a user satisfies any required role at or below their level
const ROLE_HIERARCHY: AdminRole[] = [AdminRole.MODERATOR, AdminRole.ADMIN, AdminRole.SUPER_ADMIN];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) return false;

    const userLevel = ROLE_HIERARCHY.indexOf(user.role as AdminRole);
    const minRequired = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY.indexOf(r)));

    return userLevel >= minRequired;
  }
}
