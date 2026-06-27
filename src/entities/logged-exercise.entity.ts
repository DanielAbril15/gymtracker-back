import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { WorkoutLog } from './workout-log.entity';
import { Exercise } from './exercise.entity';
import { WorkoutSet } from './workout-set.entity';

@Entity('logged_exercises')
export class LoggedExercise {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  workoutLogId: number;

  @ManyToOne(() => WorkoutLog, (log) => log.exercises, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workoutLogId' })
  workoutLog: WorkoutLog;

  @Column()
  exerciseId: number;

  @ManyToOne(() => Exercise, (exercise) => exercise.loggedExercises, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Exercise;

  @OneToMany(() => WorkoutSet, (set) => set.loggedExercise, { cascade: true })
  sets: WorkoutSet[];
}
