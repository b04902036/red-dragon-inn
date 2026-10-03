import type { Page } from '@playwright/test';
export async function mockPlayback(page: Page) {
  await page.addInitScript(
    `window.__audioCalls=[]; window.__audioCreated=[]; window.Audio=class extends EventTarget{loop=false;volume=1;currentTime=0;constructor(path){super();this.path=path;window.__audioCreated.push(path);}play(){window.__audioCalls.push(this.path);return Promise.resolve();}pause(){}}; const NativeSocket=window.WebSocket;window.WebSocket=class extends NativeSocket{constructor(...args){super(...args);window.__roomSocket=this;}};`,
  );
}
export async function playbackCount(page: Page, kind: 'music' | 'chime') {
  return (await page.evaluate(
    `window.__audioCalls.filter(path=>path&&path.includes('${kind === 'music' ? 'the-old-tower-inn' : 'turn-chime'}')).length`,
  )) as number;
}
