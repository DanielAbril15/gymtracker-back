import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { WorkoutLog } from './workout-log.entity';

@Entity('routines')
export class Routine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.routines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkoutLog, (log) => log.routine)
  workoutLogs: WorkoutLog[];
}
