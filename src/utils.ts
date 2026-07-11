export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.flac', '.ogg']

export function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath
}

export function isSupportedAudio(filePath: string) {
  const lowerPath = filePath.toLowerCase()
  return AUDIO_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))
}

export function isEnglishOnlyModel(filePath: string) {
  return /\.en(?:\.|$)/i.test(fileName(filePath))
}

export function outputNameFor(audioPath: string, defaultOutputPath?: string, now = new Date()) {
  const name = fileName(audioPath || 'audio.mp3').replace(/\.[^.]+$/, '')
  const separator = audioPath.includes('\\') ? '\\' : '/'
  const audioDir = audioPath.slice(0, Math.max(0, audioPath.lastIndexOf(separator)))
  const defaultDir = defaultOutputPath?.slice(0, Math.max(0, defaultOutputPath.lastIndexOf(separator)))
  const outputDir = defaultDir || audioDir || '.'
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${outputDir}${separator}${name}-${stamp}.srt`
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}
