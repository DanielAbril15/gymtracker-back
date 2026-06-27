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

  async findAll(): Promise<any[]> {
    return this.exerciseRepo.find({ order: { name: 'ASC' } });
  }

  async findByMuscleGroup(group: string): Promise<any[]> {
    return this.exerciseRepo.find({ where: { muscleGroup: group }, order: { name: 'ASC' } });
  }
}
