import {
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
	MinLength
} from "class-validator";

export class UpdateCarDto {
	@IsOptional()
	@IsString()
	brand?: string;

	@IsOptional()
	@IsString()
	model?: string;

	@IsOptional()
	@IsInt()
	@Min(1950)
	@Max(2100)
	year?: number;

	@IsOptional()
	@IsInt()
	@Min(0)
	kilometers?: number;

	@IsOptional()
	@IsString()
	fuel?: string;

	@IsOptional()
	@IsString()
	transmission?: string;

	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	price?: number;

	@IsOptional()
	@IsString()
	province?: string;

	@IsOptional()
	@IsString()
	city?: string;

	@IsOptional()
	@IsString()
	@MinLength(10)
	description?: string;

	@IsOptional()
	@IsString()
	mainImageUrl?: string;
}
