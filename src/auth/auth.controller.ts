import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

class TokensResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({
    description: 'User created',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid data or login taken' })
  async signup(@Body() dto: SignupDto): Promise<UserResponseDto> {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and obtain tokens' })
  @ApiOkResponse({ type: TokensResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid data' })
  @ApiForbiddenResponse({ description: 'Authentication failed' })
  async login(@Body() dto: LoginDto): Promise<TokensResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiOkResponse({ type: TokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing refresh token' })
  @ApiForbiddenResponse({ description: 'Invalid or expired refresh token' })
  async refresh(@Body() body: unknown): Promise<TokensResponseDto> {
    return this.authService.refresh(body);
  }
}
