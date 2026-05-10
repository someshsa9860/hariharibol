// Last auto-updated: 2026-05-10
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Middleware
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: configService.get<string>('ALLOWED_ORIGINS')?.split(',') || '*',
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalGuards(app.get(JwtGuard));

  const port = configService.get<number>('PORT') || 3000;

  await app.listen(port);
  console.log(`✅ Application running on http://localhost:${port}`);
}

bootstrap();
