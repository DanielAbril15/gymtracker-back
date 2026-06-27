import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkoutLog } from '../entities/workout-log.entity';

@Injectable()
export class DashboardService {
  constructor(
    private readonly moduleRef: ModuleRef,
  ) {}

  private get workoutLogRepo(): Repository<WorkoutLog> {
    return this.moduleRef.get(getRepositoryToken(WorkoutLog), { strict: false });
  }

  async getStats(userId: string, todayStr: string): Promise<any> {
    const uId = Number(userId);

    // 1. "Hoy" Card Summary
    const todayLog = await this.workoutLogRepo.findOne({
      where: { userId: uId, date: todayStr },
      relations: ['exercises'],
    });

    const todaySummary = {
      hasLog: !!todayLog,
      exercisesCount: todayLog ? todayLog.exercises.length : 0,
      totalVolume: todayLog ? todayLog.totalVolume : 0,
    };

    // 2. "Racha" (Streak) calculation
    // Get all logs of the user with exercises relations to filter
    const logs = await this.workoutLogRepo.find({
      where: { userId: uId },
      relations: ['exercises'],
      order: { date: 'DESC' },
    });

    const logsWithExercises = logs.filter((l) => l.exercises.length > 0);

    let streak = 0;
    if (logsWithExercises.length > 0) {
      const dates = logsWithExercises.map((l) => l.date);
      const uniqueDates = Array.from(new Set(dates));
      
      const today = new Date(todayStr);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let currentExpected = uniqueDates[0];
      if (currentExpected === todayStr || currentExpected === yesterdayStr) {
        streak = 1;
        const expectedDate = new Date(currentExpected);
        
        for (let i = 1; i < uniqueDates.length; i++) {
          expectedDate.setDate(expectedDate.getDate() - 1);
          const expectedStr = expectedDate.toISOString().split('T')[0];
          
          if (uniqueDates[i] === expectedStr) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    // 3. "Volumen semanal": Last 7 sessions
    const last7Logs = logsWithExercises.slice(0, 7);

    const weeklyVolume = last7Logs.reverse().map((l) => {
      const dateParts = l.date.split('-');
      const shortDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : l.date;
      return {
        date: l.date,
        label: shortDate,
        totalVolume: l.totalVolume,
      };
    });

    // 4. "Récords personales" (PRs)
    const allUserLogs = await this.workoutLogRepo.find({
      where: { userId: uId },
      relations: ['exercises', 'exercises.exercise', 'exercises.sets'],
    });

    const recordsMap: Record<string, { weight: number; reps: number; exerciseName: string; muscleGroup: string; date: string }> = {};

    for (const log of allUserLogs) {
      for (const exEntry of log.exercises) {
        if (!exEntry.exercise) continue;
        const ex = exEntry.exercise;
        
        for (const set of exEntry.sets) {
          const key = ex.name;
          const currentRecord = recordsMap[key];
          
          if (!currentRecord || set.weight > currentRecord.weight) {
            recordsMap[key] = {
              weight: set.weight,
              reps: set.reps,
              exerciseName: ex.name,
              muscleGroup: ex.muscleGroup,
              date: log.date,
            };
          }
        }
      }
    }

    const personalRecords = Object.values(recordsMap)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);

    return {
      today: todaySummary,
      streak,
      weeklyVolume,
      personalRecords,
    };
  }
}
