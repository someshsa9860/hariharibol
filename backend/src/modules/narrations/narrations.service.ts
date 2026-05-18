import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateNarrationDto, UpdateNarrationDto } from './dto/narration.dto';

@Injectable()
export class NarrationsService {
  private readonly logger = new Logger(NarrationsService.name);

  constructor(private prisma: PrismaService) {}

  async getNarrations(verseId?: string, skip = 0, take = 20) {
    const where = {
      isPublished: true,
      ...(verseId ? { verseId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.narration.findMany({
        where,
        skip,
        take,
        include: { verse: { include: { book: true, chapter: true } } },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.narration.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async getNarrationById(id: string) {
    const narration = await this.prisma.narration.findUnique({
      where: { id },
      include: { verse: { include: { book: true, chapter: true } } },
    });

    if (!narration) throw new NotFoundException('Narration not found');
    return narration;
  }

  async createNarration(dto: CreateNarrationDto) {
    const narration = await this.prisma.narration.create({ data: dto });
    this.logger.log(`Narration created: ${narration.id} for verse ${dto.verseId}`);
    return narration;
  }

  async updateNarration(id: string, dto: UpdateNarrationDto) {
    await this._assertExists(id);
    const narration = await this.prisma.narration.update({ where: { id }, data: dto });
    this.logger.log(`Narration updated: ${id}`);
    return narration;
  }

  async deleteNarration(id: string) {
    await this._assertExists(id);
    await this.prisma.narration.delete({ where: { id } });
    this.logger.log(`Narration deleted: ${id}`);
    return { success: true };
  }

  private async _assertExists(id: string) {
    const narration = await this.prisma.narration.findUnique({ where: { id } });
    if (!narration) throw new NotFoundException('Narration not found');
    return narration;
  }
}
