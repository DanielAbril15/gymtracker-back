import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Routine } from './routine.entity';
import { WorkoutLog } from './workout-log.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'float' })
  weight: number;

  @Column({ nullable: true, type: 'int' })
  height: number;

  @Column({ nullable: true, type: 'int' })
  age: number;

  @Column({ nullable: true, type: 'varchar', length: 20 })
  gender: string; // "male" | "female" | "neutral"

  @Column({ nullable: true, type: 'varchar', length: 20 })
  experienceLevel: string; // "beginner" | "intermediate" | "advanced"

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Routine, (routine) => routine.user)
  routines: Routine[];

  @OneToMany(() => WorkoutLog, (log) => log.user)
  workoutLogs: WorkoutLog[];
}
