import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRaceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalLaps!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  tapCooldownSeconds?: number;
}
