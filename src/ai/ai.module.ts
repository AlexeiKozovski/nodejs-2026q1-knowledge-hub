import { Module } from '@nestjs/common';
import { AppLogger } from '../common/logging/app.logger';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiCacheService } from './ai-cache.service';
import { AiGenerateSessionService } from './ai-generate-session.service';
import { AiObservabilityService } from './ai-observability.service';
import { AiUsageService } from './ai-usage.service';
import { GeminiModule } from './gemini.module';
import { RagModule } from './rag.module';

@Module({
  imports: [PrismaModule, GeminiModule, RagModule],
  controllers: [AiController],
  providers: [
    AppLogger,
    AiService,
    AiCacheService,
    AiObservabilityService,
    AiGenerateSessionService,
    AiUsageService,
  ],
})
export class AiModule {}
