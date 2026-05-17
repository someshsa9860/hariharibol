import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CacheService } from '@infrastructure/cache/cache.service';
import { CreateMantraDto, UpdateMantraDto } from './dto/mantra.dto';

const TTL_5MIN = 5 * 60 * 1000;
const MANTRAS_LIST_PATTERN = 'mantras:list';

@Injectable()
export class MantrasService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async getMantras(sampradayaId?: string, skip = 0, take = 20) {
    const cacheKey = `mantras:list:${sampradayaId || ''}:${skip}:${take}`;
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
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
      },
      TTL_5MIN,
    );
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
    const mantra = await this.prisma.mantra.create({ data: dto });
    await this.cacheService.delPattern(MANTRAS_LIST_PATTERN);
    return mantra;
  }

  async updateMantra(id: string, dto: UpdateMantraDto) {
    await this._assertExists(id);
    const mantra = await this.prisma.mantra.update({ where: { id }, data: dto });
    await this.cacheService.delPattern(MANTRAS_LIST_PATTERN);
    return mantra;
  }

  async deleteMantra(id: string) {
    await this._assertExists(id);
    await this.prisma.mantra.delete({ where: { id } });
    await this.cacheService.delPattern(MANTRAS_LIST_PATTERN);
    return { success: true };
  }

  private async _assertExists(id: string) {
    const mantra = await this.prisma.mantra.findUnique({ where: { id } });
    if (!mantra) throw new NotFoundException('Mantra not found');
    return mantra;
  }
}
