import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'BAN' | 'UNBAN' | 'APPROVE' | 'REJECT' | 'BROADCAST';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async logAction(
    adminId: string,
    action: AuditAction,
    resourceType: string,
    resourceId?: string,
    details?: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          adminId,
          action,
          entityType: resourceType,
          entityId: resourceId,
          changesBefore: before ?? undefined,
          changesAfter: after ?? undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${action} on ${resourceType}/${resourceId}`, error);
    }
  }
}
