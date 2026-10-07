import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function verifyAudioBytes(bytes) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.evaluate(async (encoded) => {
      const context = new globalThis.AudioContext({ sampleRate: 44100 });
      try {
        const data = Uint8Array.from(atob(encoded), (char) =>
          char.charCodeAt(0),
        );
        const audio = await context.decodeAudioData(data.buffer);
        if (!(audio.duration > 0) || ![1, 2].includes(audio.numberOfChannels))
          throw new Error('Invalid decoded MP3');
      } finally {
        await context.close();
      }
    }, bytes.toString('base64'));
  } finally {
    await browser.close();
  }
}
export async function verifyDecoding(assets, root = 'public') {
  if (!assets.length) return [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const decoded = [];
    for (const asset of assets) {
      const base64 = (
        await readFile(join(root, asset.assetPath.slice(1)))
      ).toString('base64');
      const result = await page.evaluate(async (encoded) => {
        const context = new globalThis.AudioContext({ sampleRate: 44100 });
        try {
          const bytes = Uint8Array.from(atob(encoded), (char) =>
            char.charCodeAt(0),
          );
          const audio = await context.decodeAudioData(bytes.buffer);
          return {
            duration: audio.duration,
            sampleRate: audio.sampleRate,
            channels: audio.numberOfChannels,
          };
        } finally {
          await context.close();
        }
      }, base64);
      if (
        !(result.duration > 0) ||
        result.sampleRate !== 44100 ||
        ![1, 2].includes(result.channels)
      )
        throw new Error(`Invalid decoded audio: ${asset.assetPath}`);
      decoded.push({ assetPath: asset.assetPath, ...result });
    }
    return decoded;
  } finally {
    await browser.close();
  }
}
