import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { LoggedExercise } from './logged-exercise.entity';

@Entity('workout_sets')
export class WorkoutSet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  loggedExerciseId: number;

  @ManyToOne(() => LoggedExercise, (loggedExercise) => loggedExercise.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loggedExerciseId' })
  loggedExercise: LoggedExercise;

  @Column({ type: 'int' })
  reps: number;

  @Column({ type: 'float' })
  weight: number;

  @Column({ type: 'float', nullable: true })
  rpe: number | null;

  @Column({ type: 'float' })
  volume: number;
}
