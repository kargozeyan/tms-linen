import cors from 'cors';
import express, {type NextFunction, type Request, type Response} from 'express';
import {z} from 'zod';
import {eventRoutes} from './modules/events/event.routes';
import {taskRoutes} from './modules/tasks/task.routes';
import {HttpError} from './shared/errors';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/events', eventRoutes);
  app.use('/tasks', taskRoutes);
  app.use(rejectUnknownRoute);
  app.use(handleError);
  return app;
}

function rejectUnknownRoute(req: Request) {
  throw new HttpError(404, `Route ${req.method} ${req.path} not found`);
}

function handleError(error: any, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof z.ZodError) {
    res.status(400).json({error: z.prettifyError(error)});
  } else if (error instanceof HttpError || error?.expose) {
    res.status(error.status).json({error: error.message});
  } else {
    console.error(error);
    res.status(500).json({error: 'Internal server error'});
  }
}
