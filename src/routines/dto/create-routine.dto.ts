import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoutineDto {
  @ApiProperty({ example: 'Rutina de Fuerza e Hipertrofia', description: 'Nombre de la rutina' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la rutina es requerido' })
  @MinLength(3, { message: 'El nombre de la rutina debe tener al menos 3 caracteres' })
  name: string;

  @ApiProperty({ example: 'Para ganancia muscular', description: 'Descripción de la rutina', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-06-27', description: 'Fecha de inicio de la rutina', required: false })
  @IsString()
  @IsOptional()
  startDate?: string;
}
