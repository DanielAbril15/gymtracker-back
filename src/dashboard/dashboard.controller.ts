import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener las estadísticas del dashboard' })
  @ApiQuery({ name: 'today', required: false, description: 'Fecha de hoy del usuario en formato YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Estadísticas calculadas correctamente' })
  async getDashboardStats(
    @CurrentUser() user: User,
    @Query('today') today?: string,
  ) {
    const todayStr = today || new Date().toISOString().split('T')[0];
    return this.dashboardService.getStats(user.id.toString(), todayStr);
  }
}
