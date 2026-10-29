# Screenly

Screenly is a private, browser-based screen recorder built with HTML, CSS, and native JavaScript modules. Screen, camera, and microphone media are captured locally; recordings are stored in the browser's IndexedDB database and are never uploaded.

## Run locally

Browser capture APIs require a secure context. `localhost` is allowed, so use any static server:

```bash
# VS Code: install Live Server, then use "Open with Live Server" on index.html
# Or, with Node.js:
npx serve .
```

Open the displayed `http://localhost` URL in Chrome, Edge, or Firefox. HTTPS is required when deploying to a non-localhost host.

## Use

1. Click **Share your screen** and choose a monitor, window, or tab.
2. Optionally enable Camera and Microphone. Turn on Studio mode to composite the camera into the recorded video.
3. Choose quality and frame rate, then start, pause/resume, and stop.
4. Download the result, take a PNG snapshot, or save it to the local library.

System audio depends on the selected source and browser. The app continues without audio when a source does not provide it. Browser permissions can only be granted or denied by the user.

## Project structure

- `js/app.js` coordinates UI and user actions.
- `js/recorder.js` owns MediaRecorder and media lifecycle.
- `js/audio-mixer.js` mixes microphone and captured system audio.
- `js/canvas-compositor.js` renders Studio mode.
- `js/storage.js` provides IndexedDB persistence.
