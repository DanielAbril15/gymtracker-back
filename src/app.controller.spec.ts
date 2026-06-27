import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API running message', () => {
      expect(appController.getRoot().message).toContain('GymTracker API is running');
    });
  });

  describe('health', () => {
    it('should return status ok', () => {
      expect(appController.getHealth().status).toBe('ok');
    });
  });
});
