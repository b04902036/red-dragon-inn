import { loadRdi1Rdi2ReleaseInput } from './rdi1-rdi2-release-input';
import { verifyRdi1Rdi2Release } from '../src/content/rdi1-rdi2-release';
try {
  const input = loadRdi1Rdi2ReleaseInput();
  const report = verifyRdi1Rdi2Release(input);
  process.stdout.write(
    JSON.stringify(
      {
        scope: 'RDI1_RDI2_EIGHT_CHARACTER_MILESTONE',
        ...report,
        sourceHashes: { rdi1: input.rdi1Hashes, rdi2: input.rdi2Audit.hashes },
        teamRuntime: 'NON_BLOCKING_TODO',
      },
      null,
      2,
    ) + '\n',
  );
  if (!report.valid) process.exitCode = 1;
} catch (error) {
  process.stderr.write(
    `Release audit failed: ${error instanceof Error ? error.message : 'invalid input'}\n`,
  );
  process.exitCode = 1;
}
