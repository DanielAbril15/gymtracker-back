import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Routine } from '../entities/routine.entity';
import { WorkoutLog } from '../entities/workout-log.entity';
import { CreateRoutineDto } from './dto/create-routine.dto';

@Injectable()
export class RoutinesService {
  constructor(
    private readonly moduleRef: ModuleRef,
  ) {}

  private get routineRepo(): Repository<Routine> {
    return this.moduleRef.get(getRepositoryToken(Routine), { strict: false });
  }

  private get workoutLogRepo(): Repository<WorkoutLog> {
    return this.moduleRef.get(getRepositoryToken(WorkoutLog), { strict: false });
  }

  async findAll(userId: string): Promise<any[]> {
    const routines = await this.routineRepo.find({
      where: { userId: Number(userId) },
      order: { startDate: 'DESC' },
    });

    const routinesWithSessions = await Promise.all(
      routines.map(async (r) => {
        const sessionCount = await this.workoutLogRepo.count({
          where: { routineId: r.id },
        });
        return {
          _id: r.id,
          name: r.name,
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
          sessionsCount: sessionCount,
        };
      }),
    );
    return routinesWithSessions;
  }

  async findActive(userId: string): Promise<any | null> {
    return this.routineRepo.findOne({
      where: { userId: Number(userId), status: 'active' },
    });
  }

  async create(userId: string, dto: CreateRoutineDto): Promise<any> {
    const uId = Number(userId);

    // Complete previous active routine
    await this.routineRepo.update(
      { userId: uId, status: 'active' },
      { status: 'completed', endDate: new Date().toISOString().split('T')[0] },
    );

    // Create new active routine
    const newRoutine = this.routineRepo.create({
      userId: uId,
      name: dto.name,
      description: dto.description || null,
      startDate: dto.startDate || new Date().toISOString().split('T')[0],
      endDate: null as any,
      status: 'active',
    });

    return this.routineRepo.save(newRoutine);
  }

  async pause(userId: string, routineId: string): Promise<any> {
    const routine = await this.routineRepo.findOne({
      where: { id: Number(routineId), userId: Number(userId) },
    });

    if (!routine) {
      throw new NotFoundException('Rutina no encontrada');
    }

    routine.status = 'paused';
    return this.routineRepo.save(routine);
  }

  async resume(userId: string, routineId: string): Promise<any> {
    const uId = Number(userId);
    const routine = await this.routineRepo.findOne({
      where: { id: Number(routineId), userId: uId },
    });

    if (!routine) {
      throw new NotFoundException('Rutina no encontrada');
    }

    // Complete previous active routine
    await this.routineRepo.update(
      { userId: uId, status: 'active' },
      { status: 'completed', endDate: new Date().toISOString().split('T')[0] },
    );

    routine.status = 'active';
    return this.routineRepo.save(routine);
  }

  async complete(userId: string, routineId: string): Promise<any> {
    const routine = await this.routineRepo.findOne({
      where: { id: Number(routineId), userId: Number(userId) },
    });

    if (!routine) {
      throw new NotFoundException('Rutina no encontrada');
    }

    routine.status = 'completed';
    routine.endDate = new Date().toISOString().split('T')[0];
    return this.routineRepo.save(routine);
  }

  async delete(userId: string, routineId: string): Promise<void> {
    await this.routineRepo.delete({ id: Number(routineId), userId: Number(userId) });
  }

  async getRoutineDetail(userId: string, routineId: string): Promise<any> {
    const routine = await this.routineRepo.findOne({
      where: { id: Number(routineId), userId: Number(userId) },
    });

    if (!routine) {
      throw new NotFoundException('Rutina no encontrada');
    }

    const logs = await this.workoutLogRepo.find({
      where: { userId: routine.userId, routineId: routine.id },
      order: { date: 'DESC' },
      relations: ['exercises', 'exercises.exercise', 'exercises.sets'],
    });

    return {
      routine,
      logs,
    };
  }
}
