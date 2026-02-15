import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { resolve } from 'path';

import { AppModule } from '@/app.module';
import { CustomExceptionFilter } from '@/common/filters/custom-exception.filter';
import { ResponseInterceptor } from '@/common/interceptor/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
    }),
  );
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:5173',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
  });

  app.use(compression());
  app.setGlobalPrefix('/api');
  app.useGlobalFilters(new CustomExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableVersioning({ type: VersioningType.URI });
  app.useStaticAssets(resolve('./public'));
  app.use(cookieParser());

  const configService = app.get(ConfigService);

  const createConfig = () =>
    new DocumentBuilder()
      .setOpenAPIVersion('3.1.0')
      .addBearerAuth()
      .setTitle('Social Media API')
      .setDescription('Social Media API collection for Practice')
      .setVersion('1.0')
      .addTag('Auth')
      .addServer(configService.getOrThrow('BACKEND_URL'))
      .addCookieAuth('optional-session-id')
      .build();

  const documentApi = SwaggerModule.createDocument(app, createConfig());

  SwaggerModule.setup('apidoc/v1', app, documentApi, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(configService.getOrThrow<number>('PORT'), () => {
    console.debug(
      `[${configService.getOrThrow<string>('PROJECT_NAME')} | ${configService.getOrThrow<string>('NODE_ENV')}] is running on: ${configService.getOrThrow<string>('BACKEND_URL')}/apidoc/v1`,
    );
  });
}
bootstrap().catch((error) =>
  console.error('Failed to start the server due to: %s', error),
);
