# SRT Generator — Open Source Desktop Redesign

## Understanding

- SRT Generator is a local Electron utility for creating `.srt` subtitles with whisper.cpp.
- The redesign should feel premium and distinctive while remaining compact on a 13-inch MacBook.
- macOS is the first supported platform; the implementation should not prevent future Windows or Linux support.
- Audio stays on the device. The app has no accounts, telemetry, or network processing.
- New users need clear dependency and model setup guidance in both the app and README.
- The project is open source under MIT and welcomes low-pressure community contributions.
- The first distributable target is an unsigned Apple Silicon DMG.

## Product and Interface Design

The selected direction is **Glass Utility**: a restrained blue-violet identity, system-aware light and dark themes, translucent surfaces, fine borders, and subtle motion. The default window is 860×680 with a 720×600 minimum. Reduced-motion and reduced-transparency preferences receive solid, static fallbacks.

The main workflow stays in two columns. The left column contains audio selection, output selection, a concise model summary, collapsible advanced settings, and the primary generate action. The contextual right column changes between dependency setup, ready, processing, success, and error states. Technical logs live behind a **View details** disclosure instead of occupying permanent space.

On success, the app shows the output path, generation statistics, a short subtitle preview, and a **Show in Finder** action. A quiet footer links to the GitHub repository and identifies the project as open source under MIT.

## Setup and Runtime Design

Models live in `~/.srt-generator/models` by default. `SRT_GENERATOR_MODELS_DIR` can override this location for advanced users, but the default is recommended. The app detects `whisper-cli`, `ffmpeg`, and installed models and turns missing requirements into actionable setup steps.

The initial release does not download dependencies or models from inside the app. The English README provides copyable Homebrew and model-download commands, model recommendations, configuration details, development instructions, DMG build instructions, troubleshooting, privacy notes, and contribution guidance.

Generation remains single-file and local. Temporary artifacts are cleaned after both success and failure. A completed output is only reported after validation and a successful final write.

## Assumptions and Risks

- Apple Silicon is the first packaged architecture; source compatibility remains broader.
- The DMG is initially unsigned and unnotarized, so Gatekeeper may require an explicit open action.
- Homebrew provides `ffmpeg` and `whisper-cli` through the `whisper-cpp` formula.
- Model hosting URLs can change, so documentation should point to the upstream whisper.cpp model catalog.
- Glass effects must never reduce legibility or keyboard accessibility.

## Decision Log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Glass Utility interface | Native Productivity, Showcase Glass | Best balance of identity, density, and maintainability |
| Custom CSS | Mantine, shadcn, Astryx | The small interface does not justify a large UI dependency |
| Two-column layout | Single column, sidebar shell | Preserves the efficient current workflow and gives status a distinct role |
| System theme | Light-only, dark-only | Matches desktop expectations with little user configuration |
| `~/.srt-generator/models` | Repository folder, arbitrary folder only | Keeps large binaries outside Git while providing a predictable location |
| Guided external setup | In-app downloads, README only | Actionable onboarding without adding downloader and supply-chain complexity |
| MIT license | Noncommercial, custom license | Meets the goal of genuine open source distribution |
| Apple Silicon DMG first | Universal DMG immediately, source only | Provides a useful artifact with a smaller initial packaging surface |

