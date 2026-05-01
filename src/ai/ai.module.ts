import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService, GeminiService],
})
export class AiModule {}
