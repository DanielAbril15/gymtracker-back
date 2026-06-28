import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Peso corporal en kg' })
  @IsOptional()
  @IsNumber()
  @Min(20)
  weight?: number;

  @ApiPropertyOptional({ description: 'Altura en cm' })
  @IsOptional()
  @IsNumber()
  @Min(50)
  height?: number;

  @ApiPropertyOptional({ description: 'Edad en años' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  age?: number;
}
