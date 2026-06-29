import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Season } from './season.entity';
import { Routine } from './routine.entity';

@Entity('macrocycles')
export class Macrocycle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  seasonId: number;

  @ManyToOne(() => Season, (season) => season.macrocycles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: Season;

  @Column()
  name: string; // e.g. "Macrociclo Hipertrofia 1"

  @Column()
  goal: string; // 'hypertrophy' | 'recomposition' | 'maintenance'

  @Column({ type: 'varchar', length: 10, nullable: true })
  startDate: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  endDate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Routine, (routine) => routine.macrocycle)
  routines: Routine[];
}
