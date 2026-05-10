import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiModule } from './gemini.module';
import { RagService } from './rag.service';

@Module({
  imports: [PrismaModule, GeminiModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
