import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from "class-validator";

export class CreateCarDto {
  @IsString()
  brand!: string;

  @IsString()
  model!: string;

  @IsInt()
  @Min(1950)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(0)
  kilometers!: number;

  @IsString()
  fuel!: string;

  @IsString()
  transmission!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsString()
  province!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsString()
  mainImageUrl?: string;
}
