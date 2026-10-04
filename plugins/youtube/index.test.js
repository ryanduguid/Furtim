import { jest } from '@jest/globals';
import { runInNewContext } from 'node:vm';
import * as youtube from './youtube.js';

jest.unstable_mockModule('./youtube.js', () => ({
  ...youtube,
  detectYtDlp: async () => false,
  ensureYtDlp: async () => false,
  hasYtDlp: () => false,
}));

const { register } = await import('./index.js');
const videoId = 'abcdefghijk';
const url = `https://www.youtube.com/watch?v=${videoId}`;
const captions = JSON.stringify({ events: [{ tStartMs: 0, segs: [{ utf8: 'Hello' }] }] });
const tracks = [
  { languageCode: 'en', name: { simpleText: 'English' }, kind: 'asr', baseUrl: 'https://example.invalid/captions' },
  { languageCode: 'fr', baseUrl: 'https://example.invalid/captions-fr' },
];
const languages = [{ code: 'en', name: 'English', kind: 'asr' }, { code: 'fr', name: 'fr', kind: 'manual' }];

async function requestTranscript(scenario, captionTracks = tracks) {
  let handler, listener, polls = 0, output;
  const page = {
    addInitScript: jest.fn(),
    on: (event, callback) => { expect(event).toBe('response'); listener = callback; },
    goto: jest.fn(),
    waitForTimeout: async ms => {
      if (ms !== 500) return;
      polls++;
      if (polls > 40) throw new Error('Caption polling exceeded its limit');
      if (scenario === 'intercept' && polls === 3) {
        await listener({ url: () => `https://example.invalid/api/timedtext?v=${videoId}`, text: async () => captions });
      }
    },
    evaluate: async (fn, arg) => runInNewContext(`(${fn.toString()})(arg)`, {
      arg,
      window: { ytInitialPlayerResponse: {
        videoDetails: { title: 'Fixture' },
        captions: { playerCaptionsTracklistRenderer: { captionTracks } },
      } },
      document: { querySelector: () => ({ play: () => Promise.resolve() }) },
      fetch: async () => ({ ok: scenario === 'direct', text: async () => captions }),
    }),
  };
  const session = { context: { pages: () => [], close: jest.fn(async () => {}) }, pageLeases: new Map() };
  const sessions = new Map([['__yt_transcript__', session]]);
  const closeLeasedPage = jest.fn(async () => {});
  await register({ post: (path, middleware, callback) => {
    expect(path).toBe('/youtube/transcript'); handler = callback;
  } }, {
    log: jest.fn(), config: { navigateTimeoutMs: 1 }, sessions,
    ensureBrowser: async () => {}, getSession: async () => session,
    withUserLimit: async (key, callback) => callback(),
    createLeasedPage: async () => ({ page, lease: {} }), closeLeasedPage,
    normalizeUserId: id => id, validateUrl: () => null, safeError: err => err.message,
    buildProxyUrl: () => null, proxyPool: null,
    failuresTotal: { labels: () => ({ inc: jest.fn() }) },
  });
  const res = { status: jest.fn(() => res), json: data => { output = JSON.parse(JSON.stringify(data)); } };
  await handler({ reqId: 'fixture', body: { url, languages: ['en'] } }, res);
  expect(res.status).not.toHaveBeenCalled();
  expect(closeLeasedPage).toHaveBeenCalledTimes(1);
  expect(session.context.close).toHaveBeenCalledTimes(1);
  expect(sessions.size).toBe(0);
  return { output, polls };
}

describe('YouTube browser transcripts', () => {
  test.each(['direct', 'intercept'])('%s success returns known language summaries', async scenario => {
    const { output, polls } = await requestTranscript(scenario);
    expect(output).toEqual({
      status: 'ok', transcript: '[00:00] Hello', video_url: url, video_id: videoId,
      video_title: 'Fixture', language: 'en', total_words: 2, available_languages: languages,
    });
    expect(polls).toBe(scenario === 'direct' ? 0 : 3);
  });

  test('intercept success returns an empty language list when tracks are unknown', async () => {
    const { output, polls } = await requestTranscript('intercept', []);
    expect(output.status).toBe('ok');
    expect(output.available_languages).toEqual([]);
    expect(polls).toBe(3);
  });

  test('missing captions stop after forty polls and retain the existing error', async () => {
    const { output, polls } = await requestTranscript('no-captions', []);
    expect(output).toEqual({
      status: 'error', code: 404, message: 'No captions available for this video',
      video_url: url, video_id: videoId, title: 'Fixture',
    });
    expect(polls).toBe(40);
  });
});
