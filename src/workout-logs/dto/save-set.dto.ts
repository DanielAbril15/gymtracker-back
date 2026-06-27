import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveSetDto {
  @ApiProperty({ example: '60c72b2f9b1d8b2bad000001', description: 'ID del ejercicio' })
  @IsString()
  @IsNotEmpty({ message: 'El ID del ejercicio es requerido' })
  exerciseId: string;

  @ApiProperty({ example: 10, description: 'Número de repeticiones' })
  @IsInt({ message: 'Las repeticiones deben ser un número entero' })
  @Min(1, { message: 'Debe haber al menos 1 repetición' })
  reps: number;

  @ApiProperty({ example: 80, description: 'Peso utilizado en kg' })
  @IsNumber({}, { message: 'El peso debe ser un número decimal o entero' })
  @Min(0, { message: 'El peso no puede ser negativo' })
  weight: number;

  @ApiProperty({ example: 8, description: 'Índice RPE (1-10)', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpe?: number;
}
