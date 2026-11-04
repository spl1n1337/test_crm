import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { DeadlinesModule } from "./deadlines/deadlines.module";
import { HealthController } from "./health.controller";
import { MailModule } from "./mail/mail.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local", "../.env", "../.env.local"],
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    MailModule,
    AuthModule,
    UploadsModule,
    RealtimeModule,
    DeadlinesModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
