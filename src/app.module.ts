import {
  ExecutionContext,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { OptionalApiKeyGuard } from './common/guards/optional-api-key.guard';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { ArticleModule } from './article/article.module';
import { CategoryModule } from './category/category.module';
import { CommentModule } from './comment/comment.module';
import { AuthModule } from './auth/auth.module';
import { AiController } from './ai/ai.controller';
import { AiModule } from './ai/ai.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: 60000,
            limit: 100,
          },
          {
            name: 'ai',
            ttl: 60000,
            limit: Math.max(
              1,
              Number.parseInt(
                String(config.get('AI_RATE_LIMIT_RPM') ?? '20'),
                10,
              ),
            ),
            skipIf: (context: ExecutionContext) =>
              context.getClass().name !== AiController.name,
          },
        ],
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    ArticleModule,
    CategoryModule,
    CommentModule,
    AiModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: OptionalApiKeyGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
