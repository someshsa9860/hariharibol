import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateMantraDto, UpdateMantraDto } from './dto/mantra.dto';

@Injectable()
export class MantrasService {
  constructor(private prisma: PrismaService) {}

  async getMantras(sampradayaId?: string, skip = 0, take = 20) {
    const where = {
      isPublic: true,
      ...(sampradayaId ? { sampradayId: sampradayaId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.mantra.findMany({
        where,
        skip,
        take,
        include: { sampraday: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.mantra.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async getMantraById(id: string) {
    const mantra = await this.prisma.mantra.findUnique({
      where: { id },
      include: { sampraday: true },
    });

    if (!mantra) throw new NotFoundException('Mantra not found');
    return mantra;
  }

  async createMantra(dto: CreateMantraDto) {
    return this.prisma.mantra.create({ data: dto });
  }

  async updateMantra(id: string, dto: UpdateMantraDto) {
    await this._assertExists(id);
    return this.prisma.mantra.update({ where: { id }, data: dto });
  }

  async deleteMantra(id: string) {
    await this._assertExists(id);
    await this.prisma.mantra.delete({ where: { id } });
    return { success: true };
  }

  private async _assertExists(id: string) {
    const mantra = await this.prisma.mantra.findUnique({ where: { id } });
    if (!mantra) throw new NotFoundException('Mantra not found');
    return mantra;
  }
}
