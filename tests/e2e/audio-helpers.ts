import type { Page } from '@playwright/test';
export async function mockPlayback(page: Page) {
  await page.addInitScript(String.raw`(() => {
    const state = window;
    state.__audioCalls = [];
    state.__audioCreated = [];
    const music = '/audio/bgm/the-old-tower-inn.wav';
    Object.defineProperty(window, 'Audio', {
      value: class extends EventTarget {
        loop = false;
        volume = 1;
        currentTime = 0;
        constructor(path) {
          super();
          this.path = path;
          state.__audioCreated.push(path);
        }
        play() {
          state.__audioCalls.push(this.path);
          return Promise.resolve();
        }
        pause() {}
      },
    });
    // Policy journeys mock both playback backends; a separate test uses native decoding.
    Object.defineProperty(window, 'AudioContext', {
      value: class {
        currentTime = 0;
        destination = {};
        constructor() {
          state.__audioCreated.push(music);
        }
        resume() {
          return Promise.resolve();
        }
        close() {
          return Promise.resolve();
        }
        decodeAudioData() {
          return Promise.resolve({ duration: 50 });
        }
        createGain() {
          return { gain: { value: 1 }, connect() {}, disconnect() {} };
        }
        createBufferSource() {
          return {
            buffer: null,
            loop: false,
            connect() {},
            disconnect() {},
            stop() {},
            start() {
              state.__audioCalls.push(music);
            },
          };
        }
      },
    });
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) =>
      input === music
        ? Promise.resolve(new Response(new ArrayBuffer(8)))
        : nativeFetch(input, init);
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) {
        super(url, protocols);
        state.__roomSocket = this;
      }
    };
  })();`);
}
export async function playbackCount(page: Page, kind: 'music' | 'chime') {
  return (await page.evaluate(
    `window.__audioCalls.filter(path=>path&&path.includes('${kind === 'music' ? 'the-old-tower-inn' : 'turn-chime'}')).length`,
  )) as number;
}
