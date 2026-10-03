import data from '../../content/samples/pack.json';
import { contentPackSchema } from './pack';

export const sampleContentPack = contentPackSchema.parse(data);
