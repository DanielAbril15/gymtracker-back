import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { User } from './user.entity';
import { Routine } from './routine.entity';
import { LoggedExercise } from './logged-exercise.entity';

@Entity('workout_logs')
@Index(['userId', 'date'], { unique: true })
export class WorkoutLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.workoutLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  routineId: number | null;

  @ManyToOne(() => Routine, (routine) => routine.workoutLogs, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'routineId' })
  routine: Routine;

  @Column({ type: 'varchar', length: 10 })
  date: string; // YYYY-MM-DD

  @Column({ type: 'float', default: 0 })
  totalVolume: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => LoggedExercise, (loggedExercise) => loggedExercise.workoutLog, { cascade: true })
  exercises: LoggedExercise[];
}
