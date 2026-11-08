import {Router} from 'express';
import {taskSchema, updateTaskSchema} from './task.schemas';
import {createTask, getTask, getTaskLinenHistory, getTasks, patchTask} from './task.service';

export const taskRoutes = Router();

taskRoutes.get('/', async (_req, res) => {
  res.json(await getTasks());
});

taskRoutes.get('/:id', async (req, res) => {
  res.json(await getTask(req.params.id));
});

taskRoutes.get('/:id/linen/history', async (req, res) => {
  res.json(await getTaskLinenHistory(req.params.id));
});

taskRoutes.post('/', async (req, res) => {
  const task = taskSchema.parse(req.body);
  res.status(201).json(await createTask(task));
});

taskRoutes.patch('/:id', async (req, res) => {
  const changes = updateTaskSchema.parse(req.body);
  res.json(await patchTask(req.params.id, changes));
});
