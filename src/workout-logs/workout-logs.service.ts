import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { WorkoutLog } from '../entities/workout-log.entity';
import { Routine } from '../entities/routine.entity';
import { LoggedExercise } from '../entities/logged-exercise.entity';
import { WorkoutSet } from '../entities/workout-set.entity';
import { Exercise } from '../entities/exercise.entity';
import { SaveSetDto } from './dto/save-set.dto';

@Injectable()
export class WorkoutLogsService {
  constructor(
    private readonly moduleRef: ModuleRef,
  ) {}

  private get workoutLogRepo(): Repository<WorkoutLog> {
    return this.moduleRef.get(getRepositoryToken(WorkoutLog), { strict: false });
  }

  private get routineRepo(): Repository<Routine> {
    return this.moduleRef.get(getRepositoryToken(Routine), { strict: false });
  }

  private get loggedExerciseRepo(): Repository<LoggedExercise> {
    return this.moduleRef.get(getRepositoryToken(LoggedExercise), { strict: false });
  }

  private get workoutSetRepo(): Repository<WorkoutSet> {
    return this.moduleRef.get(getRepositoryToken(WorkoutSet), { strict: false });
  }

  async findOrCreateLog(userId: string, date: string): Promise<any> {
    const uId = Number(userId);
    let log = await this.workoutLogRepo.findOne({
      where: { userId: uId, date },
      relations: ['exercises', 'exercises.sets'],
    });

    if (!log) {
      const activeRoutine = await this.routineRepo.findOne({
        where: { userId: uId, status: 'active' },
      });

      log = this.workoutLogRepo.create({
        userId: uId,
        routineId: activeRoutine ? activeRoutine.id : null,
        date,
        exercises: [],
        totalVolume: 0,
      });

      await this.workoutLogRepo.save(log);
    }

    return log;
  }

  async findPaginated(userId: string, page: number, limit: number): Promise<any> {
    const uId = Number(userId);
    const skip = (page - 1) * limit;

    const [logs, total] = await this.workoutLogRepo.findAndCount({
      where: { userId: uId },
      relations: ['exercises', 'exercises.exercise', 'exercises.sets'],
      order: { date: 'DESC' },
      skip,
      take: limit,
    });

    const mappedLogs = logs.map((log) => ({
      _id: log.id.toString(),
      date: log.date,
      user: log.userId.toString(),
      exercises: log.exercises.map((entry) => ({
        exercise: entry.exercise ? {
          _id: entry.exercise.id.toString(),
          name: entry.exercise.name,
          muscleGroup: entry.exercise.muscleGroup,
          svgUrl: entry.exercise.svgUrl,
        } : entry.exerciseId.toString(),
        sets: entry.sets.map((set) => ({
          reps: set.reps,
          weight: set.weight,
          rpe: set.rpe,
          volume: set.volume,
        })),
      })),
      totalVolume: log.totalVolume,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
    }));

    return {
      logs: mappedLogs,
      total,
      page,
      limit,
    };
  }

