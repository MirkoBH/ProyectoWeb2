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
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        url: configService.get<string>("DATABASE_URL"),
        autoLoadEntities: true,
        synchronize: false,
        ssl: configService.get<string>("DATABASE_URL")?.includes("supabase.co")
          ? { rejectUnauthorized: false }
          : false,
        entities: [User, Car]
      })
    }),
    AuthModule,
    UsersModule,
    CarsModule
  ]
})
export class AppModule {}
