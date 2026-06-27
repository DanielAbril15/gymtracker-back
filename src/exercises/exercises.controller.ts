import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Exercises')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener el catálogo completo de ejercicios' })
  @ApiQuery({ name: 'muscleGroup', required: false, description: 'Filtrar por grupo muscular' })
  @ApiResponse({ status: 200, description: 'Catálogo obtenido correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getExercises(@Query('muscleGroup') muscleGroup?: string) {
    if (muscleGroup && muscleGroup !== 'Todos') {
      return this.exercisesService.findByMuscleGroup(muscleGroup);
    }
    return this.exercisesService.findAll();
  }
}
