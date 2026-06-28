import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import * as express from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Export')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('excel')
  @ApiOperation({ summary: 'Exportar estadísticas de rendimiento en Excel optimizado para IA' })
  @ApiResponse({ status: 200, description: 'Archivo Excel (.xlsx) descargado correctamente' })
  @ApiResponse({ status: 404, description: 'Rutina no encontrada' })
  async exportExcel(
    @CurrentUser() user: User,
    @Res() res: express.Response,
  ) {
    const buffer = await this.exportService.generateExcel(user.id.toString(), null);
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="GymTracker_Rendimiento_${Date.now()}.xlsx"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Get('ai-prompt')
  @ApiOperation({ summary: 'Exportar prompt para IA en formato TXT' })
  @ApiResponse({ status: 200, description: 'Archivo TXT descargado correctamente' })
  @ApiResponse({ status: 404, description: 'Rutina no encontrada' })
  async exportAIPrompt(
    @CurrentUser() user: User,
    @Res() res: express.Response,
  ) {
    const buffer = await this.exportService.generateAIPromptTXT(user.id.toString());
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="GymTracker_AIPrompt_${Date.now()}.txt"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
