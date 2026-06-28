import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Exercise,
  User,
  Routine,
  WorkoutLog,
  LoggedExercise,
  WorkoutSet,
} from '../entities';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly moduleRef: ModuleRef,
  ) {}

  private get exerciseRepo(): Repository<Exercise> {
    return this.moduleRef.get(getRepositoryToken(Exercise), { strict: false });
  }

  private get userRepo(): Repository<User> {
    return this.moduleRef.get(getRepositoryToken(User), { strict: false });
  }

  private get routineRepo(): Repository<Routine> {
    return this.moduleRef.get(getRepositoryToken(Routine), { strict: false });
  }

  private get workoutLogRepo(): Repository<WorkoutLog> {
    return this.moduleRef.get(getRepositoryToken(WorkoutLog), { strict: false });
  }

  async onApplicationBootstrap() {
    await this.seed();
  }

  async seed() {
    this.logger.log('Checking if database needs seeding...');

    const exerciseCount = await this.exerciseRepo.count();
    if (exerciseCount > 0) {
      this.logger.log('Database already seeded. Skipping.');
      return;
    }

    this.logger.log('Database is empty. Seeding catalog exercises...');

    const exercisesSeedData = [
      { name: 'Press de Banca',      muscleGroup: 'Pecho',    svgUrl: '/assets/exercises/bench-press.svg' },
      { name: 'Press Inclinado',     muscleGroup: 'Pecho',    svgUrl: '/assets/exercises/incline-press.svg' },
      { name: 'Dominadas',           muscleGroup: 'Espalda',  svgUrl: '/assets/exercises/pull-ups.svg' },
      { name: 'Peso Muerto',         muscleGroup: 'Espalda',  svgUrl: '/assets/exercises/deadlift.svg' },
      { name: 'Sentadilla',          muscleGroup: 'Piernas',  svgUrl: '/assets/exercises/squat.svg' },
      { name: 'Zancadas',            muscleGroup: 'Piernas',  svgUrl: '/assets/exercises/lunges.svg' },
      { name: 'Press Militar',       muscleGroup: 'Hombros',  svgUrl: '/assets/exercises/ohp.svg' },
      { name: 'Elevaciones Laterales', muscleGroup: 'Hombros', svgUrl: '/assets/exercises/lateral-raises.svg' },
      { name: 'Curl Bíceps',         muscleGroup: 'Brazos',   svgUrl: '/assets/exercises/bicep-curl.svg' },
      { name: 'Fondos Tríceps',      muscleGroup: 'Brazos',   svgUrl: '/assets/exercises/dips.svg' },
      { name: 'Plancha',             muscleGroup: 'Core',     svgUrl: '/assets/exercises/plank.svg' },
      { name: 'Crunches',            muscleGroup: 'Core',     svgUrl: '/assets/exercises/crunches.svg' },
      { name: 'Correr en Cinta',     muscleGroup: 'Cardio',   svgUrl: '/assets/exercises/treadmill.svg' },
    ];

    const insertedExercises = await this.exerciseRepo.save(
      this.exerciseRepo.create(exercisesSeedData)
    );
    this.logger.log(`Seeded ${insertedExercises.length} catalog exercises.`);

    this.logger.log('Seeding demo user...');
    const hashed = await bcrypt.hash('Demo1234!', 12);
    const demoUser = this.userRepo.create({
      email: 'demo@gymtracker.com',
      passwordHash: hashed,
      name: 'Demo Athlete',
    });
    const savedUser = await this.userRepo.save(demoUser);
    this.logger.log(`Seeded user: ${savedUser.email}`);

    this.logger.log('Seeding active routine...');
    const demoRoutine = this.routineRepo.create({
      userId: savedUser.id,
      name: 'Rutina de Fuerza e Hipertrofia',
      startDate: '2026-05-15',
      endDate: null,
      status: 'active',
    });
    const savedRoutine = await this.routineRepo.save(demoRoutine);
    this.logger.log(`Seeded active routine: ${savedRoutine.name}`);

    this.logger.log('Seeding 2 weeks of historical logs...');
    const getExerciseId = (name: string) => {
      const ex = insertedExercises.find((e) => e.name === name);
      if (!ex) throw new Error(`Exercise ${name} not found during seeding!`);
      return ex.id;
    };

    const exBanca = getExerciseId('Press de Banca');
    const exInclinado = getExerciseId('Press Inclinado');
    const exMilitar = getExerciseId('Press Militar');
    const exDominadas = getExerciseId('Dominadas');
    const exPesoMuerto = getExerciseId('Peso Muerto');
    const exCurlBiceps = getExerciseId('Curl Bíceps');
    const exSentadilla = getExerciseId('Sentadilla');
    const exPlancha = getExerciseId('Plancha');
    const exZancadas = getExerciseId('Zancadas');

    const historicalLogsSeed = [
      {
        date: '2026-05-15',
        exercises: [
          { exerciseId: exBanca, sets: [ { reps: 10, weight: 60, rpe: 7, volume: 600 }, { reps: 10, weight: 70, rpe: 8, volume: 700 }, { reps: 8, weight: 80, rpe: 9, volume: 640 } ] },
          { exerciseId: exInclinado, sets: [ { reps: 10, weight: 50, rpe: 8, volume: 500 }, { reps: 8, weight: 60, rpe: 9, volume: 480 } ] },
          { exerciseId: exMilitar, sets: [ { reps: 10, weight: 40, rpe: 8, volume: 400 }, { reps: 8, weight: 45, rpe: 9, volume: 360 } ] }
        ],
        totalVolume: 600 + 700 + 640 + 500 + 480 + 400 + 360,
      },
      {
        date: '2026-05-17',
        exercises: [
          { exerciseId: exDominadas, sets: [ { reps: 8, weight: 0, rpe: 8, volume: 0 }, { reps: 8, weight: 0, rpe: 8, volume: 0 }, { reps: 6, weight: 0, rpe: 9, volume: 0 } ] },
          { exerciseId: exPesoMuerto, sets: [ { reps: 8, weight: 100, rpe: 7, volume: 800 }, { reps: 8, weight: 110, rpe: 8, volume: 880 }, { reps: 6, weight: 120, rpe: 9, volume: 720 } ] },
          { exerciseId: exCurlBiceps, sets: [ { reps: 12, weight: 12, rpe: 8, volume: 144 }, { reps: 10, weight: 14, rpe: 9, volume: 140 } ] }
        ],
        totalVolume: 800 + 880 + 720 + 144 + 140,
      },
      {
        date: '2026-05-19',
        exercises: [
          { exerciseId: exSentadilla, sets: [ { reps: 10, weight: 80, rpe: 7, volume: 800 }, { reps: 10, weight: 90, rpe: 8, volume: 900 }, { reps: 8, weight: 100, rpe: 9, volume: 800 } ] },
          { exerciseId: exZancadas, sets: [ { reps: 12, weight: 16, rpe: 8, volume: 192 }, { reps: 10, weight: 20, rpe: 9, volume: 200 } ] },
          { exerciseId: exPlancha, sets: [ { reps: 1, weight: 0, rpe: 7, volume: 0 }, { reps: 1, weight: 0, rpe: 8, volume: 0 } ] }
        ],
        totalVolume: 800 + 900 + 800 + 192 + 200,
      },
      {
        date: '2026-05-22',
        exercises: [
          { exerciseId: exBanca, sets: [ { reps: 10, weight: 65, rpe: 7, volume: 650 }, { reps: 10, weight: 75, rpe: 8, volume: 750 }, { reps: 8, weight: 85, rpe: 9, volume: 680 } ] },
          { exerciseId: exInclinado, sets: [ { reps: 10, weight: 55, rpe: 8, volume: 550 }, { reps: 8, weight: 65, rpe: 9, volume: 520 } ] },
          { exerciseId: exMilitar, sets: [ { reps: 10, weight: 42, rpe: 8, volume: 420 }, { reps: 8, weight: 47, rpe: 9, volume: 376 } ] }
        ],
        totalVolume: 650 + 750 + 680 + 550 + 520 + 420 + 376,
      },
      {
        date: '2026-05-24',
        exercises: [
          { exerciseId: exDominadas, sets: [ { reps: 10, weight: 0, rpe: 8, volume: 0 }, { reps: 8, weight: 0, rpe: 8, volume: 0 }, { reps: 7, weight: 0, rpe: 9, volume: 0 } ] },
          { exerciseId: exPesoMuerto, sets: [ { reps: 8, weight: 105, rpe: 7, volume: 840 }, { reps: 8, weight: 115, rpe: 8, volume: 920 }, { reps: 6, weight: 125, rpe: 9, volume: 750 } ] },
          { exerciseId: exCurlBiceps, sets: [ { reps: 12, weight: 14, rpe: 8, volume: 168 }, { reps: 10, weight: 16, rpe: 9, volume: 160 } ] }
        ],
        totalVolume: 840 + 920 + 750 + 168 + 160,
      },
      {
        date: '2026-05-26',
        exercises: [
          { exerciseId: exSentadilla, sets: [ { reps: 10, weight: 85, rpe: 7, volume: 850 }, { reps: 10, weight: 95, rpe: 8, volume: 950 }, { reps: 8, weight: 105, rpe: 9, volume: 840 } ] },
          { exerciseId: exZancadas, sets: [ { reps: 12, weight: 18, rpe: 8, volume: 216 }, { reps: 10, weight: 22, rpe: 9, volume: 220 } ] },
          { exerciseId: exPlancha, sets: [ { reps: 1, weight: 0, rpe: 7, volume: 0 }, { reps: 1, weight: 0, rpe: 8, volume: 0 } ] }
        ],
        totalVolume: 850 + 950 + 840 + 216 + 220,
      },
    ];

    const historicalLogs = historicalLogsSeed.map((log) => {
      return this.workoutLogRepo.create({
        userId: savedUser.id,
        routineId: savedRoutine.id,
        date: log.date,
        totalVolume: log.totalVolume,
        exercises: log.exercises.map((ex) => {
          const loggedEx = new LoggedExercise();
          loggedEx.exerciseId = ex.exerciseId;
          loggedEx.sets = ex.sets.map((set) => {
            const wSet = new WorkoutSet();
            wSet.reps = set.reps;
            wSet.weight = set.weight;
            wSet.rpe = set.rpe;
            wSet.volume = set.volume;
            return wSet;
          });
          return loggedEx;
        }),
      });
    });

    await this.workoutLogRepo.save(historicalLogs);
    this.logger.log(`Successfully seeded historical logs.`);
    this.logger.log('Seeding completed successfully!');
  }
}
