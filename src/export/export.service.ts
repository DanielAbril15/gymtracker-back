import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Routine } from '../entities/routine.entity';
import { WorkoutLog } from '../entities/workout-log.entity';
import { User } from '../entities/user.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExportService {
  constructor(
    private readonly moduleRef: ModuleRef,
  ) {}

  private get routineRepo(): Repository<Routine> {
    return this.moduleRef.get(getRepositoryToken(Routine), { strict: false });
  }

  private get workoutLogRepo(): Repository<WorkoutLog> {
    return this.moduleRef.get(getRepositoryToken(WorkoutLog), { strict: false });
  }

  private get userRepo(): Repository<User> {
    return this.moduleRef.get(getRepositoryToken(User), { strict: false });
  }

  async generateExcel(userId: string, routineId?: string | null): Promise<Buffer> {
    let routine: Routine | null = null;
    let logs: any[] = [];
    let userName = 'Atleta';

    const uId = Number(userId);
    let rId = routineId ? Number(routineId) : null;

    if (!rId) {
      const activeRoutine = await this.routineRepo.findOne({
        where: { userId: uId, status: 'active' },
        order: { id: 'DESC' },
      });
      const lastRoutine = activeRoutine || await this.routineRepo.findOne({
        where: { userId: uId },
        order: { id: 'DESC' },
      });
      if (!lastRoutine) {
        throw new NotFoundException('No se encontraron rutinas para exportar');
      }
      rId = lastRoutine.id;
    }

    const sqlRoutine = await this.routineRepo.findOne({ where: { id: rId, userId: uId } });
    if (!sqlRoutine) {
      throw new NotFoundException('Rutina no encontrada');
    }
    routine = sqlRoutine;

    logs = await this.workoutLogRepo.find({
      where: { userId: uId, routineId: rId },
      order: { date: 'ASC' },
      relations: ['exercises', 'exercises.exercise', 'exercises.sets'],
    });

    const user = await this.userRepo.findOne({ where: { id: uId } });
    userName = user ? user.name : 'Atleta';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GymTracker App';
    workbook.created = new Date();

    const totalSessions = logs.length;
    const daysTrained = totalSessions;
    let totalVolumeSum = 0;
    const exerciseFrequency: Record<string, number> = {};
    const muscleGroupSets: Record<string, number> = {};

    logs.forEach(log => {
      totalVolumeSum += log.totalVolume;
      log.exercises.forEach((exEntry: any) => {
        const ex = exEntry.exercise;
        if (!ex) return;
        exerciseFrequency[ex.name] = (exerciseFrequency[ex.name] || 0) + 1;
        muscleGroupSets[ex.muscleGroup] = (muscleGroupSets[ex.muscleGroup] || 0) + exEntry.sets.length;
      });
    });

    let mostFrequentExercise = 'N/A';
    let maxFreq = 0;
    Object.entries(exerciseFrequency).forEach(([name, count]) => {
      if (count > maxFreq) {
        maxFreq = count;
        mostFrequentExercise = name;
      }
    });

    let dominantMuscleGroup = 'N/A';
    let maxSets = 0;
    Object.entries(muscleGroupSets).forEach(([group, count]) => {
      if (count > maxSets) {
        maxSets = count;
        dominantMuscleGroup = group;
      }
    });

    const formatDate = (d: Date | string | null | undefined): string => {
      if (!d) return 'Activa';
      const dateObj = typeof d === 'string' ? new Date(d) : d;
      return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const periodStr = `${formatDate(routine.startDate)} — ${formatDate(routine.endDate)}`;

    // ─────────────────────────────────────────────────────────────
    // HOJA 1: RESUMEN
    // ─────────────────────────────────────────────────────────────
    const sheetResumen = workbook.addWorksheet('RESUMEN');
    sheetResumen.views = [{ showGridLines: true }];

    const primaryColorFill: any = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF97316' }, // #F97316 orange
    };
    
    const darkHeaderFill: any = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' }, // #111827 dark grey
    };

    const headerTextFont = { name: 'DM Sans', color: { argb: 'FFFFFFFF' }, bold: true };
    const titleFont = { name: 'Bebas Neue', size: 18, color: { argb: 'FFFFFFFF' }, bold: true };
    const bFont = { name: 'DM Sans', bold: true };
    const regularFont = { name: 'DM Sans' };
    const monoFont = { name: 'JetBrains Mono' };

    sheetResumen.mergeCells('A1:E1');
    const cellA1 = sheetResumen.getCell('A1');
    cellA1.value = 'GYMTRACKER — Reporte de Rendimiento';
    cellA1.font = titleFont;
    cellA1.fill = primaryColorFill;
    cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetResumen.getRow(1).height = 40;

    sheetResumen.getCell('A2').value = `Usuario: ${userName}`;
    sheetResumen.getCell('A2').font = bFont;
    sheetResumen.getCell('C2').value = `Rutina: ${routine.name}`;
    sheetResumen.getCell('C2').font = bFont;
    sheetResumen.getCell('E2').value = `Período: ${periodStr}`;
    sheetResumen.getCell('E2').font = bFont;
    sheetResumen.getRow(2).height = 25;

    sheetResumen.getCell('A4').value = 'MÉTRICAS GENERALES';
    sheetResumen.getCell('A4').font = { ...titleFont, size: 14, color: { argb: 'FFF97316' } };
    sheetResumen.getRow(4).height = 25;

    const metricsHeaders = ['Total Sesiones', 'Días Entrenados', 'Volumen Total (kg)', 'Ejercicio Más Frecuente', 'Grupo Muscular Dominante'];
    metricsHeaders.forEach((h, idx) => {
      const cell = sheetResumen.getCell(5, idx + 1);
      cell.value = h;
      cell.fill = darkHeaderFill;
      cell.font = headerTextFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheetResumen.getRow(5).height = 25;

    sheetResumen.getCell('A6').value = totalSessions;
    sheetResumen.getCell('B6').value = daysTrained;
    sheetResumen.getCell('C6').value = totalVolumeSum;
    sheetResumen.getCell('D6').value = mostFrequentExercise;
    sheetResumen.getCell('E6').value = dominantMuscleGroup;

    for (let col = 1; col <= 5; col++) {
      const cell = sheetResumen.getCell(6, col);
      cell.font = col <= 3 ? monoFont : regularFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (col === 3) cell.numFmt = '#,##0';
    }
    sheetResumen.getRow(6).height = 25;

    sheetResumen.getCell('A8').value = 'PROGRESIÓN DE VOLUMEN SEMANAL';
    sheetResumen.getCell('A8').font = { ...titleFont, size: 14, color: { argb: 'FFF97316' } };
    sheetResumen.getRow(8).height = 25;

    const progHeaders = ['Semana', 'Sesiones', 'Volumen Total (kg)', 'Promedio por Sesión', 'vs Semana Anterior'];
    progHeaders.forEach((h, idx) => {
      const cell = sheetResumen.getCell(9, idx + 1);
      cell.value = h;
      cell.fill = darkHeaderFill;
      cell.font = headerTextFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheetResumen.getRow(9).height = 25;

    const logsByWeek: Record<number, any[]> = {};
    const startDateMs = new Date(routine.startDate || new Date()).getTime();

    logs.forEach(log => {
      const logDate = new Date(log.date);
      const diffDays = Math.floor((logDate.getTime() - startDateMs) / (24 * 60 * 60 * 1000));
      const weekIndex = Math.floor(diffDays / 7) + 1;
      
      if (!logsByWeek[weekIndex]) {
        logsByWeek[weekIndex] = [];
      }
      logsByWeek[weekIndex].push(log);
    });

    const activeWeeks = Object.keys(logsByWeek).map(Number).sort((a, b) => a - b);
    let currentRow = 10;

    activeWeeks.forEach((weekNum, index) => {
      const weekLogs = logsByWeek[weekNum];
      const weekVolume = weekLogs.reduce((sum, l) => sum + l.totalVolume, 0);

      sheetResumen.getCell(`A${currentRow}`).value = `Semana ${weekNum}`;
      sheetResumen.getCell(`B${currentRow}`).value = weekLogs.length;
      sheetResumen.getCell(`C${currentRow}`).value = weekVolume;
      sheetResumen.getCell(`D${currentRow}`).value = { formula: `=C${currentRow}/B${currentRow}` };

      if (index === 0) {
        sheetResumen.getCell(`E${currentRow}`).value = '-';
      } else {
        const prevRow = currentRow - 1;
        sheetResumen.getCell(`E${currentRow}`).value = { formula: `=(C${currentRow}-C${prevRow})/C${prevRow}` };
      }

      sheetResumen.getCell(`A${currentRow}`).font = regularFont;
      sheetResumen.getCell(`B${currentRow}`).font = monoFont;
      sheetResumen.getCell(`C${currentRow}`).font = monoFont;
      sheetResumen.getCell(`D${currentRow}`).font = monoFont;
      sheetResumen.getCell(`E${currentRow}`).font = monoFont;

      sheetResumen.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
      sheetResumen.getCell(`B${currentRow}`).alignment = { horizontal: 'center' };
      sheetResumen.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };
      sheetResumen.getCell(`D${currentRow}`).alignment = { horizontal: 'right' };
      sheetResumen.getCell(`E${currentRow}`).alignment = { horizontal: 'right' };

      sheetResumen.getCell(`C${currentRow}`).numFmt = '#,##0';
      sheetResumen.getCell(`D${currentRow}`).numFmt = '#,##0';
      sheetResumen.getCell(`E${currentRow}`).numFmt = '0.0%';

      sheetResumen.getRow(currentRow).height = 22;
      currentRow++;
    });

    sheetResumen.columns.forEach(col => {
      col.width = 25;
    });

    // ─────────────────────────────────────────────────────────────
    // HOJA 2: LOG_DETALLADO
    // ─────────────────────────────────────────────────────────────
    const sheetDetallado = workbook.addWorksheet('LOG_DETALLADO');
    sheetDetallado.views = [{ showGridLines: true }];

    const detalladoHeaders = [
      'Fecha', 'Día Semana', 'Ejercicio', 'Grupo Muscular',
      'Serie', 'Reps', 'Peso(kg)', 'Volumen Serie', 'RPE', 'Semana#', 'Mes'
    ];

    detalladoHeaders.forEach((h, idx) => {
      const cell = sheetDetallado.getCell(1, idx + 1);
      cell.value = h;
      cell.fill = darkHeaderFill;
      cell.font = headerTextFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheetDetallado.getRow(1).height = 25;

    let detRow = 2;
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    logs.forEach(log => {
      const logDate = new Date(log.date);
      const dayOfWeek = dayNames[logDate.getDay()];
      const monthName = monthNames[logDate.getMonth()];
      
      const diffDays = Math.floor((logDate.getTime() - startDateMs) / (24 * 60 * 60 * 1000));
      const weekNum = Math.floor(diffDays / 7) + 1;

      log.exercises.forEach((exEntry: any) => {
        const ex = exEntry.exercise;
        if (!ex) return;

        exEntry.sets.forEach((set: any, setIndex: number) => {
          sheetDetallado.getCell(`A${detRow}`).value = log.date;
          sheetDetallado.getCell(`B${detRow}`).value = dayOfWeek;
          sheetDetallado.getCell(`C${detRow}`).value = ex.name;
          sheetDetallado.getCell(`D${detRow}`).value = ex.muscleGroup;
          sheetDetallado.getCell(`E${detRow}`).value = setIndex + 1;
          sheetDetallado.getCell(`F${detRow}`).value = set.reps;
          sheetDetallado.getCell(`G${detRow}`).value = set.weight;
          sheetDetallado.getCell(`H${detRow}`).value = { formula: `=F${detRow}*G${detRow}` };
          sheetDetallado.getCell(`I${detRow}`).value = set.rpe || '';
          sheetDetallado.getCell(`J${detRow}`).value = weekNum;
          sheetDetallado.getCell(`K${detRow}`).value = monthName;

          sheetDetallado.getCell(`A${detRow}`).alignment = { horizontal: 'center' };
          sheetDetallado.getCell(`B${detRow}`).alignment = { horizontal: 'center' };
          sheetDetallado.getCell(`E${detRow}`).alignment = { horizontal: 'center' };
          sheetDetallado.getCell(`F${detRow}`).alignment = { horizontal: 'center' };
          sheetDetallado.getCell(`G${detRow}`).alignment = { horizontal: 'right' };
          sheetDetallado.getCell(`H${detRow}`).alignment = { horizontal: 'right' };
          sheetDetallado.getCell(`I${detRow}`).alignment = { horizontal: 'center' };
          sheetDetallado.getCell(`J${detRow}`).alignment = { horizontal: 'center' };
          sheetDetallado.getCell(`K${detRow}`).alignment = { horizontal: 'center' };

          sheetDetallado.getCell(`A${detRow}`).font = monoFont;
          sheetDetallado.getCell(`F${detRow}`).font = monoFont;
          sheetDetallado.getCell(`G${detRow}`).font = monoFont;
          sheetDetallado.getCell(`H${detRow}`).font = monoFont;
          sheetDetallado.getCell(`I${detRow}`).font = monoFont;
          sheetDetallado.getCell(`J${detRow}`).font = monoFont;

          sheetDetallado.getCell(`G${detRow}`).numFmt = '#,##0.0';
          sheetDetallado.getCell(`H${detRow}`).numFmt = '#,##0.0';

          sheetDetallado.getRow(detRow).height = 20;
          detRow++;
        });
      });
    });

    sheetDetallado.columns.forEach((col, i) => {
      const widths = [15, 12, 22, 16, 8, 8, 12, 15, 8, 10, 12];
      col.width = widths[i];
    });

    // ─────────────────────────────────────────────────────────────
    // HOJA 3: PROGRESION_EJERCICIO
    // ─────────────────────────────────────────────────────────────
    const sheetProgresion = workbook.addWorksheet('PROGRESION_EJERCICIO');
    sheetProgresion.views = [{ showGridLines: true }];

    const activeExercises: any[] = [];
    logs.forEach(l => {
      l.exercises.forEach((exEntry: any) => {
        const ex = exEntry.exercise;
        if (!ex) return;
        if (!activeExercises.some(e => e.name === ex.name)) {
          activeExercises.push(ex);
        }
      });
    });

    let progRow = 1;

    activeExercises.forEach(exercise => {
      sheetProgresion.mergeCells(`A${progRow}:F${progRow}`);
      const headerCell = sheetProgresion.getCell(`A${progRow}`);
      headerCell.value = `${exercise.name.toUpperCase()} — Evolución`;
      headerCell.font = { ...titleFont, size: 14 };
      headerCell.fill = primaryColorFill;
      headerCell.alignment = { horizontal: 'left', vertical: 'middle' };
      sheetProgresion.getRow(progRow).height = 30;
      progRow++;

      const secHeaders = ['Fecha', '1RM Estimado*', 'Peso Máx', 'Reps Máx', 'Volumen Total', 'vs Sesión Anterior'];
      secHeaders.forEach((h, idx) => {
        const cell = sheetProgresion.getCell(progRow, idx + 1);
        cell.value = h;
        cell.fill = darkHeaderFill;
        cell.font = headerTextFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      sheetProgresion.getRow(progRow).height = 25;
      
      const startDataRow = progRow + 1;
      progRow++;

      const targetExerciseIdStr = exercise.id.toString();

      const exLogs = logs.filter(l => l.exercises.some((e: any) => {
        const eId = e.exerciseId.toString();
        return eId === targetExerciseIdStr;
      }));

      exLogs.forEach((log, logIdx) => {
        const exEntry = log.exercises.find((e: any) => {
          const eId = e.exerciseId.toString();
          return eId === targetExerciseIdStr;
        });
        if (!exEntry) return;

        let maxWeight = 0;
        let maxReps = 0;
        let exerciseVolume = 0;

        exEntry.sets.forEach((set: any) => {
          exerciseVolume += set.volume;
          if (set.weight > maxWeight) {
            maxWeight = set.weight;
            maxReps = set.reps;
          }
        });

        sheetProgresion.getCell(`A${progRow}`).value = log.date;
        sheetProgresion.getCell(`B${progRow}`).value = { formula: `=C${progRow}*(1+D${progRow}/30)` };
        sheetProgresion.getCell(`C${progRow}`).value = maxWeight;
        sheetProgresion.getCell(`D${progRow}`).value = maxReps;
        sheetProgresion.getCell(`E${progRow}`).value = exerciseVolume;

        if (logIdx === 0) {
          sheetProgresion.getCell(`F${progRow}`).value = '-';
        } else {
          const prevRow = progRow - 1;
          sheetProgresion.getCell(`F${progRow}`).value = { formula: `=E${progRow}-E${prevRow}` };
        }

        sheetProgresion.getCell(`A${progRow}`).alignment = { horizontal: 'center' };
        sheetProgresion.getCell(`B${progRow}`).alignment = { horizontal: 'right' };
        sheetProgresion.getCell(`C${progRow}`).alignment = { horizontal: 'right' };
        sheetProgresion.getCell(`D${progRow}`).alignment = { horizontal: 'center' };
        sheetProgresion.getCell(`E${progRow}`).alignment = { horizontal: 'right' };
        sheetProgresion.getCell(`F${progRow}`).alignment = { horizontal: 'right' };

        sheetProgresion.getCell(`A${progRow}`).font = monoFont;
        sheetProgresion.getCell(`B${progRow}`).font = monoFont;
        sheetProgresion.getCell(`C${progRow}`).font = monoFont;
        sheetProgresion.getCell(`D${progRow}`).font = monoFont;
        sheetProgresion.getCell(`E${progRow}`).font = monoFont;
        sheetProgresion.getCell(`F${progRow}`).font = monoFont;

        sheetProgresion.getCell(`B${progRow}`).numFmt = '#,##0.0';
        sheetProgresion.getCell(`C${progRow}`).numFmt = '#,##0.0';
        sheetProgresion.getCell(`E${progRow}`).numFmt = '#,##0';
        sheetProgresion.getCell(`F${progRow}`).numFmt = '+#,##0;-#,##0;0';

        sheetProgresion.getRow(progRow).height = 20;
        progRow++;
      });

      progRow += 2;
    });

    sheetProgresion.columns.forEach((col, i) => {
      const widths = [15, 16, 12, 12, 16, 20];
      col.width = widths[i];
    });

    // ─────────────────────────────────────────────────────────────
    // HOJA 4: PARA_IA
    // ─────────────────────────────────────────────────────────────
    const sheetParaIa = workbook.addWorksheet('PARA_IA');
    sheetParaIa.views = [{ showGridLines: false }];

    const totalWeeksCount = activeWeeks.length;
    const weeklyFreq = totalWeeksCount > 0 ? (totalSessions / totalWeeksCount).toFixed(1) : '0';

    let progressionTableMarkdown = '| Ejercicio | Grupo Muscular | Sesiones | Peso Máx | Reps Máx (con peso máx) | Volumen Total |\n';
    progressionTableMarkdown += '| --- | --- | --- | --- | --- | --- |\n';

    activeExercises.forEach(exercise => {
      const targetExerciseIdStr = exercise.id.toString();

      const exLogs = logs.filter(l => l.exercises.some((e: any) => {
        const eId = e.exerciseId.toString();
        return eId === targetExerciseIdStr;
      }));

      let maxWeight = 0;
      let maxReps = 0;
      let totalExVolume = 0;

      exLogs.forEach(log => {
        const exEntry = log.exercises.find((e: any) => {
          const eId = e.exerciseId.toString();
          return eId === targetExerciseIdStr;
        });
        if (!exEntry) return;
        exEntry.sets.forEach((set: any) => {
          totalExVolume += set.volume;
          if (set.weight > maxWeight) {
            maxWeight = set.weight;
            maxReps = set.reps;
          }
        });
      });

      progressionTableMarkdown += `| ${exercise.name} | ${exercise.muscleGroup} | ${exLogs.length} | ${maxWeight} kg | ${maxReps} reps | ${totalExVolume} kg |\n`;
    });

    const promptText = `
# ESTA HOJA ESTÁ DISEÑADA PARA SER COPIADA Y PEGADA DIRECTAMENTE EN UN CHAT DE IA (CHATGPT, CLAUDE, DEEPMIND)

CONTEXTO: Soy un atleta realizando seguimiento de mi entrenamiento con la app GymTracker.
A continuación están mis métricas del período ${formatDate(routine.startDate)} al ${formatDate(routine.endDate || new Date())}.
Por favor analiza mi progresión y recomienda si debo aumentar peso, repeticiones o intensidad (RPE).

PERFIL DEL ATLETA:
- Rutina: ${routine.name}
- Período analizado: ${totalWeeksCount} semanas
- Frecuencia promedio: ${weeklyFreq} días/semana

DATOS DE PROGRESIÓN DE EJERCICIOS:
${progressionTableMarkdown}

SOLICITUD DE ANÁLISIS PARA LA IA:
1. ¿En qué ejercicios estoy estancado? (sin progresión significativa en peso o volumen en 2+ semanas)
2. ¿En cuáles debo aumentar peso? (criterio sugerido: completar todas las series planificadas con un RPE < 8)
3. ¿Hay algún desequilibrio muscular visible en la distribución del volumen de entrenamiento (por número de series o grupos)?
4. Recomendaciones concretas y estructuradas para el próximo ciclo de entrenamiento.
`;

    sheetParaIa.getCell('A1').value = promptText;
    sheetParaIa.getCell('A1').font = { name: 'JetBrains Mono', size: 10, color: { argb: 'FF10B981' } };
    sheetParaIa.getCell('A1').alignment = { wrapText: true, vertical: 'top' };
    
    sheetParaIa.mergeCells('A1:L35');
    sheetParaIa.getRow(1).height = 650;
    sheetParaIa.getColumn('A').width = 110;

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
