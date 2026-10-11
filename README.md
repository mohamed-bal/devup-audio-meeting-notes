# DEVUP AI: evidence-linked meeting-note draft

## Published tutorial

[Build Evidence-Linked Meeting Notes from Audio with DEVUP AI and Node.js](https://dev.to/mohamed_bal/build-evidence-linked-meeting-notes-from-audio-with-devup-ai-and-nodejs-11fe)

Follow the published tutorial for the implementation walkthrough, evidence checks,
and human-review procedure. This repository contains the companion code and offline examples.

A dependency-free Node.js 24 CLI using two documented public API routes.
It transcribes a local MP3/WAV, extracts proposed decisions/actions/questions,
validates literal evidence, and saves a private JSON draft for human review.
It does not send messages, create tasks, or approve decisions.

## Offline first

```bash
node --test meeting.test.mjs
node demo.mjs
```

The bilingual fixtures and timestamps are fictional. Neither command makes an
API request. The suite has 47 tests. These are application/contract tests, not
live API compatibility tests or model-quality measurements.

## Live configuration

1. Use Node.js 24.
2. Copy `.env.example` to `.env` and privately replace all three values.
3. Select an audio model supporting your actual language(s) and a chat model
   explicitly supporting JSON Schema and the requested output-token budget.
4. Start with a short MP3/WAV you are permitted to process. Play it back and
   manually check transcription, quotes, assignment, and deadlines.

```bash
node --env-file=.env run.mjs ./meeting.wav ./review-001.json
```

The selected API calls can incur usage charges. There are no automatic retries.
An existing output file is not overwritten; choose a new filename on rerun.
Failed runs normally remove the reserved incomplete file. Process crashes can
leave an empty/partial file; only parseable, complete draft packets are usable.

## Application policy (not documented DEVUP AI limits)

- Local trusted input: regular MP3/WAV file, at most 20 MiB.
- Transcript: at most 20,000 JavaScript string code units and 250 segments.
- API response: at most 1 MiB; transcription deadline 120 s, extraction 60 s.
- At most 30 items, each with 1-5 literal quotations.
- No audio decoding, duration measurement, speaker diarization or public upload
  server is implemented. Filename extension is not file-content verification.
- Timed segments are used when supplied. Text-only responses stay untimed.
- Source hash covers normalized transcript blocks, not audio bytes and not
  evidence that the recording itself is authentic.
- Literal quote/name/date checks cannot prove semantic entailment or ASR accuracy.
- All packets remain drafts; semantic review against audio is mandatory.

## Files

- `core.mjs`: normalizer, request/schema builder, completion parser, validators.
- `api.mjs`: fixed-host multipart/JSON calls, bounded body reads, deadline/errors.
- `run.mjs`: local file reader and live CLI.
- `demo.mjs`, `fixtures/`: offline example with Arabic and French source text.
- `meeting.test.mjs`: deterministic offline suite, including a counterexample
  showing that a matching quote can still accompany an incorrect statement.

## Primary references

- https://docs.devupai.com/docs/speech-recognition
- https://docs.devupai.com/docs/structured-outputs
- https://docs.devupai.com/docs/chat
- https://nodejs.org/api/globals.html
- https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects

Tutorial code was tested on Node.js v24.19.0. No live credentials were used.
