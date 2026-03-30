import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import { Car } from "../database/entities/car.entity";
import { CreateCarDto } from "./dto/create-car.dto";
import { UpdateCarDto } from "./dto/update-car.dto";
import { QueryCarsDto } from "./dto/query-cars.dto";

type AiAnalysis = {
  aiStatus: string;
  aiDamageSummary: string;
  aiPriceRange: string;
};

type GeminiPart = {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
};

@Injectable()
export class CarsService {
  constructor(
    @InjectRepository(Car)
    private readonly carsRepository: Repository<Car>,
    private readonly configService: ConfigService
  ) {}

  async uploadImages(
    files: Array<{
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }>
  ) {
    if (!files?.length) {
      throw new BadRequestException("Debes subir al menos una imagen JPG");
    }

    const uploadsDir = join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const baseUrl = this.configService.get<string>("PUBLIC_API_BASE_URL") || "http://localhost:3000";
    const urls: string[] = [];

    for (const file of files) {
      const isJpg = file.mimetype === "image/jpeg" || file.mimetype === "image/jpg";
      if (!isJpg) {
        throw new BadRequestException("Solo se permiten imagenes JPG/JPEG");
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new BadRequestException("Cada imagen no puede superar 2MB");
      }

      const safeExt = file.originalname.toLowerCase().endsWith(".jpeg") ? "jpeg" : "jpg";
      const fileName = `${randomUUID()}.${safeExt}`;
      const fullPath = join(uploadsDir, fileName);
      await writeFile(fullPath, file.buffer);
      urls.push(`${baseUrl}/uploads/${fileName}`);
    }

    return {
      urls
    };
  }

