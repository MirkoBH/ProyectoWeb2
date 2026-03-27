import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CarsModule } from "./cars/cars.module";
import { User } from "./database/entities/user.entity";
import { Car } from "./database/entities/car.entity";
import { AppController } from "./app.controller";

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>("DATABASE_URL") ?? "";
        const isSupabase = /supabase\.(co|com)/.test(url);

        return {
          type: "postgres",
          url,
          autoLoadEntities: true,
          synchronize: false,
          ssl: isSupabase ? { rejectUnauthorized: false } : false,
          extra: isSupabase
            ? {
                ssl: {
                  rejectUnauthorized: false
                }
              }
            : undefined,
          entities: [User, Car]
        };
      }
    }),
    AuthModule,
    UsersModule,
    CarsModule
  ]
})
export class AppModule {}
