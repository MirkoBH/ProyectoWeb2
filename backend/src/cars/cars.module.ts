import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Car } from "../database/entities/car.entity";
import { CarsController } from "./cars.controller";
import { CarsService } from "./cars.service";
import { RolesGuard } from "../common/guards/roles.guard";

@Module({
  imports: [TypeOrmModule.forFeature([Car])],
  controllers: [CarsController],
  providers: [CarsService, RolesGuard],
  exports: [CarsService]
})
export class CarsModule {}
