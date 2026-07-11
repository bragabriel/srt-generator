export type GenerateOptions = {
  audioPath: string
  modelPath: string
  outputPath: string
  maxChars: number
  minDuration: number
  language: string
  prompt: string
  trimSilence: boolean
}

export type AppDefaults = {
  models: string[]
  modelPath: string
  outputPath: string
  prompt: string
  maxChars: number
  minDuration: number
  language: string
}

export type SystemStatus = {
  whisper: boolean
  ffmpeg: boolean
  models: number
  modelsDir: string
}

export type GenerateResult = {
  outputPath: string
  preview: string[]
  stats: {
    blocks: number
    maxChars: number
    minDuration: number
    lastEnd: number
  }
}

declare global {
  interface Window {
    srtMaker: {
      chooseAudio: () => Promise<string | null>
      chooseModel: () => Promise<string | null>
      chooseOutput: (defaultPath?: string) => Promise<string | null>
      getDefaults: () => Promise<AppDefaults>
      getSystemStatus: () => Promise<SystemStatus>
      generate: (options: GenerateOptions) => Promise<GenerateResult>
      showInFolder: (filePath: string) => Promise<void>
      onProgress: (callback: (message: string) => void) => () => void
    }
  }
}
