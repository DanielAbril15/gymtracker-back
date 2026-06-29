import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CoachService } from './coach.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Coach')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('coach')
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  @Get('advice')
  @ApiOperation({ summary: 'Obtener consejos basados en los registros de entrenamiento' })
  @ApiResponse({ status: 200, description: 'Consejos generados correctamente' })
  async getAdvice(@CurrentUser() user: User) {
    return this.coachService.getAdvice(user.id.toString());
  }

  @Post('generate-season')
  @ApiOperation({ summary: 'Generar una temporada de entrenamiento basada en reglas' })
  @ApiResponse({ status: 201, description: 'Temporada generada correctamente' })
  async generateSeason(@CurrentUser() user: User, @Body() config: { daysPerWeek: number; goal: string; gender: string; experienceLevel: string; splitPreference: string; useCalisthenics?: boolean }) {
    return this.coachService.generateSeason(user.id.toString(), config);
  }

  @Post('advance-mesocycle')
  @ApiOperation({ summary: 'Avanzar al siguiente mesociclo' })
  async advanceMesocycle(@CurrentUser() user: User, @Body() config: { splitPreference: string; useCalisthenics?: boolean }) {
    return this.coachService.advanceMesocycle(user.id.toString(), config);
  }

  @Get('season/current')
  @ApiOperation({ summary: 'Obtener la temporada activa del usuario' })
  async getCurrentSeason(@CurrentUser() user: User) {
    return this.coachService.getCurrentSeason(user.id.toString());
  }
}
