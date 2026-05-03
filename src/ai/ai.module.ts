import { Module } from '@nestjs/common';
import { AppLogger } from '../common/logging/app.logger';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [
    AppLogger,
    AiService,
    GeminiService,
    AiCacheService,
    AiUsageService,
  ],
})
export class AiModule {}
