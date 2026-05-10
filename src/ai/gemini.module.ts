import { Module } from '@nestjs/common';
import { AppLogger } from '../common/logging/app.logger';
import { GeminiService } from './gemini.service';

@Module({
  providers: [AppLogger, GeminiService],
  exports: [AppLogger, GeminiService],
})
export class GeminiModule {}
