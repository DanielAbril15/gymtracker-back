import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Season, Macrocycle, Routine, WorkoutLog, Exercise } from '../entities';

@Injectable()
export class CoachService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Season) private seasonRepo: Repository<Season>,
    @InjectRepository(Macrocycle) private macrocycleRepo: Repository<Macrocycle>,
    @InjectRepository(Routine) private routineRepo: Repository<Routine>,
    @InjectRepository(WorkoutLog) private workoutLogRepo: Repository<WorkoutLog>,
    @InjectRepository(Exercise) private exerciseRepo: Repository<Exercise>,
  ) {}

  async getCurrentSeason(userId: string): Promise<any> {
    const uId = Number(userId);
    const season = await this.seasonRepo.findOne({
      where: { userId: uId },
      order: { id: 'DESC' },
      relations: ['macrocycles', 'macrocycles.routines'],
    });

    if (!season) return null;

    // Filter to find the active macrocycle and routine for easier frontend consumption
    const activeMacrocycle = season.macrocycles.find(m => {
      const now = new Date().toISOString().split('T')[0];
      return (!m.endDate || m.endDate >= now) && (!m.startDate || m.startDate <= now);
    }) || season.macrocycles[0];

    const activeRoutine = activeMacrocycle?.routines.find(r => r.status === 'active') || null;

    let nextDayIndex = 0;

    if (activeRoutine && activeRoutine.schedule && Array.isArray(activeRoutine.schedule)) {
      // Calculate how many unique days (dates) the user has logged for this routine
      const logs = await this.workoutLogRepo
        .createQueryBuilder('log')
        .select('DISTINCT(log.date)', 'date')
        .where('log.routineId = :routineId', { routineId: activeRoutine.id })
        .getRawMany();

      const uniqueDaysTrained = logs.length;
      nextDayIndex = uniqueDaysTrained % activeRoutine.schedule.length;
    }

    return {
      season,
      activeMacrocycle,
      activeRoutine,
      nextDayIndex,
    };
  }

  async getAdvice(userId: string): Promise<any[]> {
    const uId = Number(userId);
    const advice: any[] = [];

    // Find active routine
    const activeRoutine = await this.routineRepo.findOne({
      where: { userId: uId, status: 'active' },
    });

    if (!activeRoutine) {
      advice.push({
        type: 'info',
        title: 'Sin Rutina Activa',
        message: 'No tienes una rutina activa. Genera una temporada para empezar.',
      });
      return advice;
    }

    // Rule 1: Deload check (if routine is > 6 weeks old)
    if (activeRoutine.startDate) {
      const start = new Date(activeRoutine.startDate).getTime();
      const now = new Date().getTime();
      const diffWeeks = (now - start) / (1000 * 60 * 60 * 24 * 7);
      
      if (diffWeeks >= 6) {
        advice.push({
          type: 'warning',
          title: 'Considera un Deload',
          message: 'Tu rutina activa lleva más de 6 semanas. Para reducir la fatiga acumulada, considera hacer una semana de descarga (reduciendo volumen un 40-50%) antes de empezar el siguiente mesociclo.',
        });
      }
    }

    // Fetch logs from the last 14 days to check volume and progression
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const logs = await this.workoutLogRepo.find({
      where: { userId: uId, routineId: activeRoutine.id },
      relations: ['exercises', 'exercises.exercise', 'exercises.sets'],
      order: { date: 'DESC' },
    });

    const recentLogs = logs.filter(l => new Date(l.date) >= twoWeeksAgo);

    // Rule 2: Volume Check (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyLogs = logs.filter(l => new Date(l.date) >= oneWeekAgo);
    
    const volumePerGroup: Record<string, number> = {};
    weeklyLogs.forEach(log => {
      log.exercises.forEach(ex => {
        if (ex.exercise) {
          const group = ex.exercise.muscleGroup;
          volumePerGroup[group] = (volumePerGroup[group] || 0) + ex.sets.length;
        }
      });
    });

    let lowVolumeGroups: string[] = [];
    let highVolumeGroups: string[] = [];
    Object.keys(volumePerGroup).forEach(group => {
      if (volumePerGroup[group] < 8) lowVolumeGroups.push(group);
      if (volumePerGroup[group] > 22) highVolumeGroups.push(group);
    });

    if (lowVolumeGroups.length > 0) {
      advice.push({
        type: 'info',
        title: 'Volumen Bajo Detectado',
        message: `Tus series semanales para: ${lowVolumeGroups.join(', ')} están por debajo del rango sugerido (10-20). Considera añadir 1-2 series más si tu objetivo es maximizar hipertrofia.`,
      });
    }
    if (highVolumeGroups.length > 0) {
      advice.push({
        type: 'warning',
        title: 'Posible Sobreentrenamiento',
        message: `Tus series semanales para: ${highVolumeGroups.join(', ')} superan el límite superior (20+ series). Si sientes dolor persistente o estancamiento, reduce el volumen.`,
      });
    }

    if (advice.length === 0) {
      advice.push({
        type: 'success',
        title: 'Todo en Orden',
        message: 'Tu volumen semanal está balanceado y no detectamos acumulación excesiva de fatiga. ¡Sigue así!',
      });
    }

    return advice;
  }

  async generateSeason(userId: string, dto: { daysPerWeek: number; goal: string; gender: string; experienceLevel: string; splitPreference: string; useCalisthenics?: boolean }): Promise<any> {
    const uId = Number(userId);

    // Update user profile
    await this.userRepo.update(uId, {
      gender: dto.gender,
      experienceLevel: dto.experienceLevel,
    });

    // 1. Create Season
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);
    
    const season = this.seasonRepo.create({
      userId: uId,
      name: `Temporada ${today.getFullYear()}-${today.getFullYear() + 1}`,
      startDate: today.toISOString().split('T')[0],
      endDate: nextYear.toISOString().split('T')[0],
    });
    await this.seasonRepo.save(season);

    // 2. Create Macrocycles (3 macros of 4 months each)
    const m1End = new Date(today); m1End.setMonth(today.getMonth() + 4);
    const m2End = new Date(m1End); m2End.setMonth(m1End.getMonth() + 4);

    const macro1 = this.macrocycleRepo.create({
      seasonId: season.id,
      name: 'Macrociclo 1 (Hipertrofia Base)',
      goal: 'hypertrophy',
      startDate: today.toISOString().split('T')[0],
      endDate: m1End.toISOString().split('T')[0],
    });
    await this.macrocycleRepo.save(macro1);

    const macro2 = this.macrocycleRepo.create({
      seasonId: season.id,
      name: 'Macrociclo 2 (Fuerza e Hipertrofia)',
      goal: 'hypertrophy',
      startDate: m1End.toISOString().split('T')[0],
      endDate: m2End.toISOString().split('T')[0],
    });
    await this.macrocycleRepo.save(macro2);

    const macro3 = this.macrocycleRepo.create({
      seasonId: season.id,
      name: 'Macrociclo 3 (Recomposición/Mantenimiento)',
      goal: 'recomposition',
      startDate: m2End.toISOString().split('T')[0],
      endDate: nextYear.toISOString().split('T')[0],
    });
    await this.macrocycleRepo.save(macro3);

    // 3. Generate first Routine (Mesocycle)
    const routineEnd = new Date(today);
    routineEnd.setDate(today.getDate() + 42); // 6 weeks
    const schedule = await this.generateSchedule(dto.splitPreference, dto.useCalisthenics || false);

    const routine = this.routineRepo.create({
      userId: uId,
      macrocycleId: macro1.id,
      name: `Mesociclo 1 - ${dto.splitPreference}`,
      description: `Generado para nivel ${dto.experienceLevel}, objetivo: ${dto.goal}`,
      startDate: today.toISOString().split('T')[0],
      endDate: routineEnd.toISOString().split('T')[0],
      status: 'active',
      schedule: schedule,
    });
    await this.routineRepo.save(routine);

    return { season, macrocycles: [macro1, macro2, macro3], activeRoutine: routine };
  }

  async advanceMesocycle(userId: string, dto: { splitPreference: string; useCalisthenics?: boolean }): Promise<any> {
    const uId = Number(userId);

    // 1. Get current season and active routine
    const current = await this.getCurrentSeason(userId);
    if (!current || !current.activeRoutine || !current.activeMacrocycle) {
      throw new NotFoundException('No hay una temporada o rutina activa para avanzar.');
    }

    const { season, activeMacrocycle, activeRoutine } = current;

    // 2. Mark active routine as completed
    activeRoutine.status = 'completed';
    await this.routineRepo.save(activeRoutine);

    // 3. Determine macrocycle logic
    // Usually a macrocycle is 4 months. If today is past the end date of activeMacrocycle, we should advance it.
    // For simplicity in this endpoint, we'll assign the new routine to the currently active macrocycle based on dates
    // which getCurrentSeason already computed for us!
    const today = new Date();
    
    // Check if we need to advance the macrocycle based on dates
    let targetMacrocycleId = activeMacrocycle.id;
    let targetMacrocycleGoal = activeMacrocycle.goal;

    const nextMacrocycle = season.macrocycles.find(m => {
      const now = today.toISOString().split('T')[0];
      return (!m.endDate || m.endDate >= now) && (!m.startDate || m.startDate <= now);
    });

    if (nextMacrocycle && nextMacrocycle.id !== activeMacrocycle.id) {
      targetMacrocycleId = nextMacrocycle.id;
      targetMacrocycleGoal = nextMacrocycle.goal;
    }

    // 4. Generate new routine schedule
    const schedule = await this.generateSchedule(dto.splitPreference, dto.useCalisthenics || false);

    // Get user level for description
    const user = await this.userRepo.findOne({ where: { id: uId }});
    const level = user?.experienceLevel || 'intermediate';

    // 5. Create new routine
    const routineEnd = new Date(today);
    routineEnd.setDate(today.getDate() + 42); // 6 weeks from today

    const newRoutine = this.routineRepo.create({
      userId: uId,
      macrocycleId: targetMacrocycleId,
      name: `Mesociclo Evolucionado - ${dto.splitPreference}`,
      description: `Generado para nivel ${level}, objetivo: ${targetMacrocycleGoal}`,
      startDate: today.toISOString().split('T')[0],
      endDate: routineEnd.toISOString().split('T')[0],
      status: 'active',
      schedule: schedule,
    });
    
    await this.routineRepo.save(newRoutine);

    return { season, activeMacrocycle: nextMacrocycle || activeMacrocycle, activeRoutine: newRoutine };
  }

  private async getOrCreateExercise(name: string, muscleGroup: string): Promise<number> {
    let ex = await this.exerciseRepo.findOne({ where: { name } });
    if (!ex) {
      // Asignar un SVG genérico por defecto basado en el grupo muscular para que no dé error en el frontend
      let defaultSvg = '/assets/icons/exercises/default.svg';
      const mg = muscleGroup.toLowerCase();
      if (mg.includes('pecho')) defaultSvg = 'https://www.svgrepo.com/show/305260/chest.svg';
      if (mg.includes('espalda') || mg.includes('dorsal')) defaultSvg = 'https://www.svgrepo.com/show/305261/back.svg';
      if (mg.includes('pierna') || mg.includes('cuádriceps') || mg.includes('femoral')) defaultSvg = 'https://www.svgrepo.com/show/305264/leg.svg';
      if (mg.includes('glúteo')) defaultSvg = 'https://www.svgrepo.com/show/305264/leg.svg';
      if (mg.includes('brazo') || mg.includes('bíceps') || mg.includes('tríceps')) defaultSvg = 'https://www.svgrepo.com/show/305259/arm.svg';
      if (mg.includes('hombro')) defaultSvg = 'https://www.svgrepo.com/show/305259/arm.svg';

      ex = this.exerciseRepo.create({ name, muscleGroup, svgUrl: defaultSvg });
      await this.exerciseRepo.save(ex);
    }
    return ex.id;
  }

  private async generateSchedule(splitPref: string, useCalisthenics: boolean): Promise<any[]> {
    const schedule: any[] = [];
    
    if (splitPref.toLowerCase().includes('upper') || splitPref.toLowerCase().includes('superior')) {
      // UPPER / LOWER (4 days)
      const u1Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones (Push-ups)' : 'Press Banca', 'Pecho');
      const u1Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Remo Invertido (Anillas/Barra)' : 'Remo con Barra', 'Espalda');
      const u1Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones en Pica (Pike Push-ups)' : 'Press Militar', 'Hombros');
      const u1Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Dominadas Supinas (Chin-ups)' : 'Curl de Bíceps', 'Brazos');
      const u1Ex5 = await this.getOrCreateExercise(useCalisthenics ? 'Fondos en Banco (Bench Dips)' : 'Extensión de Tríceps', 'Brazos');

      schedule.push({
        dayName: 'Día 1 - Tren Superior',
        exercises: [
          { exerciseId: u1Ex1.toString(), sets: 3, reps: '8-10' },
          { exerciseId: u1Ex2.toString(), sets: 3, reps: '8-10' },
          { exerciseId: u1Ex3.toString(), sets: 3, reps: '10-12' },
          { exerciseId: u1Ex4.toString(), sets: 3, reps: '12-15' },
          { exerciseId: u1Ex5.toString(), sets: 3, reps: '12-15' },
        ]
      });

      const l1Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla Pistol (Asistida)' : 'Sentadilla', 'Cuádriceps');
      const l1Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Puente de Glúteo a 1 pierna' : 'Peso Muerto Rumano', 'Femorales');
      const l1Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla con Salto' : 'Prensa', 'Cuádriceps');
      const l1Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Curl Nórdico (Asistido)' : 'Curl Femoral', 'Femorales');
      const l1Ex5 = await this.getOrCreateExercise(useCalisthenics ? 'Elevación de Gemelos a 1 pierna' : 'Elevación de Gemelos', 'Piernas');

      schedule.push({
        dayName: 'Día 2 - Tren Inferior',
        exercises: [
          { exerciseId: l1Ex1.toString(), sets: 3, reps: '6-8' },
          { exerciseId: l1Ex2.toString(), sets: 3, reps: '8-10' },
          { exerciseId: l1Ex3.toString(), sets: 3, reps: '10-12' },
          { exerciseId: l1Ex4.toString(), sets: 3, reps: '12-15' },
          { exerciseId: l1Ex5.toString(), sets: 4, reps: '15-20' },
        ]
      });

      const u2Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Dominadas (Pull-ups)' : 'Dominadas / Jalón', 'Espalda');
      const u2Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones Declinadas' : 'Press Inclinado', 'Pecho');
      const u2Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Remo Invertido a 1 mano' : 'Remo en Máquina', 'Espalda');
      const u2Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones Diamante' : 'Elevaciones Laterales', 'Hombros');
      const u2Ex5 = await this.getOrCreateExercise(useCalisthenics ? 'Dominadas Isométricas' : 'Curl Martillo', 'Brazos');

      schedule.push({
        dayName: 'Día 3 - Tren Superior',
        exercises: [
          { exerciseId: u2Ex1.toString(), sets: 3, reps: '8-10' },
          { exerciseId: u2Ex2.toString(), sets: 3, reps: '8-12' },
          { exerciseId: u2Ex3.toString(), sets: 3, reps: '10-12' },
          { exerciseId: u2Ex4.toString(), sets: 4, reps: '15-20' },
          { exerciseId: u2Ex5.toString(), sets: 3, reps: '10-15' },
        ]
      });

      const l2Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla Búlgara' : 'Peso Muerto Convencional', 'Piernas');
      const l2Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Hip Thrust a 1 pierna' : 'Hip Thrust', 'Glúteos');
      const l2Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla Sissy' : 'Extensión de Cuádriceps', 'Cuádriceps');
      const l2Ex4 = await this.getOrCreateExercise('Plancha (Core)', 'Core');

      schedule.push({
        dayName: 'Día 4 - Tren Inferior',
        exercises: [
          { exerciseId: l2Ex1.toString(), sets: 3, reps: '5-8' },
          { exerciseId: l2Ex2.toString(), sets: 3, reps: '8-12' },
          { exerciseId: l2Ex3.toString(), sets: 3, reps: '12-15' },
          { exerciseId: l2Ex4.toString(), sets: 3, reps: '60s' },
        ]
      });

    } else {
      // FULLBODY (3 days)
      const f1Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla Pistol (Asistida)' : 'Sentadilla', 'Cuádriceps');
      const f1Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones (Push-ups)' : 'Press Banca', 'Pecho');
      const f1Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Remo Invertido' : 'Remo con Barra', 'Espalda');
      const f1Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Dominadas Supinas (Chin-ups)' : 'Curl de Bíceps', 'Brazos');

      schedule.push({
        dayName: 'Día 1 - Fullbody A',
        exercises: [
          { exerciseId: f1Ex1.toString(), sets: 3, reps: '6-8' },
          { exerciseId: f1Ex2.toString(), sets: 3, reps: '8-10' },
          { exerciseId: f1Ex3.toString(), sets: 3, reps: '8-10' },
          { exerciseId: f1Ex4.toString(), sets: 3, reps: '12-15' },
        ]
      });

      const f2Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Puente de Glúteo a 1 pierna' : 'Peso Muerto Rumano', 'Femorales');
      const f2Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones en Pica (Pike Push-ups)' : 'Press Militar', 'Hombros');
      const f2Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Dominadas (Pull-ups)' : 'Dominadas / Jalón', 'Espalda');
      const f2Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Fondos en Banco' : 'Extensión de Tríceps', 'Brazos');

      schedule.push({
        dayName: 'Día 2 - Fullbody B',
        exercises: [
          { exerciseId: f2Ex1.toString(), sets: 3, reps: '8-10' },
          { exerciseId: f2Ex2.toString(), sets: 3, reps: '8-12' },
          { exerciseId: f2Ex3.toString(), sets: 3, reps: '8-10' },
          { exerciseId: f2Ex4.toString(), sets: 3, reps: '12-15' },
        ]
      });

      const f3Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla con Salto' : 'Prensa', 'Cuádriceps');
      const f3Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones Declinadas' : 'Press Inclinado', 'Pecho');
      const f3Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Hip Thrust a 1 pierna' : 'Hip Thrust', 'Glúteos');
      const f3Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Plancha (Core)' : 'Elevaciones Laterales', 'Hombros');

      schedule.push({
        dayName: 'Día 3 - Fullbody C',
        exercises: [
          { exerciseId: f3Ex1.toString(), sets: 3, reps: '10-12' },
          { exerciseId: f3Ex2.toString(), sets: 3, reps: '10-12' },
          { exerciseId: f3Ex3.toString(), sets: 3, reps: '10-15' },
          { exerciseId: f3Ex4.toString(), sets: 4, reps: '15-20' },
        ]
      });
    }

    return schedule;
  }
}
