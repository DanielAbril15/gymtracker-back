import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Routines')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las rutinas del usuario logueado' })
  @ApiResponse({ status: 200, description: 'Rutinas del usuario obtenidas' })
  async getRoutines(@CurrentUser() user: User) {
    return this.routinesService.findAll(user.id.toString());
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener la rutina activa actualmente' })
  @ApiResponse({ status: 200, description: 'Rutina activa retornada' })
  async getActiveRoutine(@CurrentUser() user: User) {
    return this.routinesService.findActive(user.id.toString());
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva rutina' })
  @ApiResponse({ status: 201, description: 'Rutina creada exitosamente' })
  async createRoutine(
    @CurrentUser() user: User,
    @Body() dto: CreateRoutineDto,
  ) {
    return this.routinesService.create(user.id.toString(), dto);
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pausar una rutina' })
  @ApiResponse({ status: 200, description: 'Rutina pausada exitosamente' })
  async pauseRoutine(
    @CurrentUser() user: User,
    @Param('id') routineId: string,
  ) {
    return this.routinesService.pause(user.id.toString(), routineId);
  }

  @Patch(':id/resume')
  @ApiOperation({ summary: 'Reanudar una rutina' })
  @ApiResponse({ status: 200, description: 'Rutina reanudada exitosamente' })
  async resumeRoutine(
    @CurrentUser() user: User,
    @Param('id') routineId: string,
  ) {
    return this.routinesService.resume(user.id.toString(), routineId);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Completar una rutina' })
  @ApiResponse({ status: 200, description: 'Rutina completada exitosamente' })
  async completeRoutine(
    @CurrentUser() user: User,
    @Param('id') routineId: string,
  ) {
    return this.routinesService.complete(user.id.toString(), routineId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una rutina por ID' })
  @ApiResponse({ status: 200, description: 'Rutina eliminada exitosamente' })
  async deleteRoutine(
    @CurrentUser() user: User,
    @Param('id') routineId: string,
  ) {
    await this.routinesService.delete(user.id.toString(), routineId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una rutina' })
  @ApiResponse({ status: 200, description: 'Detalle de la rutina' })
  @ApiResponse({ status: 404, description: 'Rutina no encontrada' })
  async getRoutineDetail(
    @CurrentUser() user: User,
    @Param('id') routineId: string,
  ) {
    return this.routinesService.getRoutineDetail(user.id.toString(), routineId);
  }

  @Put(':id/schedule')
  @ApiOperation({ summary: 'Actualizar la configuración de días y ejercicios de una rutina' })
  @ApiResponse({ status: 200, description: 'Horario actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Rutina no encontrada' })
  async updateSchedule(
    @CurrentUser() user: User,
    @Param('id') routineId: string,
    @Body('schedule') schedule: any,
  ) {
    return this.routinesService.updateSchedule(user.id.toString(), routineId, schedule);
  }
}
