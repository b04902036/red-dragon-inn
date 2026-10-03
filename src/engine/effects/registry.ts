import type { z } from 'zod';
import type { registeredEffectKeySchema } from '../../content/effects';
import { sampleResourceHandler } from './characters/sample-resource';
export const effectHandlers = {
  'sample.adjust-resource': sampleResourceHandler,
  'core.adjust-resource': sampleResourceHandler,
} satisfies Record<
  z.infer<typeof registeredEffectKeySchema>,
  typeof sampleResourceHandler
>;
