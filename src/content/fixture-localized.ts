import rows from '../../content/samples/zh-TW.json';
import { sampleContentPack } from './sample';
import { contentTranslationSchema } from './pack';
import { translatedEdition } from './localization';

/** Explicit test/tool fixture only. Production Workers never import this module. */
export const localizedFixturePack = translatedEdition(
  sampleContentPack,
  rows.map((row) => contentTranslationSchema.parse(row)),
  {
    ...sampleContentPack.version,
    id: 'content_sample_localized_v1' as typeof sampleContentPack.version.id,
    name: 'Original localized fixture pack v1',
  },
);
