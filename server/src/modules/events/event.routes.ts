import {Router} from 'express';
import {reservationEventSchema} from './event.schemas';
import {handleReservationEvent} from './event.service';

export const eventRoutes = Router();

eventRoutes.post('/reservation', async (req, res) => {
  const event = reservationEventSchema.parse(req.body);
  res.json(await handleReservationEvent(event));
});
