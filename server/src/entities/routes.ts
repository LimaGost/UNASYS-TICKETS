import { Router } from 'express';
import { authenticate } from '../auth/middleware';
import * as controller from './controller';

export const entitiesRouter = Router();

entitiesRouter.use(authenticate);

entitiesRouter.get('/:entity', controller.list);
entitiesRouter.get('/:entity/:id', controller.getOne);
entitiesRouter.post('/:entity', controller.create);
entitiesRouter.put('/:entity/:id', controller.update);
entitiesRouter.delete('/:entity/:id', controller.remove);
