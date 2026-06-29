import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { WorkoutLog } from './workout-log.entity';
import { Macrocycle } from './macrocycle.entity';

@Entity('routines')
export class Routine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.routines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  macrocycleId: number | null;

  @ManyToOne(() => Macrocycle, (macro) => macro.routines, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'macrocycleId' })
  macrocycle: Macrocycle;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  startDate: string | null; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 10, nullable: true })
  endDate: string | null; // YYYY-MM-DD

  @Column({ default: 'active' })
  status: string; // active, completed, archived

  @Column({ type: 'json', nullable: true })
  schedule: any; // { days: { name: string, exercises: { exerciseId: string, sets: number, reps: string }[] }[] }

  @Column({ type: 'json', nullable: true })
  comparisonReport: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkoutLog, (log) => log.routine)
  workoutLogs: WorkoutLog[];
}
