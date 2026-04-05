import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryService } from './category.service';

@ApiTags('categories')
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  findAll(): CategoryResponseDto[] {
    return this.categoryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single category  by id' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid category id (not a UUID v4)' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): CategoryResponseDto {
    return this.categoryService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new category' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  create(@Body() dto: CreateCategoryDto): CategoryResponseDto {
    return this.categoryService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update category info' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id or body' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateCategoryDto,
  ): CategoryResponseDto {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete category' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Invalid category id (not a UUID v4)' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): void {
    this.categoryService.remove(id);
  }
}
