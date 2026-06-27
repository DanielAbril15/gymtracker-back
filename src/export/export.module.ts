import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Routine,
  WorkoutLog,
  Exercise,
  User,
  LoggedExercise,
  WorkoutSet,
} from '../entities';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Routine,
      WorkoutLog,
      Exercise,
      User,
      LoggedExercise,
      WorkoutSet,
    ]),
  ],
  providers: [ExportService],
  controllers: [ExportController],
  exports: [ExportService],
})
export class ExportModule {}
