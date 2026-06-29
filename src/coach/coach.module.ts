import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';
import { User, Season, Macrocycle, Routine, WorkoutLog, Exercise } from '../entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, Season, Macrocycle, Routine, WorkoutLog, Exercise])],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
