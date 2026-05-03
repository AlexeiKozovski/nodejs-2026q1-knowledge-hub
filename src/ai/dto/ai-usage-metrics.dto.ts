import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CacheRatioBlockDto {
  @ApiProperty()
  hits!: number;

  @ApiProperty()
  misses!: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Hit ratio hits/(hits+misses), null when no lookups recorded for this bucket',
  })
  hitRatio!: number | null;
}

export class AiObservabilityBlockDto {
  @ApiProperty({ description: 'Process uptime since Nest bootstrap (seconds)' })
  uptimeSec!: number;

  @ApiProperty({
    description:
      'Average end-to-end handler duration (ms) per logical endpoint since startup',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  averageLatencyMsByEndpoint!: Record<string, number>;

  @ApiProperty()
  summarizeCache!: CacheRatioBlockDto;

  @ApiProperty()
  translateCache!: CacheRatioBlockDto;
}

export class AiUsageAndMetricsResponseDto {
  @ApiProperty()
  totalRequests!: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  requestsByEndpoint!: Record<string, number>;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Sum of usageMetadata.totalTokenCount from Gemini when the API returned counts',
  })
  approximateTotalTokens?: number;

  @ApiProperty({ type: () => AiObservabilityBlockDto })
  diagnostics!: AiObservabilityBlockDto;
}