  async getDayLog(userId: string, date: string): Promise<any> {
    const uId = Number(userId);
    const log = await this.workoutLogRepo.findOne({
      where: { userId: uId, date },
      relations: ['exercises', 'exercises.exercise', 'exercises.sets'],
    });

    if (!log) {
      return {
        date,
        exercises: [],
        totalVolume: 0,
        routineId: null,
      };
    }

    // Map SQL structure to MongoDB-like structure for the frontend
    const logObj = {
      _id: log.id.toString(),
      userId: log.userId.toString(),
      routineId: log.routineId ? log.routineId.toString() : null,
      date: log.date,
      totalVolume: log.totalVolume,
      exercises: log.exercises.map((entry) => ({
        _id: entry.id.toString(),
        exercise: {
          _id: entry.exercise.id.toString(),
          name: entry.exercise.name,
          muscleGroup: entry.exercise.muscleGroup,
          svgUrl: entry.exercise.svgUrl,
        },
        sets: entry.sets.map((set) => ({
          _id: set.id.toString(),
          reps: set.reps,
          weight: set.weight,
          rpe: set.rpe,
          volume: set.volume,
          exceeded: false,
        })),
      })),
    };

    // Analyze Progression (PR)
    for (const entry of logObj.exercises) {
      if (!entry.exercise) continue;
      const exerciseIdVal = entry.exercise._id;

      const historicalLogs = await this.workoutLogRepo.find({
        where: {
          userId: uId,
          date: LessThan(date),
        },
        relations: ['exercises', 'exercises.sets'],
      });

      let maxHistoricalVolume = 0;
      for (const hLog of historicalLogs) {
        const hExercise = hLog.exercises.find((e) => e.exerciseId.toString() === exerciseIdVal.toString());
        if (hExercise && hExercise.sets) {
          for (const hSet of hExercise.sets) {
            if (hSet.volume > maxHistoricalVolume) {
              maxHistoricalVolume = hSet.volume;
            }
          }
        }
      }

      entry.sets = entry.sets.map((set: any) => ({
        ...set,
        exceeded: maxHistoricalVolume > 0 && set.volume > maxHistoricalVolume,
      }));
    }

    return logObj;
  }

