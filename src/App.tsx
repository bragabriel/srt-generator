import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { AppDefaults, GenerateOptions, GenerateResult } from './types'

const audioExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg']
const multilingualLanguages = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'Inglês' },
  { code: 'es', label: 'Espanhol' },
  { code: 'fr', label: 'Francês' },
  { code: 'de', label: 'Alemão' },
  { code: 'it', label: 'Italiano' },
]
const englishOnlyLanguages = [{ code: 'en', label: 'Inglês' }]
type ElectronFile = File & { path?: string }

function fileName(filePath: string) {
  return filePath.split('/').pop() || filePath
}

function isEnglishOnlyModel(filePath: string) {
  return /\.en(?:\.|$)/i.test(fileName(filePath))
}

function outputNameFor(audioPath: string, defaultOutputPath?: string) {
  const name = fileName(audioPath || 'audio.mp3').replace(/\.[^.]+$/, '')
  const audioDir = audioPath.replace(/\/[^/]*$/, '')
  const outputDir = defaultOutputPath?.replace(/\/[^/]*$/, '') || audioDir || '.'
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${outputDir}/${name}-${stamp}.srt`
}

function secondsToTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds * 1000))
  const minutes = Math.floor(rounded / 60000)
  const secs = Math.floor((rounded % 60000) / 1000)
  const ms = rounded % 1000
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

function App() {
  const [defaults, setDefaults] = useState<AppDefaults | null>(null)
  const [audioPath, setAudioPath] = useState('')
  const [modelPath, setModelPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [maxChars, setMaxChars] = useState(32)
  const [minDuration, setMinDuration] = useState(0.6)
  const [language, setLanguage] = useState('pt')
  const [prompt, setPrompt] = useState('')
  const [trimSilence, setTrimSilence] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState('')
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.srtMaker.getDefaults().then((data) => {
      setDefaults(data)
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

  const canGenerate = useMemo(
    () => Boolean(audioPath && modelPath && outputPath && !isGenerating),
    [audioPath, modelPath, outputPath, isGenerating],
  )
  const languageOptions = isEnglishOnlyModel(modelPath) ? englishOnlyLanguages : multilingualLanguages
  const statusTitle = isGenerating
    ? 'Processando'
      : result
        ? 'Concluído'
        : canGenerate
          ? 'Pronto para gerar'
          : audioPath
            ? 'Aguardando configuração'
            : 'Aguardando arquivo'

  useEffect(() => {
    if (languageOptions.some((option) => option.code === language)) return
    setLanguage(languageOptions[0].code)
  }, [language, languageOptions])

  useEffect(() => {
    const logElement = logRef.current
    if (!logElement) return
    logElement.scrollTop = logElement.scrollHeight
  }, [log])

  async function chooseAudio() {
    const selected = await window.srtMaker.chooseAudio()
    if (!selected) return
    setAudioPath(selected)
    setOutputPath(outputNameFor(selected, defaults?.outputPath))
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
    setLog(['Iniciando...'])

    const options: GenerateOptions = {
      audioPath,
      modelPath,
      outputPath,
      maxChars,
      minDuration,
      language,
      prompt,
      trimSilence,
    }

    try {
      const data = await window.srtMaker.generate(options)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsGenerating(false)
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files[0] as ElectronFile | undefined
    const droppedPath = file?.path
    if (!droppedPath) return
    const lower = droppedPath.toLowerCase()
    if (!audioExtensions.some((extension) => lower.endsWith(extension))) return
    setAudioPath(droppedPath)
    setOutputPath(outputNameFor(droppedPath, defaults?.outputPath))
  }

  return (
    <main className="shell">
      <section className="workspace">
        <div className="panel">
          <div
            className="dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="dropzone-copy">
              <span className="label">Áudio</span>
              <strong>{audioPath ? fileName(audioPath) : 'audio.mp3'}</strong>
              <p>{audioPath || 'Arraste um arquivo .mp3, .wav ou selecione manualmente.'}</p>
            </div>
            <button type="button" onClick={chooseAudio}>Escolher</button>
          </div>

          <label className="field">
            <span>Modelo</span>
            <div className="inline">
              <select value={modelPath} onChange={(event) => setModelPath(event.target.value)}>
                {defaults?.models.map((model) => (
                  <option key={model} value={model}>{fileName(model)}</option>
                ))}
                {!defaults?.models.includes(modelPath) && modelPath && (
                  <option value={modelPath}>{fileName(modelPath)}</option>
                )}
              </select>
              <button type="button" onClick={chooseModel}>Buscar</button>
            </div>
          </label>

          <label className="field">
            <span>Saída</span>
            <div className="inline">
              <input value={outputPath} onChange={(event) => setOutputPath(event.target.value)} />
              <button type="button" onClick={chooseOutput}>Salvar em</button>
            </div>
          </label>

          <div className="settings-grid">
            <div className="settings-numeric-row">
              <label className="field">
                <span>Máx. chars</span>
                <input
                  type="number"
                  min={12}
                  max={80}
                  value={maxChars}
                  onChange={(event) => setMaxChars(Number(event.target.value))}
                />
              </label>
              <label className="field">
                <span>Mín. segundos</span>
                <input
                  type="number"
                  min={0.2}
                  max={3}
                  step={0.1}
                  value={minDuration}
                  onChange={(event) => setMinDuration(Number(event.target.value))}
                />
              </label>
            </div>
            <label className="field language-field">
              <span>Idioma</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label} ({option.code})
                  </option>
                ))}
              </select>
              <small className="helper-text">
                {isEnglishOnlyModel(modelPath)
                  ? 'Modelos .en aceitam somente inglês.'
                  : 'Idiomas aceitos pelos modelos Whisper multilíngues recomendados.'}
              </small>
            </label>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={trimSilence}
              onChange={(event) => setTrimSilence(event.target.checked)}
            />
            <span>Remover silêncio/música final detectado</span>
          </label>

          <label className="field prompt-field">
            <span>Prompt técnico</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Palavras que a geração pode confundir, separadas por vírgula."
              rows={2}
            />
          </label>

          <div className="actions">
            <button className="primary" type="button" onClick={generate} disabled={!canGenerate}>
              {isGenerating ? 'Gerando...' : 'Gerar SRT'}
            </button>
          </div>
        </div>

        <aside className="panel status">
          <div className="status-heading">
            <span className="label">Status</span>
            <h2>{statusTitle}</h2>
          </div>

          {result && (
            <dl className="stats">
              <div><dt>Blocos</dt><dd>{result.stats.blocks}</dd></div>
              <div><dt>Máx chars</dt><dd>{result.stats.maxChars}</dd></div>
              <div><dt>Mín duração</dt><dd>{result.stats.minDuration.toFixed(3)}s</dd></div>
              <div><dt>Fim</dt><dd>{secondsToTime(result.stats.lastEnd)}</dd></div>
            </dl>
          )}

          {error && <pre className="error">{error}</pre>}

          <div className="log" ref={logRef}>
            {log.length === 0 ? (
              <>
                <p>Aguardando geração...</p>
                <p className="log-muted">Os logs aparecerão aqui quando o processo começar.</p>
              </>
            ) : log.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        </aside>
      </section>
    </main>
  )
}

export default App
