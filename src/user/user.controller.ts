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
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  findAll(): UserResponseDto[] {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single user by id' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid user id (not a UUID v4)' })
  @ApiNotFoundResponse({ description: 'User not found' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): UserResponseDto {
    return this.userService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  create(@Body() dto: CreateUserDto): UserResponseDto {
    return this.userService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: "Update user's password" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id or body' })
  @ApiForbiddenResponse({ description: 'Old password is wrong' })
  @ApiNotFoundResponse({ description: 'User not found' })
  updatePassword(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePasswordDto,
  ): UserResponseDto {
    return this.userService.updatePassword(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Invalid user id (not a UUID v4)' })
  @ApiNotFoundResponse({ description: 'User not found' })
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): void {
    this.userService.remove(id);
  }
}
