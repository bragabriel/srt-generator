import { useEffect, useRef, useState } from 'react'
import './App.css'
import type { AppDefaults, GenerateOptions, GenerateResult, SystemStatus } from './types'

const audioExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg']
const languages = [
  { code: 'pt', label: 'Portuguese' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
]
type ElectronFile = File & { path?: string }

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath
}

function isEnglishOnlyModel(filePath: string) {
  return /\.en(?:\.|$)/i.test(fileName(filePath))
}

function outputNameFor(audioPath: string, defaultOutputPath?: string) {
  const name = fileName(audioPath || 'audio.mp3').replace(/\.[^.]+$/, '')
  const separator = audioPath.includes('\\') ? '\\' : '/'
  const audioDir = audioPath.slice(0, Math.max(0, audioPath.lastIndexOf(separator)))
  const defaultDir = defaultOutputPath?.slice(0, Math.max(0, defaultOutputPath.lastIndexOf(separator)))
  const outputDir = defaultDir || audioDir || '.'
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${outputDir}${separator}${name}-${stamp}.srt`
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system')
  const [defaults, setDefaults] = useState<AppDefaults | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [audioPath, setAudioPath] = useState('')
  const [modelPath, setModelPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [maxChars, setMaxChars] = useState(32)
  const [minDuration, setMinDuration] = useState(0.6)
  const [language, setLanguage] = useState('pt')
  const [prompt, setPrompt] = useState('')
  const [trimSilence, setTrimSilence] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState('')
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme')
      localStorage.removeItem('theme')
    } else {
      document.documentElement.dataset.theme = theme
      localStorage.setItem('theme', theme)
    }
  }, [theme])

  useEffect(() => {
    Promise.all([window.srtMaker.getDefaults(), window.srtMaker.getSystemStatus()]).then(([data, status]) => {
      setDefaults(data)
      setSystemStatus(status)
      setModelPath(data.modelPath)
      setOutputPath(data.outputPath)
      setMaxChars(data.maxChars)
      setMinDuration(data.minDuration)
      setLanguage(data.language)
      setPrompt(data.prompt)
    })

    return window.srtMaker.onProgress((message) => {
      setLog((current) => [...current.slice(-80), message])
    })
  }, [])

  const languageOptions = isEnglishOnlyModel(modelPath) ? languages.filter(({ code }) => code === 'en') : languages
  const setupReady = Boolean(systemStatus?.whisper && systemStatus.ffmpeg && systemStatus.models)
  const canGenerate = Boolean(audioPath && modelPath && outputPath && setupReady && !isGenerating)

  useEffect(() => {
    if (!languageOptions.some((option) => option.code === language)) setLanguage(languageOptions[0].code)
  }, [language, languageOptions])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  function selectAudio(selected: string) {
    setAudioPath(selected)
    setOutputPath(outputNameFor(selected, defaults?.outputPath))
    setResult(null)
    setError('')
  }

  async function chooseAudio() {
    const selected = await window.srtMaker.chooseAudio()
    if (selected) selectAudio(selected)
  }

  async function chooseModel() {
    const selected = await window.srtMaker.chooseModel()
    if (selected) setModelPath(selected)
  }

  async function chooseOutput() {
    const selected = await window.srtMaker.chooseOutput(outputPath || outputNameFor(audioPath))
    if (selected) setOutputPath(selected)
  }

  async function generate() {
    setIsGenerating(true)
    setError('')
    setResult(null)
    setLog(['Starting transcription…'])
    const options: GenerateOptions = { audioPath, modelPath, outputPath, maxChars, minDuration, language, prompt, trimSilence }

    try {
      setResult(await window.srtMaker.generate(options))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setIsGenerating(false)
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const droppedPath = (event.dataTransfer.files[0] as ElectronFile | undefined)?.path
    if (droppedPath && audioExtensions.some((extension) => droppedPath.toLowerCase().endsWith(extension))) selectAudio(droppedPath)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span>CC</span></div>
        <div>
          <h1>SRT Generator</h1>
          <p>Local subtitles, without the cloud.</p>
        </div>
        <label className="theme-control">
          <span aria-hidden="true">◐</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label="Color theme">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <a className="star-button" href="https://github.com/bragabriel/srt-generator" aria-label="Star SRT Generator on GitHub">
          <span aria-hidden="true">☆</span> Star this project
        </a>
      </header>

      <section className="workspace">
        <div className="glass-panel form-panel">
          <div className="section-heading">
            <div><span className="eyebrow">Source</span><h2>Choose your audio</h2></div>
            {audioPath && <span className="status-pill ready"><i /> Ready</span>}
          </div>

          <div
            className={`dropzone ${dragging ? 'dragging' : ''} ${audioPath ? 'has-file' : ''}`}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="file-icon" aria-hidden="true">♪</div>
            <div className="dropzone-copy">
              <strong>{audioPath ? fileName(audioPath) : 'Drop an audio file here'}</strong>
              <p>{audioPath || 'MP3, WAV, M4A, FLAC or OGG'}</p>
            </div>
            <button type="button" className="secondary" onClick={chooseAudio}>{audioPath ? 'Replace' : 'Browse'}</button>
          </div>

          <label className="field">
            <span>Save subtitle as</span>
            <div className="inline-control">
              <input value={outputPath} onChange={(event) => setOutputPath(event.target.value)} aria-label="Output path" />
              <button type="button" className="icon-button" onClick={chooseOutput} aria-label="Choose output location">•••</button>
            </div>
          </label>

          <div className="model-summary">
            <label>
              <span className="eyebrow">Model</span>
              <select value={modelPath} onChange={(event) => setModelPath(event.target.value)} aria-label="Whisper model">
                {defaults?.models.map((model) => <option key={model} value={model}>{fileName(model)}</option>)}
                {modelPath && !defaults?.models.includes(modelPath) && <option value={modelPath}>{fileName(modelPath)}</option>}
                {!modelPath && <option value="">No model installed</option>}
              </select>
            </label>
            <button type="button" className="model-browse" onClick={chooseModel}>Browse…</button>
          </div>

          <details className="advanced" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
            <summary>Advanced settings <span>{advancedOpen ? '−' : '+'}</span></summary>
            <div className="advanced-content">
              <label className="field"><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}>{languageOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
              <label className="field"><span>Characters per line</span><input type="number" min={12} max={80} value={maxChars} onChange={(event) => setMaxChars(Number(event.target.value))} /></label>
              <label className="field"><span>Minimum duration</span><input type="number" min={0.2} max={3} step={0.1} value={minDuration} onChange={(event) => setMinDuration(Number(event.target.value))} /></label>
              <label className="toggle"><input type="checkbox" checked={trimSilence} onChange={(event) => setTrimSilence(event.target.checked)} /><span>Trim trailing silence and music <small>(recommended)</small></span></label>
              <label className="field prompt"><span>Vocabulary hints (comma-separated)</span><textarea rows={2} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. PostgreSQL, OpenAI, product name" /></label>
            </div>
          </details>

          <button className="primary" type="button" onClick={generate} disabled={!canGenerate}>
            {isGenerating ? <><span className="spinner" /> Generating subtitle…</> : 'Generate SRT'}
          </button>
        </div>

        <aside className="glass-panel context-panel">
          {result ? (
            <div className="context-content success-state">
              <div className="success-icon">✓</div><span className="eyebrow">Complete</span><h2>Your subtitle is ready</h2>
              <p className="context-copy">Created locally and saved to your chosen folder.</p>
              <div className="result-card"><strong>{fileName(result.outputPath)}</strong><span>{result.outputPath}</span><button type="button" className="secondary" onClick={() => window.srtMaker.showInFolder(result.outputPath)}>Show in Finder</button></div>
              <div className="stats"><div><strong>{result.stats.blocks}</strong><span>Captions</span></div><div><strong>{formatDuration(result.stats.lastEnd)}</strong><span>Duration</span></div><div><strong>{result.stats.maxChars}</strong><span>Max chars</span></div></div>
              {result.preview.length > 0 && <div className="preview"><span className="eyebrow">Preview</span>{result.preview.map((line, index) => <p key={line}><b>{index + 1}</b>{line}</p>)}</div>}
            </div>
          ) : error ? (
            <div className="context-content error-state"><div className="error-icon">!</div><span className="eyebrow">Something went wrong</span><h2>Couldn’t create the subtitle</h2><p className="context-copy">Check your setup and try again. The technical details can help diagnose the issue.</p><button type="button" className="secondary" onClick={() => setDetailsOpen(true)}>View details</button></div>
          ) : isGenerating ? (
            <div className="context-content processing-state"><div className="progress-orbit"><span /></div><span className="eyebrow">Processing locally</span><h2>Listening to your audio</h2><p className="context-copy">This can take a few minutes. Your audio never leaves this Mac.</p><div className="activity-line">{log.at(-1) || 'Preparing…'}</div><button type="button" className="text-button" onClick={() => setDetailsOpen(true)}>View details</button></div>
          ) : (
            <div className="context-content welcome-state"><div className="waveform" aria-hidden="true">{[12, 24, 17, 34, 22, 42, 28, 16, 31, 19, 26].map((height, index) => <i key={index} style={{ height }} />)}</div><span className="eyebrow">Private by design</span><h2>Studio-ready subtitles, made locally.</h2><p className="context-copy">Drop in your audio and turn it into a clean, timed SRT file with whisper.cpp.</p><div className="checklist"><SetupItem label="whisper-cli" ready={systemStatus?.whisper} /><SetupItem label="ffmpeg" ready={systemStatus?.ffmpeg} /><SetupItem label={systemStatus?.models ? `${systemStatus.models} model${systemStatus.models > 1 ? 's' : ''} installed` : 'Whisper model'} ready={Boolean(systemStatus?.models)} /></div>{systemStatus && !setupReady && <a className="setup-link" href="https://github.com/bragabriel/srt-generator#quick-start">Open setup guide ↗</a>}</div>
          )}
          {(log.length > 0 || error) && !isGenerating && <button type="button" className="details-link" onClick={() => setDetailsOpen(true)}>View technical details</button>}
        </aside>
      </section>

      <footer><span>Open source · MIT</span><a href="https://github.com/bragabriel/srt-generator">GitHub</a></footer>

      {detailsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDetailsOpen(false)}><section className="details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Diagnostics</span><h2 id="details-title">Technical details</h2></div><button type="button" className="icon-button" onClick={() => setDetailsOpen(false)} aria-label="Close">×</button></header>{error && <pre className="error-message">{error}</pre>}<div className="log" ref={logRef}>{log.length ? log.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>No activity logged yet.</p>}</div>{systemStatus && <p className="model-location">Models: {systemStatus.modelsDir}</p>}</section></div>}
    </main>
  )
}

function SetupItem({ label, ready }: { label: string; ready?: boolean }) {
  return <div className={ready ? 'complete' : ''}><i>{ready ? '✓' : '×'}</i><span>{label}</span><small>{ready ? 'Ready' : 'Missing'}</small></div>
}

export default App
