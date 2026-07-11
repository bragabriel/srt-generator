import { describe, expect, it } from 'vitest'
import { fileName, formatDuration, isEnglishOnlyModel, isSupportedAudio, outputNameFor } from './utils'

describe('audio file helpers', () => {
  it('accepts every supported extension regardless of case', () => {
    for (const extension of ['mp3', 'wav', 'm4a', 'flac', 'ogg']) {
      expect(isSupportedAudio(`/audio/clip.${extension.toUpperCase()}`)).toBe(true)
    }
  })

  it('rejects unsupported and misleading extensions', () => {
    expect(isSupportedAudio('/audio/clip.mp4')).toBe(false)
    expect(isSupportedAudio('/audio/clip.mp3.tmp')).toBe(false)
  })

  it('reads file names from macOS and Windows paths', () => {
    expect(fileName('/Users/person/audio.mp3')).toBe('audio.mp3')
    expect(fileName('C:\\Audio\\voice.wav')).toBe('voice.wav')
  })
})

describe('model helpers', () => {
  it('detects English-only Whisper models', () => {
    expect(isEnglishOnlyModel('/models/ggml-base.en.bin')).toBe(true)
    expect(isEnglishOnlyModel('/models/ggml-base.bin')).toBe(false)
  })
})

describe('output helpers', () => {
  it('creates a deterministic SRT name in the configured output folder', () => {
    const now = new Date(2026, 6, 11, 14, 5)
    expect(outputNameFor('/Audio/my.clip.mp3', '/Users/person/Desktop/audio.srt', now))
      .toBe('/Users/person/Desktop/my.clip-20260711-1405.srt')
  })

  it('formats subtitle duration for the result summary', () => {
    expect(formatDuration(125.4)).toBe('2:05')
  })
})
