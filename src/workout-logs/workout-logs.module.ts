import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WorkoutLog,
  Routine,
  LoggedExercise,
  WorkoutSet,
} from '../entities';
import { WorkoutLogsService } from './workout-logs.service';
import { WorkoutLogsController } from './workout-logs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkoutLog, Routine, LoggedExercise, WorkoutSet]),
  ],
  providers: [WorkoutLogsService],
  controllers: [WorkoutLogsController],
  exports: [WorkoutLogsService],
})
export class WorkoutLogsModule {}
