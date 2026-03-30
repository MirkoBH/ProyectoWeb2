import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UsersService } from "../users/users.service";
import { User } from "../database/entities/user.entity";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const { url, anonKey } = this.getSupabaseConfig();

    const response = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password: dto.password,
        options: {
          data: {
            full_name: dto.fullName,
            role: dto.role
          }
        }
      })
    });

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const message = this.extractSupabaseError(payload) || "No se pudo registrar el usuario";
      throw new BadRequestException(message);
    }

    const existing = await this.usersService.findByEmail(email);
    if (!existing) {
      await this.usersService.createUser({
        email,
        fullName: dto.fullName,
        passwordHash: await this.createPlaceholderPasswordHash(),
        role: dto.role
      });
    }

    return {
      message: "Cuenta creada. Revisá tu email para confirmar el registro."
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const { url, anonKey } = this.getSupabaseConfig();

    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password: dto.password
      })
    });

    const payload = await this.safeJson(response);
    if (!response.ok) {
      const message = this.extractSupabaseError(payload) || "Credenciales invalidas";
      throw new UnauthorizedException(message);
    }

    const supabaseUser = payload?.user;
    if (!supabaseUser?.email) {
      throw new UnauthorizedException("No se pudo validar el usuario");
    }

    if (!supabaseUser.email_confirmed_at) {
      throw new UnauthorizedException("Debes confirmar tu email antes de iniciar sesion");
    }

    let user = await this.usersService.findByEmail(email);
    if (!user) {
      const metadataRole = supabaseUser.user_metadata?.role;
      const role = metadataRole === "seller" ? "seller" : "buyer";
      const fullNameFromMeta = String(supabaseUser.user_metadata?.full_name || "").trim();
      const inferredName = fullNameFromMeta || email.split("@")[0] || "Usuario";

      user = await this.usersService.createUser({
        email,
        fullName: inferredName,
        passwordHash: await this.createPlaceholderPasswordHash(),
        role
      });
    }

    return this.buildAuthResponse(user);
  }

  private getSupabaseConfig() {
    const url = (this.configService.get<string>("SUPABASE_URL") || "").trim();
    const anonKey = (this.configService.get<string>("SUPABASE_ANON_KEY") || "").trim();

    if (!url || !anonKey) {
      throw new BadRequestException("Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en el backend");
    }

    if (anonKey === "<SECRET>" || anonKey.length < 40) {
      throw new BadRequestException("SUPABASE_ANON_KEY invalida. Cargá la clave publica anon real del proyecto.");
    }

    return { url, anonKey };
  }

  private extractSupabaseError(payload: any): string {
    if (!payload) return "";
    return String(payload.msg || payload.error_description || payload.message || payload.error || "").trim();
  }

  private async safeJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private createPlaceholderPasswordHash(): Promise<string> {
    const randomPassword = randomBytes(32).toString("hex");
    return bcrypt.hash(randomPassword, 10);
  }

  private async buildAuthResponse(user: User) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    };
  }
}
