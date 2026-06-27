import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ExercisesModule } from './exercises/exercises.module';
import { RoutinesModule } from './routines/routines.module';
import { WorkoutLogsModule } from './workout-logs/workout-logs.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExportModule } from './export/export.module';
import { User, Exercise, Routine, WorkoutLog, LoggedExercise, WorkoutSet } from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: Number(configService.get<number>('DB_PORT')) || 3306,
        username: configService.get<string>('DB_USERNAME') || 'gymuser',
        password: configService.get<string>('DB_PASSWORD') || 'root',
        database: configService.get<string>('DB_DATABASE') || 'gymtracker',
        entities: [User, Exercise, Routine, WorkoutLog, LoggedExercise, WorkoutSet],
        synchronize: true, // For development sync
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get<number>('THROTTLE_TTL')) || 60,
          limit: Number(config.get<number>('THROTTLE_LIMIT')) || 100,
        },
      ],
    }),
    AuthModule,
    ExercisesModule,
    RoutinesModule,
    WorkoutLogsModule,
    DashboardModule,
    ExportModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule { }
