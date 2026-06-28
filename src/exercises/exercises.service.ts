import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exercise } from '../entities/exercise.entity';

@Injectable()
export class ExercisesService {
  constructor(
    private readonly moduleRef: ModuleRef,
  ) {}

  private get exerciseRepo(): Repository<Exercise> {
    return this.moduleRef.get(getRepositoryToken(Exercise), { strict: false });
  }

  private mapExercise(ex: Exercise): any {
    return {
      _id: ex.id.toString(),
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      svgUrl: ex.svgUrl,
    };
  }

  async findAll(): Promise<any[]> {
    const exercises = await this.exerciseRepo.find({ order: { name: 'ASC' } });
    return exercises.map(ex => this.mapExercise(ex));
  }

  async findByMuscleGroup(group: string): Promise<any[]> {
    const exercises = await this.exerciseRepo.find({ where: { muscleGroup: group }, order: { name: 'ASC' } });
    return exercises.map(ex => this.mapExercise(ex));
  }
}
