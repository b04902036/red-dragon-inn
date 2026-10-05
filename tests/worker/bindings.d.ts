import type { D1Migration } from '@cloudflare/vitest-plugin';

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
      TEST_SAMPLE_SEED: D1Migration[];
      TEST_RDI1_PACK_JSON: string;
      TEST_RDI1_V1_PACK_JSON: string;
    }
  }
}
