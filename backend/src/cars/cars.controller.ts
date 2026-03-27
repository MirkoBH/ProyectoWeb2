import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { CarsService } from "./cars.service";
import { CreateCarDto } from "./dto/create-car.dto";
import { UpdateCarDto } from "./dto/update-car.dto";
import { QueryCarsDto } from "./dto/query-cars.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

@Controller("cars")
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Get()
  findAll(@Query() query: QueryCarsDto) {
    return this.carsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.carsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("seller")
  create(@Body() dto: CreateCarDto, @Req() req: { user: { id: string } }) {
    return this.carsService.create(dto, req.user.id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("seller")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCarDto,
    @Req() req: { user: { id: string } }
  ) {
    return this.carsService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("seller")
  remove(@Param("id") id: string, @Req() req: { user: { id: string } }) {
    return this.carsService.remove(id, req.user.id);
  }
}
