import { IsEmail, IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @IsIn(["buyer", "seller"])
  role!: "buyer" | "seller";
}
