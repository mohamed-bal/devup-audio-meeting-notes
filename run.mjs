import { open, unlink } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { POLICY, check, normalizeTranscript, parseCompletion, makeReviewPacket } from './core.mjs';
import { transcribe, extract } from './api.mjs';

export async function readAudio(path) {
  const extension = extname(path).toLowerCase();
  const mime = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav' }[extension];
  check(mime, 'AUDIO_EXTENSION_NOT_SUPPORTED');
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    check(stat.isFile() && stat.size > 0 && stat.size <= POLICY.audioBytes,
      'AUDIO_FILE_POLICY_FAILED');
    const buffer = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      check(bytesRead > 0, 'AUDIO_FILE_CHANGED');
      offset += bytesRead;
    }
    const probe = Buffer.alloc(1);
    const extra = await handle.read(probe, 0, 1, offset);
    check(extra.bytesRead === 0 && (await handle.stat()).size === stat.size,
      'AUDIO_FILE_CHANGED');
    return { bytes: buffer, mime, filename: `meeting${extension}` };
  } finally { await handle.close(); }
}

export async function main(args = process.argv.slice(2), env = process.env) {
  check(args.length === 2, 'USAGE_node_run.mjs_AUDIO_OUTPUT.json');
  const key = env.DEVUP_API_KEY;
  check(typeof key === 'string' && key.trim(), 'MISSING_API_KEY');
  check(env.DEVUP_AUDIO_MODEL?.trim() && env.DEVUP_CHAT_MODEL?.trim(), 'MISSING_MODEL_IDS');
  check([key, env.DEVUP_AUDIO_MODEL, env.DEVUP_CHAT_MODEL]
    .every(v => !v.startsWith('REPLACE_')), 'REPLACE_EXAMPLE_CONFIGURATION');
  const output = resolve(args[1]);
  // Reserve the destination before paid calls; never overwrite an existing report.
  const destination = await open(output, 'wx', 0o600);
  let saved = false;
  try {
    const audio = await readAudio(args[0]);
    const transcript = await transcribe(audio.bytes, audio.filename, audio.mime,
      key, env.DEVUP_AUDIO_MODEL);
    const blocks = normalizeTranscript(transcript.value);
    const completion = await extract(blocks, key, env.DEVUP_CHAT_MODEL);
    const packet = makeReviewPacket(blocks, parseCompletion(completion.value), {
      audioModel: env.DEVUP_AUDIO_MODEL, chatModel: env.DEVUP_CHAT_MODEL,
      transcriptionRequestId: transcript.requestId, extractionRequestId: completion.requestId,
    });
    await destination.writeFile(JSON.stringify(packet, null, 2) + '\n');
    saved = true;
    console.log('Draft saved. Review every item against the recording.');
  } finally {
    await destination.close();
    if (!saved) await unlink(output).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    const code = /^[A-Z0-9_.]+$/.test(error.message) ? error.message : 'LOCAL_IO_ERROR';
    console.error(JSON.stringify({ code, status: error.status ?? null,
      requestId: error.requestId ?? null }));
    process.exitCode = 1;
  });
}
