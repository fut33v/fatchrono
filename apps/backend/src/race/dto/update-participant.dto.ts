import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateParticipantDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  bib?: number;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  categoryId?: string | null;

  @IsString()
  @IsOptional()
  team?: string | null;

  @IsString()
  @IsOptional()
  birthDate?: string | null;
}