  async create(dto: CreateCarDto, sellerId: string) {
    const normalizedImageUrls = this.normalizeImageUrls(dto.imageUrls, dto.mainImageUrl);
    const mainImageUrl = dto.mainImageUrl ?? normalizedImageUrls[0] ?? null;

    const ai = await this.generateAiAnalysis(dto);

    const car = this.carsRepository.create({
      ...dto,
      sellerId,
      aiStatus: ai.aiStatus,
      aiDamageSummary: ai.aiDamageSummary,
      aiPriceRange: ai.aiPriceRange,
      mainImageUrl,
      imageUrls: normalizedImageUrls,
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

    const mergedForAi = {
      brand: dto.brand ?? car.brand,
      model: dto.model ?? car.model,
      year: dto.year ?? car.year,
      kilometers: dto.kilometers ?? car.kilometers,
      fuel: dto.fuel ?? car.fuel,
      transmission: dto.transmission ?? car.transmission,
      price: Number(dto.price ?? car.price),
      province: dto.province ?? car.province,
      city: dto.city ?? car.city ?? undefined,
      description: dto.description ?? car.description,
      mainImageUrl: dto.mainImageUrl ?? car.mainImageUrl ?? undefined,
      imageUrls:
        dto.imageUrls ??
        car.imageUrls ??
        (car.mainImageUrl ? [car.mainImageUrl] : [])
    };

    const ai = await this.generateAiAnalysis(mergedForAi);

    const normalizedImageUrls = this.normalizeImageUrls(
      dto.imageUrls ?? car.imageUrls ?? undefined,
      dto.mainImageUrl ?? car.mainImageUrl ?? undefined
    );
    const nextMainImage =
      dto.mainImageUrl !== undefined
        ? dto.mainImageUrl
        : car.mainImageUrl ?? normalizedImageUrls[0] ?? null;

    const updated = this.carsRepository.merge(car, {
      ...dto,
      aiStatus: ai.aiStatus,
      aiDamageSummary: ai.aiDamageSummary,
      aiPriceRange: ai.aiPriceRange,
      mainImageUrl: nextMainImage,
      imageUrls: normalizedImageUrls
    });
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

  private async generateAiAnalysis(input: {
    brand: string;
    model: string;
    year: number;
    kilometers: number;
    fuel: string;
    transmission: string;
    price: number;
    province: string;
    city?: string;
    description: string;
    mainImageUrl?: string;
    imageUrls?: string[];
  }): Promise<AiAnalysis> {
    const apiKey = this.configService.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      return this.generateHeuristicAnalysis(input);
    }

    const model = this.configService.get<string>("GEMINI_MODEL") || "gemini-1.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = [
      "Analiza esta publicacion de auto usado y responde SOLO JSON valido.",
      "Campos requeridos: status, opinion, estimatedPriceMin, estimatedPriceMax.",
      "status debe ser uno de: excellent, good, fair, repair.",
      "opinion: texto corto y claro en espanol, incluyendo observaciones visuales (danos/estado visible) y coherencia tecnica.",
      "estimatedPriceMin y estimatedPriceMax: numero en USD sin simbolos.",
      "Si se adjunta imagen, debes analizarla visualmente para detectar posibles danos visibles, desgaste de pintura o golpes.",
      "Datos de publicacion:",
      `marca=${input.brand}`,
      `modelo=${input.model}`,
      `anio=${input.year}`,
      `kilometraje=${input.kilometers}`,
      `combustible=${input.fuel}`,
      `transmision=${input.transmission}`,
      `precio_publicado=${input.price}`,
      `provincia=${input.province}`,
      `ciudad=${input.city || ""}`,
      `descripcion=${input.description}`,
      `imagen_url_principal=${input.mainImageUrl || ""}`,
      `cantidad_imagenes=${input.imageUrls?.length || (input.mainImageUrl ? 1 : 0)}`
    ].join("\n");

    try {
      const parts = await this.buildGeminiParts(prompt, input.mainImageUrl, input.imageUrls);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts
            }
          ]
        })
      });

      if (!response.ok) {
        return this.generateHeuristicAnalysis(input);
      }

      const data = (await response.json()) as any;
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: any) => part?.text || "")
          .join("\n") || "";

      const parsed = this.extractAiJson(text);
      if (!parsed) {
        return this.generateHeuristicAnalysis(input);
      }

      const status = this.normalizeAiStatus(parsed.status);
      const min = Number(parsed.estimatedPriceMin);
      const max = Number(parsed.estimatedPriceMax);

      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0 || min <= 0) {
        return this.generateHeuristicAnalysis(input);
      }

      const orderedMin = Math.min(min, max);
      const orderedMax = Math.max(min, max);

      return {
        aiStatus: status,
        aiDamageSummary: String(parsed.opinion || "Sin observaciones de IA"),
        aiPriceRange: `USD ${orderedMin.toLocaleString("es-AR")} - ${orderedMax.toLocaleString("es-AR")}`
      };
    } catch {
      return this.generateHeuristicAnalysis(input);
    }
  }

  private async buildGeminiParts(
    prompt: string,
    mainImageUrl?: string,
    imageUrls?: string[]
  ): Promise<GeminiPart[]> {
    const parts: GeminiPart[] = [{ text: prompt }];

    const urls = [...new Set([...(imageUrls || []), ...(mainImageUrl ? [mainImageUrl] : [])])]
      .filter(Boolean)
      .slice(0, 4);

    if (!urls.length) {
      return parts;
    }

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          continue;
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        if (!contentType.startsWith("image/")) {
          continue;
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        if (!imageBuffer.length || imageBuffer.length > 2 * 1024 * 1024) {
          continue;
        }

        parts.push({
          inline_data: {
            mime_type: contentType,
            data: imageBuffer.toString("base64")
          }
        });
      } catch {
        continue;
      }
    }

    return parts;
  }

  private extractAiJson(text: string): {
    status: string;
    opinion: string;
    estimatedPriceMin: number;
    estimatedPriceMax: number;
  } | null {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  private normalizeImageUrls(imageUrls?: string[], mainImageUrl?: string): string[] {
    return [...new Set([...(imageUrls || []), ...(mainImageUrl ? [mainImageUrl] : [])])]
      .filter((url) => typeof url === "string" && url.trim().length > 0)
      .slice(0, 8);
  }

  private normalizeAiStatus(value: string): string {
    const v = String(value || "").toLowerCase();
    if (v.includes("excellent") || v.includes("excelente")) return "excellent";
    if (v.includes("good") || v.includes("buen")) return "good";
    if (v.includes("fair") || v.includes("regular")) return "fair";
    if (v.includes("repair") || v.includes("repar")) return "repair";
    return "fair";
  }

  private generateHeuristicAnalysis(input: {
    year: number;
    kilometers: number;
    price: number;
  }): AiAnalysis {
    const currentYear = new Date().getFullYear();
    const age = Math.max(0, currentYear - input.year);
    const expectedKm = Math.max(1, age * 15000);
    const ratio = input.kilometers / expectedKm;

    let aiStatus = "good";
    if (ratio < 0.6) aiStatus = "excellent";
    if (ratio >= 1.4) aiStatus = "fair";
    if (ratio >= 2.2) aiStatus = "repair";

    const base = Math.max(1000, input.price);
    const min = Math.round(base * 0.9);
    const max = Math.round(base * 1.1);

    const opinion =
      aiStatus === "excellent"
        ? "Kilometraje muy bajo para su antiguedad; la publicacion parece coherente y atractiva."
        : aiStatus === "good"
          ? "La relacion anio-kilometraje es razonable para mercado de usados y no presenta alertas fuertes."
          : aiStatus === "fair"
            ? "Hay senales de desgaste por kilometraje relativamente alto para la antiguedad del vehiculo."
            : "Kilometraje extremadamente elevado para su antiguedad, conviene revisar estado mecanico en detalle.";

    return {
      aiStatus,
      aiDamageSummary: opinion,
      aiPriceRange: `USD ${min.toLocaleString("es-AR")} - ${max.toLocaleString("es-AR")}`
    };
  }
}
