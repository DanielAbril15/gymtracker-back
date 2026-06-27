import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  @ApiOperation({ summary: 'Root endpoint redirecting to docs' })
  getRoot() {
    return { message: 'GymTracker API is running. Go to /api/docs for documentation.' };
  }
}
