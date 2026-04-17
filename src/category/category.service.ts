import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category as PrismaCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany();
    return categories.map((category) => this.toPublic(category));
  }

  async findOne(id: string): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.toPublic(category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const record = await this.prisma.category.create({
      data: { name: dto.name, description: dto.description },
    });
    return this.toPublic(record);
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('No fields to update');
    }

    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : undefined),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : undefined),
      },
    });

    return this.toPublic(updated);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private toPublic(category: PrismaCategory): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
    };
  }
}