  async addOrUpdateSet(userId: string, date: string, dto: SaveSetDto): Promise<any> {
    const log = await this.findOrCreateLog(userId, date);
    const exerciseId = Number(dto.exerciseId);

    let loggedEx = log.exercises.find((e: any) => e.exerciseId === exerciseId);

    if (!loggedEx) {
      loggedEx = this.loggedExerciseRepo.create({
        workoutLogId: log.id,
        exerciseId,
        sets: [],
      });
      log.exercises.push(loggedEx);
    }

    const volume = dto.reps * dto.weight;
    const wSet = this.workoutSetRepo.create({
      reps: dto.reps,
      weight: dto.weight,
      rpe: dto.rpe !== undefined ? dto.rpe : null,
      volume,
    });

    loggedEx.sets.push(wSet);

    let total = 0;
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        total += s.volume;
      }
    }
    log.totalVolume = total;

    await this.workoutLogRepo.save(log);
    return this.getDayLog(userId, date);
  }

  async deleteSet(userId: string, date: string, exerciseId: string, setIndex: number): Promise<any> {
    const log = await this.workoutLogRepo.findOne({
      where: { userId: Number(userId), date },
      relations: ['exercises', 'exercises.sets'],
    });

    if (!log) {
      throw new NotFoundException('Workout log not found');
    }

    const loggedExIndex = log.exercises.findIndex((e) => e.exerciseId === Number(exerciseId));
    if (loggedExIndex === -1) {
      throw new NotFoundException('Ejercicio no encontrado en esta sesión');
    }

    const loggedEx = log.exercises[loggedExIndex];
    if (setIndex < 0 || setIndex >= loggedEx.sets.length) {
      throw new NotFoundException('Serie no encontrada');
    }

    const set = loggedEx.sets[setIndex];
    loggedEx.sets.splice(setIndex, 1);
    await this.workoutSetRepo.delete(set.id);

    if (loggedEx.sets.length === 0) {
      log.exercises.splice(loggedExIndex, 1);
      await this.loggedExerciseRepo.delete(loggedEx.id);
    }

    let total = 0;
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        total += s.volume;
      }
    }
    log.totalVolume = total;

    await this.workoutLogRepo.save(log);
    return this.getDayLog(userId, date);
  }

  async deleteExercise(userId: string, date: string, exerciseId: string): Promise<any> {
    const log = await this.workoutLogRepo.findOne({
      where: { userId: Number(userId), date },
      relations: ['exercises', 'exercises.sets'],
    });

    if (!log) {
      throw new NotFoundException('Workout log not found');
    }

    const loggedEx = log.exercises.find((e) => e.exerciseId === Number(exerciseId));
    if (loggedEx) {
      await this.loggedExerciseRepo.delete(loggedEx.id);
    }

    log.exercises = log.exercises.filter((e) => e.exerciseId !== Number(exerciseId));

    let total = 0;
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        total += s.volume;
      }
    }
    log.totalVolume = total;

    await this.workoutLogRepo.save(log);
    return this.getDayLog(userId, date);
  }

  async getLastPerformedSets(userId: string, exerciseId: string): Promise<any | null> {
    const qb = this.workoutLogRepo.createQueryBuilder('log')
      .leftJoinAndSelect('log.exercises', 'exercises')
      .leftJoinAndSelect('exercises.sets', 'sets')
      .where('log.userId = :userId', { userId: Number(userId) })
      .andWhere('exercises.exerciseId = :exerciseId', { exerciseId: Number(exerciseId) })
      .orderBy('log.date', 'DESC');

    const lastLog = await qb.getOne();

    if (!lastLog) {
      return null;
    }

    const exEntry = lastLog.exercises.find((e) => e.exerciseId === Number(exerciseId));
    if (!exEntry || exEntry.sets.length === 0) {
      return null;
    }

    // Return the last (most recent) set as LastSetData
    const lastSet = exEntry.sets[exEntry.sets.length - 1];
    return {
      reps: lastSet.reps,
      weight: lastSet.weight,
      rpe: lastSet.rpe ?? undefined,
      isPR: false, // PR detection could be enhanced later
    };
  }

  async upsertLog(userId: string, date: string, exercises: any[]): Promise<any> {
    const log = await this.findOrCreateLog(userId, date);

    // Remove existing exercises associated with this workout log
    await this.loggedExerciseRepo.delete({ workoutLogId: log.id });

    log.exercises = [];

    for (const exEntry of exercises) {
      const exerciseVal = exEntry.exercise || exEntry.exerciseId;
      if (!exerciseVal) {
        continue; // Skip invalid entries defensively
      }
      
      const exerciseId = typeof exerciseVal === 'string'
        ? Number(exerciseVal)
        : Number(exerciseVal.id || exerciseVal._id);

      const loggedEx = this.loggedExerciseRepo.create({
        workoutLogId: log.id,
        exerciseId,
        sets: [],
      });

      for (const setDto of exEntry.sets) {
        const volume = setDto.reps * setDto.weight;
        const wSet = this.workoutSetRepo.create({
          reps: setDto.reps,
          weight: setDto.weight,
          rpe: setDto.rpe !== undefined && setDto.rpe !== null ? setDto.rpe : null,
          volume,
        });
        loggedEx.sets.push(wSet);
      }

      log.exercises.push(loggedEx);
    }

    let total = 0;
    for (const ex of log.exercises) {
      for (const s of ex.sets) {
        total += s.volume;
      }
    }
    log.totalVolume = total;

    await this.workoutLogRepo.save(log);
    return this.getDayLog(userId, date);
  }

  async getProgression(userId: string, exerciseId: string): Promise<any> {
    const uId = Number(userId);
    const exId = Number(exerciseId);

    const exercise = await this.moduleRef.get(getRepositoryToken(Exercise), { strict: false })
      .findOne({ where: { id: exId } });

    if (!exercise) {
      throw new NotFoundException('Ejercicio no encontrado');
    }

    const logs = await this.workoutLogRepo.find({
      where: { userId: uId },
      relations: ['exercises', 'exercises.sets'],
      order: { date: 'ASC' },
    });

    const history: any[] = [];
    for (const log of logs) {
      const exEntry = log.exercises.find(e => e.exerciseId === exId);
      if (exEntry && exEntry.sets.length > 0) {
        let maxWeight = 0;
        let totalVolume = 0;
        let best1RM = 0;

        for (const set of exEntry.sets) {
          totalVolume += set.volume;
          if (set.weight > maxWeight) {
            maxWeight = set.weight;
          }
          const rm1 = set.weight * (1 + set.reps / 30);
          if (rm1 > best1RM) {
            best1RM = rm1;
          }
        }

        history.push({
          date: log.date,
          maxWeight,
          totalVolume,
          estimatedRM: parseFloat(best1RM.toFixed(1)),
        });
      }
    }

    return {
      exerciseName: exercise.name,
      history,
    };
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.workoutLogRepo.delete({ id: Number(id), userId: Number(userId) });
  }
}
