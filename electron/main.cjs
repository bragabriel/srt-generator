const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const MODELS_DIR = process.env.SRT_GENERATOR_MODELS_DIR || path.join(os.homedir(), '.srt-generator', 'models')
const DEFAULT_PROMPT = ''

function createWindow() {
  const win = new BrowserWindow({
    width: 860,
    height: 680,
    minWidth: 720,
    minHeight: 600,
    maxWidth: 1040,
    maxHeight: 800,
    fullscreenable: false,
    title: 'SRT Generator',
    backgroundColor: '#eef1f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return
    event.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    return
  }

  win.loadFile(path.join(__dirname, '../dist/index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

function sendProgress(message) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('srt:progress', message)
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, shell: false })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      if (options.progress) options.progress(text)
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      if (options.progress) options.progress(text)
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`))
      }
    })
  })
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function listModels() {
  try {
    const names = await fs.readdir(MODELS_DIR)
    return names
      .filter((name) => /^ggml-.*\.bin$/.test(name))
      .sort((a, b) => Number(b.includes('small')) - Number(a.includes('small')) || a.localeCompare(b))
      .map((name) => path.join(MODELS_DIR, name))
  } catch {
    return []
  }
}

async function resolveCommand(command) {
  const candidates = [
    ...String(process.env.PATH || '').split(path.delimiter).filter(Boolean).map((directory) => path.join(directory, command)),
    path.join('/opt/homebrew/bin', command),
    path.join('/usr/local/bin', command),
  ]

  for (const candidate of [...new Set(candidates)]) {
    if (await fileExists(candidate)) return candidate
  }

  return null
}

function timestampForFile() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('')
}

function defaultOutputFor(audioPath) {
  const parsed = path.parse(audioPath || 'audio.mp3')
  return path.join(os.homedir(), 'Desktop', `${parsed.name}-${timestampForFile()}.srt`)
}

function parseSrtTime(value) {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/)
  if (!match) throw new Error(`Invalid SRT timestamp: ${value}`)
  const [, h, m, s, ms] = match
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000
}

function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(totalMs / 3600000)
  const m = Math.floor((totalMs % 3600000) / 60000)
  const s = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function parseSrt(content) {
  return content
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length >= 3 && lines[1].includes('-->'))
    .map((lines) => {
      const [startRaw, endRaw] = lines[1].split('-->').map((part) => part.trim())
      return {
        start: parseSrtTime(startRaw),
        end: parseSrtTime(endRaw),
        text: lines.slice(2).join(' ').replace(/\s+/g, ' ').trim(),
      }
    })
}

function splitText(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean)
  const parts = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current) parts.push(current)

    if (word.length <= maxChars) {
      current = word
    } else {
      for (let index = 0; index < word.length; index += maxChars) {
        parts.push(word.slice(index, index + maxChars))
      }
      current = ''
    }
  }

  if (current) parts.push(current)
  return parts
}

function expandSplitBlocks(blocks, maxChars) {
  const expanded = []

  for (const block of blocks) {
    const parts = splitText(block.text, maxChars)
    if (parts.length <= 1) {
      expanded.push(block)
      continue
    }

    const span = Math.max(0.001, block.end - block.start)
    const total = parts.reduce((sum, part) => sum + Math.max(1, part.length), 0)
    let cursor = block.start

    for (const part of parts) {
      const duration = span * Math.max(1, part.length) / total
      expanded.push({ start: cursor, end: cursor + duration, text: part })
      cursor += duration
    }
  }

  return expanded
}

function mergeShortBlocks(blocks, maxChars, minDuration) {
  let items = blocks.map((block) => ({ ...block }))
  let changed = true

  while (changed) {
    changed = false
    const merged = []

    for (let index = 0; index < items.length; index += 1) {
      const block = items[index]
      const duration = block.end - block.start

      if (duration < minDuration && merged.length > 0) {
        const previous = merged[merged.length - 1]
        const text = `${previous.text} ${block.text}`.trim()
        if (text.length <= maxChars) {
          previous.end = block.end
          previous.text = text
          changed = true
          continue
        }
      }

      if (duration < minDuration && index + 1 < items.length) {
        const next = items[index + 1]
        const text = `${block.text} ${next.text}`.trim()
        if (text.length <= maxChars) {
          merged.push({ start: block.start, end: next.end, text })
          changed = true
          index += 1
          continue
        }
      }

      merged.push(block)
    }

    items = merged
  }

  return items
}

function borrowTimeForShortBlocks(blocks, minDuration) {
  const items = blocks.map((block) => ({ ...block }))

  for (let index = 0; index < items.length; index += 1) {
    const duration = items[index].end - items[index].start
    if (duration >= minDuration) continue

    let need = minDuration - duration

    if (index > 0 && need > 0) {
      const previousDuration = items[index - 1].end - items[index - 1].start
      const take = Math.min(need, Math.max(0, previousDuration - minDuration))
      items[index - 1].end -= take
      items[index].start -= take
      need -= take
    }

    if (index + 1 < items.length && need > 0) {
      const nextDuration = items[index + 1].end - items[index + 1].start
      const take = Math.min(need, Math.max(0, nextDuration - minDuration))
      items[index].end += take
      items[index + 1].start += take
    }
  }

  return items
}

function normalizeBounds(blocks, speechEnd) {
  const clean = []
  let previousEnd = 0

  for (const block of blocks) {
    const start = Math.max(previousEnd, block.start)
    const end = Math.min(speechEnd, Math.max(start + 0.001, block.end))
    if (end <= start || start >= speechEnd) continue
    clean.push({ ...block, start, end })
    previousEnd = end
  }

  return clean
}

async function detectSpeechEnd(ffmpegCommand, audioPath, fallbackEnd) {
  const startAt = Math.max(0, fallbackEnd - 30)
  const { stderr } = await run(ffmpegCommand, [
    '-hide_banner',
    '-nostats',
    '-ss',
    String(startAt),
    '-i',
    audioPath,
    '-af',
    'silencedetect=noise=-35dB:d=0.35',
    '-f',
    'null',
    '-',
  ])

  const matches = [...stderr.matchAll(/silence_start:\s*([0-9.]+)/g)]
  if (matches.length === 0) return fallbackEnd

  const silenceStart = startAt + Number(matches[matches.length - 1][1])
  if (!Number.isFinite(silenceStart)) return fallbackEnd

  return Math.min(fallbackEnd, silenceStart)
}

function writeSrt(blocks) {
  return `${blocks
    .map((block, index) => `${index + 1}\n${formatSrtTime(block.start)} --> ${formatSrtTime(block.end)}\n${block.text}`)
    .join('\n\n')}\n`
}

function validateBlocks(blocks, maxChars) {
  let previousEnd = 0
  let maxLength = 0
  let minDuration = Number.POSITIVE_INFINITY

  for (const block of blocks) {
    if (block.start < previousEnd - 0.001) throw new Error('Generated SRT has overlapping timestamps')
    if (block.text.length > maxChars) throw new Error(`Generated line exceeds ${maxChars} chars: ${block.text}`)
    previousEnd = block.end
    maxLength = Math.max(maxLength, block.text.length)
    minDuration = Math.min(minDuration, block.end - block.start)
  }

  return {
    blocks: blocks.length,
    maxChars: maxLength,
    minDuration,
    lastEnd: blocks.length ? blocks[blocks.length - 1].end : 0,
  }
}

ipcMain.handle('app:defaults', async () => {
  await fs.mkdir(MODELS_DIR, { recursive: true })
  const models = await listModels()
  const smallModel = models.find((model) => path.basename(model).includes('small'))

  return {
    models,
    modelPath: smallModel || models[0] || '',
    outputPath: defaultOutputFor('audio.mp3'),
    prompt: DEFAULT_PROMPT,
    maxChars: 32,
    minDuration: 0.6,
    language: 'pt',
  }
})

ipcMain.handle('app:system-status', async () => {
  await fs.mkdir(MODELS_DIR, { recursive: true })
  const [whisperPath, ffmpegPath, models] = await Promise.all([
    resolveCommand('whisper-cli'),
    resolveCommand('ffmpeg'),
    listModels(),
  ])

  return { whisper: Boolean(whisperPath), ffmpeg: Boolean(ffmpegPath), models: models.length, modelsDir: MODELS_DIR }
})

ipcMain.handle('file:show-in-folder', (_event, filePath) => {
  if (typeof filePath === 'string' && filePath) shell.showItemInFolder(filePath)
})

ipcMain.handle('dialog:audio', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Escolha o áudio',
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg'] }],
  })

  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:model', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Escolha o modelo Whisper',
    defaultPath: MODELS_DIR,
    properties: ['openFile'],
    filters: [{ name: 'Whisper model', extensions: ['bin'] }],
  })

  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:output', async (_event, defaultPath) => {
  const result = await dialog.showSaveDialog({
    title: 'Salvar SRT',
    defaultPath: defaultPath || defaultOutputFor('audio.mp3'),
    filters: [{ name: 'SRT', extensions: ['srt'] }],
  })

  return result.canceled ? null : result.filePath
})

ipcMain.handle('srt:generate', async (_event, options) => {
  const audioPath = String(options.audioPath || '')
  const modelPath = String(options.modelPath || '')
  const outputPath = String(options.outputPath || defaultOutputFor(audioPath))
  const maxChars = Math.max(12, Math.min(80, Number(options.maxChars) || 32))
  const minDuration = Math.max(0.2, Math.min(3, Number(options.minDuration) || 0.6))
  const language = String(options.language || 'pt')
  const prompt = String(options.prompt || DEFAULT_PROMPT)

  if (!(await fileExists(audioPath))) throw new Error('Audio file not found')
  if (!(await fileExists(modelPath))) throw new Error('Model file not found')
  const [whisperCommand, ffmpegCommand] = await Promise.all([
    resolveCommand('whisper-cli'),
    resolveCommand('ffmpeg'),
  ])
  if (!whisperCommand) throw new Error('whisper-cli was not found. Install it with: brew install whisper-cpp')
  if (!ffmpegCommand) throw new Error('ffmpeg was not found. Install it with: brew install ffmpeg')

  const tempBase = path.join(os.tmpdir(), `srt-maker-${Date.now()}`)
  const tempSrt = `${tempBase}.srt`

  sendProgress('Rodando Whisper...')
  try {
    const whisperArgs = ['-m', modelPath, '-f', audioPath, '-l', language]
    if (prompt) whisperArgs.push('--prompt', prompt)
    whisperArgs.push('-ml', String(maxChars), '-sow', '-osrt', '-np', '-of', tempBase)

    await run(whisperCommand, whisperArgs, {
      progress: (text) => {
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        const last = lines[lines.length - 1]
        if (last && last.includes('-->')) sendProgress(last)
      },
    })

    sendProgress('Finalizing subtitles...')
    const raw = await fs.readFile(tempSrt, 'utf8')
    let blocks = parseSrt(raw)
      .filter((block) => block.text && !/\[[^\]]+\]/.test(block.text))

    if (blocks.length === 0) throw new Error('Whisper did not produce subtitle blocks')

    const rawLastEnd = blocks[blocks.length - 1].end
    const speechEnd = options.trimSilence === false ? rawLastEnd : await detectSpeechEnd(ffmpegCommand, audioPath, rawLastEnd)

    blocks = blocks
      .map((block) => ({ ...block, end: Math.min(block.end, speechEnd) }))
      .filter((block) => block.start < speechEnd && block.end > block.start)

    blocks = expandSplitBlocks(blocks, maxChars)
    blocks = mergeShortBlocks(blocks, maxChars, minDuration)
    blocks = borrowTimeForShortBlocks(blocks, minDuration)
    blocks = normalizeBounds(blocks, speechEnd)

    const stats = validateBlocks(blocks, maxChars)
    await fs.writeFile(outputPath, writeSrt(blocks), 'utf8')

    sendProgress(`Saved to ${outputPath}`)
    return { outputPath, stats, preview: blocks.slice(0, 3).map((block) => block.text) }
  } finally {
    await fs.rm(tempSrt, { force: true })
  }
})
