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

export type GenerateResult = {
  outputPath: string
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
      generate: (options: GenerateOptions) => Promise<GenerateResult>
      onProgress: (callback: (message: string) => void) => () => void
    }
  }
}
