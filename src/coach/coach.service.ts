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

    const user = await this.userRepo.findOne({ where: { id: uId } });
    if (!user) return advice;

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

    // Rule 1: Deload check (if routine is in its final week)
    if (activeRoutine.startDate) {
      const start = new Date(activeRoutine.startDate).getTime();
      const now = new Date().getTime();
      const diffWeeks = (now - start) / (1000 * 60 * 60 * 24 * 7);
      
      const level = user.experienceLevel || 'intermediate';
      const deloadThreshold = level === 'beginner' ? 4 : 6;

      if (diffWeeks >= deloadThreshold && diffWeeks < deloadThreshold + 1) {
        advice.push({
          type: 'warning',
          title: 'Semana de Descarga (Deload) Activa',
          message: '¡Estás en la última semana de tu mesociclo! Esta debe ser tu semana de descarga (Deload). Te sugerimos reducir las series efectivas a la mitad (~40-60%) y entrenar a un RIR de 3-4 (baja intensidad) para disipar la fatiga acumulada antes de avanzar.',
        });
      } else if (diffWeeks >= deloadThreshold + 1) {
        advice.push({
          type: 'warning',
          title: 'Mesociclo Vencido',
          message: 'Tu mesociclo actual ya superó su duración planificada. Te recomendamos usar el botón "Avanzar Mesociclo" para comenzar un nuevo bloque.',
        });
      }
    }

    // Rule 1b: Inactivity Readaptation check
    try {
      const lastLog = await this.workoutLogRepo.findOne({
        where: { userId: uId },
        order: { date: 'DESC' },
      });

      if (lastLog) {
        const lastWorkoutDate = new Date(lastLog.date + 'T00:00:00').getTime();
        const now = new Date().getTime();
        const diffDays = Math.floor((now - lastWorkoutDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 7 && diffDays < 14) {
          advice.push({
            type: 'info',
            title: 'Retorno al Entrenamiento: Re-entrada',
            message: `Han pasado ${diffDays} días desde tu último entrenamiento. Te sugerimos realizar una sesión de re-entrada: reduce el volumen un 20% en tus ejercicios y mantén un RIR de 2-3 para evitar dolor muscular extremo (agujetas).`,
          });
        } else if (diffDays >= 14) {
          advice.push({
            type: 'warning',
            title: 'Retorno al Entrenamiento: Readaptación',
            message: `Han pasado ${diffDays} días sin entrenar. Es altamente recomendable realizar una **semana de readaptación**: reduce el volumen al 50%, entrena liviano (RIR 3-4) y evita llegar al fallo muscular durante esta primera semana para prevenir lesiones y recuperar el ritmo de forma segura.`,
          });
        }
      }
    } catch (e) {
      console.error('Error calculating readaptation advice:', e);
    }

    // Rule 2: Menstrual Cycle Check (Late Luteal warning)
    if (user.gender === 'female' && user.menstrualCycleOptIn && user.lastPeriodStartDate) {
      const start = new Date(user.lastPeriodStartDate + 'T00:00:00').getTime();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        const cycleLength = user.averageCycleLength || 28;
        const currentDayOfCycle = (diffDays % cycleLength) + 1;
        
        // Late luteal phase: last 7 days of the cycle
        if (currentDayOfCycle > cycleLength - 7) {
          advice.push({
            type: 'info',
            title: 'Fase Lútea Tardía Detectada',
            message: `Te encuentras en el día ${currentDayOfCycle} de tu ciclo. En la fase lútea tardía es común experimentar mayor fatiga o retención. Te sugerimos considerar un ajuste consultivo: puedes reducir 1 serie por ejercicio hoy o reducir la intensidad (mantener un RIR de 2-3 en vez de llegar al fallo).`,
          });
        }
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

    // Rule 3: Volume Check (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyLogs = logs.filter(l => new Date(l.date) >= oneWeekAgo);
    
    const volumePerGroup: Record<string, number> = {};
    const daysTrainedPerGroup: Record<string, Set<string>> = {};

    weeklyLogs.forEach(log => {
      const dateStr = new Date(log.date).toISOString().split('T')[0];
      log.exercises.forEach(ex => {
        if (ex.exercise) {
          const group = ex.exercise.muscleGroup;
          volumePerGroup[group] = (volumePerGroup[group] || 0) + ex.sets.length;
          
          if (!daysTrainedPerGroup[group]) {
            daysTrainedPerGroup[group] = new Set();
          }
          daysTrainedPerGroup[group].add(dateStr);
        }
      });
    });

    const lowVolumeMessages: string[] = [];
    const highVolumeMessages: string[] = [];
    let lowFrequencyGroups: string[] = [];

    const gender = user.gender || 'neutral';
    const level = user.experienceLevel || 'intermediate';

    Object.keys(volumePerGroup).forEach(group => {
      const range = this.getWeeklyVolumeRange(group, gender);
      let minSets = range.min;
      let maxSets = range.max;
      
      if (level === 'beginner') {
        minSets = Math.max(4, Math.round(minSets * 0.8));
      }

      const actualSets = volumePerGroup[group];

      if (actualSets < minSets) {
        lowVolumeMessages.push(`${group} (${actualSets} series vs. min. ${minSets})`);
      } else if (actualSets > maxSets + 2) {
        highVolumeMessages.push(`${group} (${actualSets} series vs. máx. ${maxSets})`);
      }
      
      if (daysTrainedPerGroup[group].size === 1) {
        lowFrequencyGroups.push(group);
      }
    });

    if (lowFrequencyGroups.length > 0) {
      advice.push({
        type: 'info',
        title: 'Frecuencia Baja Detectada',
        message: `Esta semana entrenaste ${lowFrequencyGroups.join(', ')} solo 1 vez. La ciencia (Frecuencia 2) sugiere estimular cada músculo al menos 2 veces por semana para óptima hipertrofia.`,
      });
    }

    if (lowVolumeMessages.length > 0) {
      advice.push({
        type: 'info',
        title: 'Volumen Bajo Detectado',
        message: `Tus series semanales están por debajo del rango sugerido para tu perfil en: ${lowVolumeMessages.join(', ')}. Considera añadir series para optimizar tu desarrollo.`,
      });
    }
    if (highVolumeMessages.length > 0) {
      advice.push({
        type: 'warning',
        title: 'Posible Sobreentrenamiento',
        message: `Tus series semanales superan el límite sugerido para tu perfil en: ${highVolumeMessages.join(', ')}. Si sientes fatiga persistente o estancamiento de cargas, reduce el volumen.`,
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
    const durationDays = this.getRoutineDurationDays(dto.experienceLevel);
    routineEnd.setDate(today.getDate() + durationDays);
    const schedule = await this.generateSchedule(dto.splitPreference, dto.gender, dto.experienceLevel, dto.useCalisthenics || false);

    // Disclaimer if gender differences applied
    const extraDesc = dto.gender === 'female' || dto.gender === 'male' 
      ? ` (Nota: Énfasis aplicado según tendencias estadísticas de género. Ajusta a tus prioridades).` 
      : '';

    const routine = this.routineRepo.create({
      userId: uId,
      macrocycleId: macro1.id,
      name: `Mesociclo 1 - ${dto.splitPreference}`,
      description: `Generado para nivel ${dto.experienceLevel}, objetivo: ${dto.goal}${extraDesc}`,
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

    // 2. Calculate comparison report Plan-vs-Real
    try {
      const logs = await this.workoutLogRepo.find({
        where: { userId: uId, routineId: activeRoutine.id },
        relations: ['exercises', 'exercises.exercise', 'exercises.sets'],
        order: { date: 'ASC' },
      });

      const loggedSessionsCount = logs.length;
      const daysInSchedule = activeRoutine.schedule && Array.isArray(activeRoutine.schedule) ? activeRoutine.schedule.length : 3;
      
      const start = activeRoutine.startDate ? new Date(activeRoutine.startDate).getTime() : new Date().getTime();
      const end = new Date().getTime();
      const weeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
      const totalScheduled = weeks * daysInSchedule;
      const adherence = totalScheduled > 0 ? Math.round((loggedSessionsCount / totalScheduled) * 100) : 100;

      const firstWeekVolume = logs.slice(0, daysInSchedule).reduce((sum, l) => sum + (l.totalVolume || 0), 0);
      const lastWeekVolume = logs.slice(-daysInSchedule).reduce((sum, l) => sum + (l.totalVolume || 0), 0);
      const volumeIncrease = firstWeekVolume > 0 ? Math.round(((lastWeekVolume - firstWeekVolume) / firstWeekVolume) * 100) : 0;

      const exerciseStartWeights: Record<string, number> = {};
      logs.slice(0, daysInSchedule).forEach(log => {
        log.exercises.forEach(ex => {
          if (ex.exercise && ex.sets.length > 0) {
            const name = ex.exercise.name;
            const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
            if (maxWeight > 0) {
              exerciseStartWeights[name] = Math.max(exerciseStartWeights[name] || 0, maxWeight);
            }
          }
        });
      });

      const exerciseEndWeights: Record<string, number> = {};
      logs.slice(-daysInSchedule).forEach(log => {
        log.exercises.forEach(ex => {
          if (ex.exercise && ex.sets.length > 0) {
            const name = ex.exercise.name;
            const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
            if (maxWeight > 0) {
              exerciseEndWeights[name] = Math.max(exerciseEndWeights[name] || 0, maxWeight);
            }
          }
        });
      });

      const strengthProgress: any[] = [];
      Object.keys(exerciseStartWeights).forEach(name => {
        if (exerciseEndWeights[name]) {
          const startW = exerciseStartWeights[name];
          const endW = exerciseEndWeights[name];
          const diff = endW - startW;
          const pct = startW > 0 ? Math.round((diff / startW) * 100) : 0;
          strengthProgress.push({
            exerciseName: name,
            startWeight: startW,
            endWeight: endW,
            percentage: pct,
          });
        }
      });

      activeRoutine.comparisonReport = {
        adherence: Math.min(100, adherence),
        loggedSessionsCount,
        totalScheduled,
        firstWeekVolume,
        lastWeekVolume,
        volumeIncrease,
        strengthProgress,
      };
    } catch (e) {
      console.error('Error calculating comparison report:', e);
      activeRoutine.comparisonReport = null;
    }

    // 3. Mark active routine as completed
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

    // 4. Get user level and gender
    const user = await this.userRepo.findOne({ where: { id: uId }});
    const level = user?.experienceLevel || 'intermediate';

    // 5. Generate new routine schedule
    const schedule = await this.generateSchedule(dto.splitPreference, user?.gender || 'neutral', level, dto.useCalisthenics || false);

    // Disclaimer if gender differences applied
    const extraDesc = user?.gender === 'female' || user?.gender === 'male' 
      ? ` (Nota: Énfasis aplicado según tendencias estadísticas de género. Ajusta a tus prioridades).` 
      : '';

    // 6. Create new routine
    const routineEnd = new Date(today);
    const durationDays = this.getRoutineDurationDays(level);
    routineEnd.setDate(today.getDate() + durationDays);

    const newRoutine = this.routineRepo.create({
      userId: uId,
      macrocycleId: targetMacrocycleId,
      name: `Mesociclo Evolucionado - ${dto.splitPreference}`,
      description: `Generado para nivel ${level}, objetivo: ${targetMacrocycleGoal}${extraDesc}`,
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
      let defaultSvg = '/assets/exercises/default.svg';
      const mg = muscleGroup.toLowerCase();
      if (mg.includes('pecho')) defaultSvg = 'https://www.svgrepo.com/vectors/305260/chest.svg';
      if (mg.includes('espalda') || mg.includes('dorsal')) defaultSvg = 'https://www.svgrepo.com/vectors/305261/back.svg';
      if (mg.includes('pierna') || mg.includes('cuádriceps') || mg.includes('femoral')) defaultSvg = 'https://www.svgrepo.com/vectors/305264/leg.svg';
      if (mg.includes('glúteo')) defaultSvg = 'https://www.svgrepo.com/vectors/305264/leg.svg';
      if (mg.includes('brazo') || mg.includes('bíceps') || mg.includes('tríceps')) defaultSvg = 'https://www.svgrepo.com/vectors/305259/arm.svg';
      if (mg.includes('hombro')) defaultSvg = 'https://www.svgrepo.com/vectors/305259/arm.svg';

      ex = this.exerciseRepo.create({ name, muscleGroup, svgUrl: defaultSvg });
      await this.exerciseRepo.save(ex);
    }
    return ex.id;
  }

  private async generateSchedule(splitPref: string, gender: string, experienceLevel: string, useCalisthenics: boolean): Promise<any[]> {
    const schedule: any[] = [];
    const isFemale = gender === 'female';
    
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
          { exerciseId: u1Ex1.toString(), sets: this.getExerciseSets('u1Ex1', gender, experienceLevel), reps: '8-10' },
          { exerciseId: u1Ex2.toString(), sets: this.getExerciseSets('u1Ex2', gender, experienceLevel), reps: '8-10' },
          { exerciseId: u1Ex3.toString(), sets: this.getExerciseSets('u1Ex3', gender, experienceLevel), reps: '10-12' },
          { exerciseId: u1Ex4.toString(), sets: this.getExerciseSets('u1Ex4', gender, experienceLevel), reps: '12-15' },
          { exerciseId: u1Ex5.toString(), sets: this.getExerciseSets('u1Ex5', gender, experienceLevel), reps: '12-15' },
        ]
      });

      // Female priority on lower 1: Hip thrust instead of RDL as main
      const l1Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla Pistol (Asistida)' : 'Sentadilla', 'Cuádriceps');
      const l1Ex2 = await this.getOrCreateExercise(isFemale ? 'Hip Thrust Pesado' : (useCalisthenics ? 'Puente de Glúteo a 1 pierna' : 'Peso Muerto Rumano'), isFemale ? 'Glúteos' : 'Femorales');
      const l1Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla con Salto' : 'Prensa', 'Cuádriceps');
      const l1Ex4 = await this.getOrCreateExercise(isFemale ? 'Abducción de Cadera (Máquina o Banda)' : (useCalisthenics ? 'Curl Nórdico (Asistido)' : 'Curl Femoral'), isFemale ? 'Glúteos' : 'Femorales');
      const l1Ex5 = await this.getOrCreateExercise(useCalisthenics ? 'Elevación de Gemelos a 1 pierna' : 'Elevación de Gemelos', 'Piernas');

      schedule.push({
        dayName: 'Día 2 - Tren Inferior',
        exercises: [
          { exerciseId: l1Ex1.toString(), sets: this.getExerciseSets('l1Ex1', gender, experienceLevel), reps: '6-8' },
          { exerciseId: l1Ex2.toString(), sets: this.getExerciseSets('l1Ex2', gender, experienceLevel), reps: '8-10' },
          { exerciseId: l1Ex3.toString(), sets: this.getExerciseSets('l1Ex3', gender, experienceLevel), reps: '10-12' },
          { exerciseId: l1Ex4.toString(), sets: this.getExerciseSets('l1Ex4', gender, experienceLevel), reps: '12-15' },
          { exerciseId: l1Ex5.toString(), sets: this.getExerciseSets('l1Ex5', gender, experienceLevel), reps: '15-20' },
        ]
      });

      const u2Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Dominadas (Pull-ups)' : 'Dominadas / Jalón', 'Espalda');
      const u2Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones Declinadas' : 'Press Inclinado', 'Pecho');
      const u2Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Remo Invertido a 1 mano' : 'Remo en Máquina', 'Espalda');
      // If female, maybe swap one arm exercise for side delts or just keep it
      const u2Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones Diamante' : 'Elevaciones Laterales', 'Hombros');
      const u2Ex5 = await this.getOrCreateExercise(isFemale ? 'Elevaciones Laterales con Cable' : (useCalisthenics ? 'Dominadas Isométricas' : 'Curl Martillo'), isFemale ? 'Hombros' : 'Brazos');

      schedule.push({
        dayName: 'Día 3 - Tren Superior',
        exercises: [
          { exerciseId: u2Ex1.toString(), sets: this.getExerciseSets('u2Ex1', gender, experienceLevel), reps: '8-10' },
          { exerciseId: u2Ex2.toString(), sets: this.getExerciseSets('u2Ex2', gender, experienceLevel), reps: '8-12' },
          { exerciseId: u2Ex3.toString(), sets: this.getExerciseSets('u2Ex3', gender, experienceLevel), reps: '10-12' },
          { exerciseId: u2Ex4.toString(), sets: this.getExerciseSets('u2Ex4', gender, experienceLevel), reps: '15-20' },
          { exerciseId: u2Ex5.toString(), sets: this.getExerciseSets('u2Ex5', gender, experienceLevel), reps: '10-15' },
        ]
      });

      // Female priority on lower 2: Bulgarian Split Squats
      const l2Ex1 = await this.getOrCreateExercise(isFemale ? 'Sentadilla Búlgara' : (useCalisthenics ? 'Sentadilla Búlgara' : 'Peso Muerto Convencional'), isFemale ? 'Piernas/Glúteo' : 'Piernas');
      const l2Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Hip Thrust a 1 pierna' : 'Hip Thrust', 'Glúteos');
      const l2Ex3 = await this.getOrCreateExercise(isFemale ? 'Peso Muerto Rumano con Mancuernas' : (useCalisthenics ? 'Sentadilla Sissy' : 'Extensión de Cuádriceps'), isFemale ? 'Femorales/Glúteo' : 'Cuádriceps');
      const l2Ex4 = await this.getOrCreateExercise('Plancha (Core)', 'Core');

      schedule.push({
        dayName: 'Día 4 - Tren Inferior',
        exercises: [
          { exerciseId: l2Ex1.toString(), sets: this.getExerciseSets('l2Ex1', gender, experienceLevel), reps: '5-8' },
          { exerciseId: l2Ex2.toString(), sets: this.getExerciseSets('l2Ex2', gender, experienceLevel), reps: '8-12' },
          { exerciseId: l2Ex3.toString(), sets: this.getExerciseSets('l2Ex3', gender, experienceLevel), reps: '12-15' },
          { exerciseId: l2Ex4.toString(), sets: this.getExerciseSets('l2Ex4', gender, experienceLevel), reps: '60s' },
        ]
      });

    } else {
      // FULLBODY (3 days)
      const f1Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Sentadilla Pistol (Asistida)' : 'Sentadilla', 'Cuádriceps');
      const f1Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones (Push-ups)' : 'Press Banca', 'Pecho');
      const f1Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Remo Invertido' : 'Remo con Barra', 'Espalda');
      // If female, swap biceps for glutes
      const f1Ex4 = await this.getOrCreateExercise(isFemale ? 'Hip Thrust' : (useCalisthenics ? 'Dominadas Supinas (Chin-ups)' : 'Curl de Bíceps'), isFemale ? 'Glúteos' : 'Brazos');

      schedule.push({
        dayName: 'Día 1 - Fullbody A',
        exercises: [
          { exerciseId: f1Ex1.toString(), sets: this.getExerciseSets('f1Ex1', gender, experienceLevel), reps: '6-8' },
          { exerciseId: f1Ex2.toString(), sets: this.getExerciseSets('f1Ex2', gender, experienceLevel), reps: '8-10' },
          { exerciseId: f1Ex3.toString(), sets: this.getExerciseSets('f1Ex3', gender, experienceLevel), reps: '8-10' },
          { exerciseId: f1Ex4.toString(), sets: this.getExerciseSets('f1Ex4', gender, experienceLevel), reps: '12-15' },
        ]
      });

      const f2Ex1 = await this.getOrCreateExercise(useCalisthenics ? 'Puente de Glúteo a 1 pierna' : 'Peso Muerto Rumano', 'Femorales');
      const f2Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones en Pica (Pike Push-ups)' : 'Press Militar', 'Hombros');
      const f2Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Dominadas (Pull-ups)' : 'Dominadas / Jalón', 'Espalda');
      const f2Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Fondos en Banco' : 'Extensión de Tríceps', 'Brazos');

      schedule.push({
        dayName: 'Día 2 - Fullbody B',
        exercises: [
          { exerciseId: f2Ex1.toString(), sets: this.getExerciseSets('f2Ex1', gender, experienceLevel), reps: '8-10' },
          { exerciseId: f2Ex2.toString(), sets: this.getExerciseSets('f2Ex2', gender, experienceLevel), reps: '8-12' },
          { exerciseId: f2Ex3.toString(), sets: this.getExerciseSets('f2Ex3', gender, experienceLevel), reps: '8-10' },
          { exerciseId: f2Ex4.toString(), sets: this.getExerciseSets('f2Ex4', gender, experienceLevel), reps: '12-15' },
        ]
      });

      const f3Ex1 = await this.getOrCreateExercise(isFemale ? 'Sentadilla Búlgara' : (useCalisthenics ? 'Sentadilla con Salto' : 'Prensa'), 'Cuádriceps');
      const f3Ex2 = await this.getOrCreateExercise(useCalisthenics ? 'Flexiones Declinadas' : 'Press Inclinado', 'Pecho');
      const f3Ex3 = await this.getOrCreateExercise(useCalisthenics ? 'Hip Thrust a 1 pierna' : 'Hip Thrust', 'Glúteos');
      const f3Ex4 = await this.getOrCreateExercise(useCalisthenics ? 'Plancha (Core)' : 'Elevaciones Laterales', 'Hombros');

      schedule.push({
        dayName: 'Día 3 - Fullbody C',
        exercises: [
          { exerciseId: f3Ex1.toString(), sets: this.getExerciseSets('f3Ex1', gender, experienceLevel), reps: '10-12' },
          { exerciseId: f3Ex2.toString(), sets: this.getExerciseSets('f3Ex2', gender, experienceLevel), reps: '10-12' },
          { exerciseId: f3Ex3.toString(), sets: this.getExerciseSets('f3Ex3', gender, experienceLevel), reps: '10-15' },
          { exerciseId: f3Ex4.toString(), sets: this.getExerciseSets('f3Ex4', gender, experienceLevel), reps: '15-20' },
        ]
      });
    }

    return schedule;
  }

  private getExerciseSets(key: string, gender: string, level: string): number {
    const isFemale = gender === 'female';
    const isBeginner = level === 'beginner';

    let sets = 3; // default

    if (key === 'u1Ex1') sets = isFemale ? 3 : 4;
    else if (key === 'u1Ex2') sets = isFemale ? 3 : 4;
    else if (key === 'u1Ex3') sets = 3;
    else if (key === 'u1Ex4') sets = isFemale ? 3 : 4;
    else if (key === 'u1Ex5') sets = isFemale ? 3 : 4;

    else if (key === 'l1Ex1') sets = isFemale ? 4 : 3;
    else if (key === 'l1Ex2') sets = isFemale ? 4 : 3;
    else if (key === 'l1Ex3') sets = 3;
    else if (key === 'l1Ex4') sets = isFemale ? 4 : 3;
    else if (key === 'l1Ex5') sets = 4;

    else if (key === 'u2Ex1') sets = 4;
    else if (key === 'u2Ex2') sets = isFemale ? 3 : 4;
    else if (key === 'u2Ex3') sets = isFemale ? 3 : 4;
    else if (key === 'u2Ex4') sets = isFemale ? 4 : 5;
    else if (key === 'u2Ex5') sets = isFemale ? 3 : 4;

    else if (key === 'l2Ex1') sets = isFemale ? 4 : 3;
    else if (key === 'l2Ex2') sets = isFemale ? 4 : 3;
    else if (key === 'l2Ex3') sets = isFemale ? 4 : 3;
    else if (key === 'l2Ex4') sets = isFemale ? 3 : 4;

    else if (key === 'f1Ex1') sets = isFemale ? 4 : 3;
    else if (key === 'f1Ex2') sets = isFemale ? 3 : 4;
    else if (key === 'f1Ex3') sets = 4;
    else if (key === 'f1Ex4') sets = 4;

    else if (key === 'f2Ex1') sets = isFemale ? 4 : 3;
    else if (key === 'f2Ex2') sets = 3;
    else if (key === 'f2Ex3') sets = 4;
    else if (key === 'f2Ex4') sets = isFemale ? 3 : 4;

    else if (key === 'f3Ex1') sets = isFemale ? 4 : 3;
    else if (key === 'f3Ex2') sets = isFemale ? 3 : 4;
    else if (key === 'f3Ex3') sets = isFemale ? 4 : 3;
    else if (key === 'f3Ex4') sets = 4;

    if (isBeginner) {
      if (sets > 3) {
        sets = 3;
      } else if (key === 'l1Ex3' || key === 'f3Ex1') {
        sets = 2; // Menos volumen para novatos
      }
    }

    return sets;
  }

  private getRoutineDurationDays(experienceLevel: string): number {
    return experienceLevel === 'beginner' ? 35 : 49; // 5 weeks vs 7 weeks
  }

  private getWeeklyVolumeRange(muscleGroup: string, gender: string): { min: number; max: number } {
    const mg = muscleGroup.toLowerCase();
    if (gender === 'female') {
      if (mg.includes('glúteo')) return { min: 12, max: 16 };
      if (mg.includes('cuádriceps') || mg.includes('pierna')) return { min: 10, max: 14 };
      if (mg.includes('femoral')) return { min: 8, max: 12 };
      if (mg.includes('espalda') || mg.includes('dorsal')) return { min: 10, max: 14 };
      if (mg.includes('hombro')) return { min: 8, max: 12 };
      if (mg.includes('pecho')) return { min: 6, max: 10 };
      if (mg.includes('brazo') || mg.includes('bíceps') || mg.includes('tríceps')) return { min: 6, max: 10 };
      if (mg.includes('core') || mg.includes('abdomen')) return { min: 6, max: 10 };
      return { min: 10, max: 20 };
    } else if (gender === 'male') {
      if (mg.includes('pecho')) return { min: 10, max: 14 };
      if (mg.includes('espalda') || mg.includes('dorsal')) return { min: 12, max: 16 };
      if (mg.includes('hombro')) return { min: 8, max: 12 };
      if (mg.includes('cuádriceps') || mg.includes('pierna')) return { min: 8, max: 12 };
      if (mg.includes('femoral') || mg.includes('glúteo')) return { min: 8, max: 12 };
      if (mg.includes('brazo') || mg.includes('bíceps') || mg.includes('tríceps')) return { min: 8, max: 12 };
      if (mg.includes('core') || mg.includes('abdomen')) return { min: 4, max: 8 };
      return { min: 10, max: 20 };
    } else {
      return { min: 10, max: 20 };
    }
  }
}
