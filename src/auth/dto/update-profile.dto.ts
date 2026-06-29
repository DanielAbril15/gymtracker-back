import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, IsBoolean, IsString } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Opt-in para el ciclo menstrual' })
  @IsOptional()
  @IsBoolean()
  menstrualCycleOptIn?: boolean;

  @ApiPropertyOptional({ description: 'Fecha de inicio del último periodo (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  lastPeriodStartDate?: string;

  @ApiPropertyOptional({ description: 'Duración promedio del ciclo menstrual' })
  @IsOptional()
  @IsNumber()
  @Min(15)
  averageCycleLength?: number;
}
