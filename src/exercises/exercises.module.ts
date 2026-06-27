import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Exercise,
  User,
  Routine,
  WorkoutLog,
  LoggedExercise,
  WorkoutSet,
} from '../entities';
import { ExercisesService } from './exercises.service';
import { ExercisesController } from './exercises.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Exercise,
      User,
      Routine,
      WorkoutLog,
      LoggedExercise,
      WorkoutSet,
    ]),
  ],
  providers: [ExercisesService, SeedService],
  controllers: [ExercisesController],
  exports: [ExercisesService],
})
export class ExercisesModule {}
