import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Car } from "../database/entities/car.entity";
import { CreateCarDto } from "./dto/create-car.dto";
import { UpdateCarDto } from "./dto/update-car.dto";
import { QueryCarsDto } from "./dto/query-cars.dto";

@Injectable()
export class CarsService {
  constructor(
    @InjectRepository(Car)
    private readonly carsRepository: Repository<Car>
  ) {}

  async create(dto: CreateCarDto, sellerId: string) {
    const car = this.carsRepository.create({
      ...dto,
      sellerId,
      aiStatus: null,
      aiDamageSummary: null,
      aiPriceRange: null,
      mainImageUrl: dto.mainImageUrl ?? null,
      city: dto.city ?? null
    });
    return this.carsRepository.save(car);
  }

  async findAll(query: QueryCarsDto) {
    const qb = this.carsRepository.createQueryBuilder("car");

    if (query.brand) qb.andWhere("car.brand = :brand", { brand: query.brand });
    if (query.model) qb.andWhere("car.model = :model", { model: query.model });
    if (query.yearMin) qb.andWhere("car.year >= :yearMin", { yearMin: query.yearMin });
    if (query.yearMax) qb.andWhere("car.year <= :yearMax", { yearMax: query.yearMax });
    if (query.priceMin) qb.andWhere("car.price >= :priceMin", { priceMin: query.priceMin });
    if (query.priceMax) qb.andWhere("car.price <= :priceMax", { priceMax: query.priceMax });
    if (query.kilometersMax) {
      qb.andWhere("car.kilometers <= :kilometersMax", {
        kilometersMax: query.kilometersMax
      });
    }
    if (query.province) qb.andWhere("car.province = :province", { province: query.province });

    return qb.orderBy("car.created_at", "DESC").getMany();
  }

  async findOne(id: string) {
    const car = await this.carsRepository.findOne({ where: { id } });
    if (!car) {
      throw new NotFoundException("Auto no encontrado");
    }
    return car;
  }

  async update(id: string, dto: UpdateCarDto, sellerId: string) {
    const car = await this.findOne(id);
    if (car.sellerId !== sellerId) {
      throw new ForbiddenException("No puedes editar este auto");
    }

    const updated = this.carsRepository.merge(car, dto);
    return this.carsRepository.save(updated);
  }

  async remove(id: string, sellerId: string) {
    const car = await this.findOne(id);
    if (car.sellerId !== sellerId) {
      throw new ForbiddenException("No puedes eliminar este auto");
    }

    await this.carsRepository.delete(id);
    return { success: true };
  }
}
