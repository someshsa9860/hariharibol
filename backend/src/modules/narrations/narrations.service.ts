import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { CreateNarrationDto, UpdateNarrationDto } from './dto/narration.dto';

@Injectable()
export class NarrationsService {
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
    return this.prisma.narration.create({ data: dto });
  }

  async updateNarration(id: string, dto: UpdateNarrationDto) {
    await this._assertExists(id);
    return this.prisma.narration.update({ where: { id }, data: dto });
  }

  async deleteNarration(id: string) {
    await this._assertExists(id);
    await this.prisma.narration.delete({ where: { id } });
    return { success: true };
  }

  private async _assertExists(id: string) {
    const narration = await this.prisma.narration.findUnique({ where: { id } });
    if (!narration) throw new NotFoundException('Narration not found');
    return narration;
  }
}
