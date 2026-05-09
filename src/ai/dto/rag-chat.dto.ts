import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RagChatRequestDto {
  @ApiProperty({
    description: 'User question for the RAG assistant',
    minLength: 1,
    maxLength: 4000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  question!: string;

  @ApiPropertyOptional({
    description: 'Optional conversation id to continue an existing chat',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  conversationId?: string;
}

export class RagChatSourceDto {
  @ApiProperty()
  articleId!: string;

  @ApiProperty()
  articleTitle!: string;

  @ApiProperty()
  relevantChunk!: string;
}

export class RagChatResponseDto {
  @ApiProperty()
  answer!: string;

  @ApiProperty({ type: [RagChatSourceDto] })
  sources!: RagChatSourceDto[];

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;
}

export class RagConversationMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @ApiProperty()
  text!: string;

  @ApiProperty({ description: 'Unix timestamp in milliseconds' })
  timestamp!: number;
}

export class RagConversationHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ type: [RagConversationMessageDto] })
  @IsArray()
  messages!: RagConversationMessageDto[];
}
