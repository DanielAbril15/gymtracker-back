import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { WorkoutLogsService } from './workout-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { SaveSetDto } from './dto/save-set.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Workout Logs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workout-logs')
export class WorkoutLogsController {
  constructor(private readonly workoutLogsService: WorkoutLogsService) {}

  @Get('date/:date')
  @ApiOperation({ summary: 'Obtener el log de entrenamiento de un día específico' })
  @ApiResponse({ status: 200, description: 'Log obtenido correctamente' })
  async getDayLog(
    @CurrentUser() user: User,
    @Param('date') date: string,
  ) {
    return this.workoutLogsService.getDayLog(user.id.toString(), date);
  }

  @Post('day/:date/set')
  @ApiOperation({ summary: 'Registrar una serie en un ejercicio para un día específico' })
  @ApiResponse({ status: 200, description: 'Serie registrada y log retornado' })
  async saveSet(
    @CurrentUser() user: User,
    @Param('date') date: string,
    @Body() dto: SaveSetDto,
  ) {
    return this.workoutLogsService.addOrUpdateSet(user.id.toString(), date, dto);
  }

  @Delete('day/:date/exercise/:exerciseId')
  @ApiOperation({ summary: 'Eliminar un ejercicio completo de un día' })
  @ApiResponse({ status: 200, description: 'Ejercicio eliminado correctamente' })
  async deleteExercise(
    @CurrentUser() user: User,
    @Param('date') date: string,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.workoutLogsService.deleteExercise(user.id.toString(), date, exerciseId);
  }

  @Delete('day/:date/exercise/:exerciseId/set/:setIndex')
  @ApiOperation({ summary: 'Eliminar una serie específica de un ejercicio' })
  @ApiResponse({ status: 200, description: 'Serie eliminada' })
  async deleteSet(
    @CurrentUser() user: User,
    @Param('date') date: string,
    @Param('exerciseId') exerciseId: string,
    @Param('setIndex', ParseIntPipe) setIndex: number,
  ) {
    return this.workoutLogsService.deleteSet(user.id.toString(), date, exerciseId, setIndex);
  }

  @Get('last-set/:exerciseId')
  @ApiOperation({ summary: 'Obtener el historial de las últimas series de un ejercicio para autocompletar' })
  @ApiResponse({ status: 200, description: 'Series encontradas para autocompletar' })
  async getLastPerformed(
    @CurrentUser() user: User,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.workoutLogsService.getLastPerformedSets(user.id.toString(), exerciseId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear o actualizar la bitácora de entrenamiento completa' })
  @ApiResponse({ status: 201, description: 'Bitácora guardada exitosamente' })
  async upsertLog(
    @CurrentUser() user: User,
    @Body() body: { date: string; exercises: any[] },
  ) {
    return this.workoutLogsService.upsertLog(user.id.toString(), body.date, body.exercises);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una bitácora por ID' })
  @ApiResponse({ status: 200, description: 'Bitácora eliminada con éxito' })
  async deleteLog(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    await this.workoutLogsService.delete(user.id.toString(), id);
  }

  @Get('progression/:exerciseId')
  @ApiOperation({ summary: 'Obtener historial de progreso de un ejercicio para gráficas' })
  @ApiResponse({ status: 200, description: 'Progreso retornado' })
  async getProgression(
    @CurrentUser() user: User,
    @Param('exerciseId') exerciseId: string,
  ) {
    return this.workoutLogsService.getProgression(user.id.toString(), exerciseId);
  }
}
