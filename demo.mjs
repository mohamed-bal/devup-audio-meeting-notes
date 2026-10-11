import { readFile } from 'node:fs/promises';
import { normalizeTranscript, makeReviewPacket } from './core.mjs';

const fixture = async name => JSON.parse(await readFile(
  new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const blocks = normalizeTranscript(await fixture('transcription'));
const notes = await fixture('notes');
console.log(JSON.stringify(makeReviewPacket(blocks, notes, {
  mode: 'offline_fixture', generatedByModel: false, transcribedFromAudio: false,
}), null, 2));
