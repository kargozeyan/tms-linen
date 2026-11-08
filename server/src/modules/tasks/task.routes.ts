import {Router} from 'express';
import {taskSchema, updateTaskSchema} from './task.schemas';
import {createTask, patchTask} from './task.service';

export const taskRoutes = Router();

taskRoutes.post('/', async (req, res) => {
  const task = taskSchema.parse(req.body);
  res.status(201).json(await createTask(task));
});

taskRoutes.patch('/:id', async (req, res) => {
  const changes = updateTaskSchema.parse(req.body);
  res.json(await patchTask(req.params.id, changes));
});
