import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Routine, WorkoutLog } from '../entities';
import { RoutinesService } from './routines.service';
import { RoutinesController } from './routines.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Routine, WorkoutLog]),
  ],
  providers: [RoutinesService],
  controllers: [RoutinesController],
  exports: [RoutinesService],
})
export class RoutinesModule {}
