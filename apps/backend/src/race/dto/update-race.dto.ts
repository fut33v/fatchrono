import { IsInt, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class UpdateRaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  totalLaps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tapCooldownSeconds?: number;
}
