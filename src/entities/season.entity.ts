import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Macrocycle } from './macrocycle.entity';

@Entity('seasons')
export class Season {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string; // e.g. "Temporada 2026"

  @Column({ type: 'varchar', length: 10, nullable: true })
  startDate: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  endDate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Macrocycle, (macrocycle) => macrocycle.season)
  macrocycles: Macrocycle[];
}
