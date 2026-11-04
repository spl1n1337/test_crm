import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.setGlobalPrefix("api");
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.enableCors({
    origin: (process.env.FRONTEND_URL || "http://localhost:3000").split(","),
    credentials: true,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`Nest API listening on ${port}`);
}

void bootstrap();
