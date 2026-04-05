import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Category } from '../types';
import { KnowledgeHubStore } from '../storage/knowledge-hub.store';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly store: KnowledgeHubStore) {}

  findAll(): CategoryResponseDto[] {
    return this.store
      .getAllCategories()
      .map((category) => this.toPublic(category));
  }

  findOne(id: string): CategoryResponseDto {
    const category = this.store.findCategoryById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.toPublic(category);
  }

  create(dto: CreateCategoryDto): CategoryResponseDto {
    const record: Category = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
    };
    this.store.insertCategory(record);
    return this.toPublic(record);
  }

  update(id: string, dto: CreateCategoryDto): CategoryResponseDto {
    const patch: Partial<Category> = {};
    if (dto.name !== undefined) {
      patch.name = dto.name;
    }
    if (dto.description !== undefined) {
      patch.description = dto.description;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = this.store.updateCategoryRecord(id, patch);
    if (!updated) {
      throw new NotFoundException('Category not found');
    }
    return this.toPublic(updated);
  }

  remove(id: string): void {
    const deleted = this.store.deleteCategory(id);
    if (!deleted) {
      throw new NotFoundException('Category not found');
    }
  }

  private toPublic(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
    };
  }
}
