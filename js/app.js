import { RecorderEngine } from "./recorder.js";
import { deleteRecording, listRecordings, saveRecording } from "./storage.js";

const $ = id => document.getElementById(id);
const el = {
  screenPreview: $("screenPreview"), webcamPreview: $("webcamPreview"), canvas: $("studioCanvas"),
  previewEmpty: $("previewEmpty"), previewResolution: $("previewResolution"), supportStatus: $("supportStatus"),
  status: $("recordingStatus"), detail: $("statusDetail"), statusDot: $("statusIndicator"), timer: $("timer"),
  badge: $("recordingBadge"), start: $("startButton"), pause: $("pauseButton"), camera: $("cameraButton"),
  mic: $("micButton"), cameraState: $("cameraState"), micState: $("micState"), meterWrap: $("audioMeterWrap"),
  meter: $("audioMeter"), studio: $("studioButton"), libraryCount: $("libraryCount"), libraryList: $("libraryList"),
  resultVideo: $("resultVideo"), resultDetails: $("resultDetails"), toast: $("toast")
};
const state = { studio: false, recording: false, paused: false, timer: null, elapsed: 0, result: null };
const engine = new RecorderEngine(el, { fps: 30, bitrate: 8000000, echo: true, noise: true });

function toast(message, error = false) { el.toast.textContent = message; el.toast.className = `toast show${error ? " error" : ""}`; setTimeout(() => el.toast.className = "toast", 3000); }
function setStatus(title, detail, busy = false) { el.status.textContent = title; el.detail.textContent = detail; el.statusDot.classList.toggle("busy", busy); }
function formatTime(ms) { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function updateTimer() { el.timer.textContent = formatTime(state.elapsed + (state.paused ? 0 : performance.now() - state.timerStarted)); }
function modal(id, open = true) { const dialog = $(id); open ? dialog.showModal() : dialog.close(); }
function refreshOptions() { engine.options.fps = Number($("fpsSelect").value); engine.options.bitrate = Number($("bitrateSelect").value); engine.options.echo = $("echoToggle").checked; engine.options.noise = $("noiseToggle").checked; engine.options.studio = state.studio; }

async function chooseScreen() {
  try { refreshOptions(); await engine.shareScreen(); setStatus("Screen ready", "Select recording options below"); toast("Screen sharing connected"); }
  catch (error) { toast(error.name === "NotAllowedError" ? "Screen sharing was cancelled." : error.message, true); }
}
async function toggleFeature(kind) {
  try {
    const enabled = await engine[kind === "camera" ? "toggleCamera" : "toggleMic"]();
    const button = el[kind]; button.classList.toggle("active", enabled);
    el[`${kind}State`].textContent = enabled ? "On" : "Off";
    if (kind === "mic") el.meterWrap.hidden = !enabled;
    toast(`${kind === "camera" ? "Camera" : "Microphone"} ${enabled ? "enabled" : "disabled"}`);
  } catch (error) { toast(error.name === "NotAllowedError" ? `${kind} permission was denied.` : error.message, true); }
}
async function startRecording() {
  try {
    refreshOptions(); await engine.start(); state.recording = true; state.paused = false; state.elapsed = 0; state.timerStarted = performance.now();
    el.start.textContent = "Stop recording"; el.start.classList.add("stop"); el.pause.disabled = false; el.timer.hidden = false; el.badge.hidden = false; setStatus("Recording", "Capture in progress", true);
    state.timer = setInterval(updateTimer, 250);
  } catch (error) { toast(error.message, true); }
}
async function stopRecording() {
  el.start.disabled = true; setStatus("Processing recording", "Preparing your video…", true); clearInterval(state.timer); state.elapsed += performance.now() - state.timerStarted;
  const result = await new Promise(resolve => { engine.mediaRecorder.onstop = () => resolve(engine.finish()); engine.stop(); });
  state.result = result; el.start.disabled = false; el.start.textContent = "Start recording"; el.start.classList.remove("stop"); el.pause.disabled = true; el.timer.hidden = true; el.badge.hidden = true; state.recording = false;
  setStatus("Ready to record", "Your recording is ready"); el.resultVideo.src = URL.createObjectURL(result.blob); el.resultDetails.textContent = `${formatTime(result.duration)} · ${(result.blob.size / 1024 / 1024).toFixed(1)} MB · ${result.type.split(";")[0]}`; modal("resultDialog");
}
function togglePause() { if (!state.recording) return; if (state.paused) { engine.resume(); state.timerStarted = performance.now(); state.paused = false; el.pause.textContent = "Ⅱ"; setStatus("Recording", "Capture in progress", true); } else { state.elapsed += performance.now() - state.timerStarted; engine.pause(); state.paused = true; el.pause.textContent = "▶"; setStatus("Paused", "Resume when you are ready"); } }
async function renderLibrary() {
  try {
    const recordings = await listRecordings(); el.libraryCount.textContent = recordings.length;
    el.libraryList.innerHTML = recordings.length ? "" : '<div class="library-empty">No recordings saved yet.<br><small>Your local recordings will appear here.</small></div>';
    recordings.forEach(recording => {
      const item = document.createElement("div"); item.className = "library-item";
      const video = document.createElement("video"); video.src = URL.createObjectURL(recording.blob); video.muted = true;
      const info = document.createElement("div"); const title = document.createElement("strong"); title.textContent = recording.name;
      const details = document.createElement("small"); details.textContent = `${new Date(recording.createdAt).toLocaleString()} · ${(recording.blob.size / 1024 / 1024).toFixed(1)} MB`;
      info.append(title, details); const actions = document.createElement("div"); actions.className = "item-actions";
      const download = document.createElement("button"); download.textContent = "Download"; download.onclick = () => downloadBlob(recording.blob, `${recording.name}.webm`);
      const rename = document.createElement("button"); rename.textContent = "Rename"; rename.onclick = async () => { const name = prompt("New recording name", recording.name); if (name?.trim()) { recording.name = name.trim(); await saveRecording(recording); renderLibrary(); } };
      const remove = document.createElement("button"); remove.textContent = "Delete"; remove.onclick = async () => { if (confirm("Delete this recording?")) { await deleteRecording(recording.id); renderLibrary(); } };
      actions.append(rename, download, remove); item.append(video, info, actions); el.libraryList.append(item);
    });
  } catch { toast("Unable to load the recordings library.", true); }
}
function downloadBlob(blob, filename) { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }

$("screenButton").onclick = chooseScreen; el.camera.onclick = () => toggleFeature("camera"); el.mic.onclick = () => toggleFeature("mic"); el.start.onclick = () => state.recording ? stopRecording() : startRecording(); el.pause.onclick = togglePause;
el.studio.onclick = () => { state.studio = !state.studio; el.studio.querySelector(".pill").textContent = state.studio ? "ON" : "OFF"; toast(`Studio mode ${state.studio ? "enabled" : "disabled"}`); };
$("settingsButton").onclick = () => modal("settingsDialog"); $("libraryButton").onclick = () => { renderLibrary(); modal("libraryDialog"); }; $("resetButton").onclick = () => { state.studio = false; el.studio.querySelector(".pill").textContent = "OFF"; toast("Capture settings reset"); };
document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => modal(button.dataset.close, false));
$("downloadButton").onclick = () => downloadBlob(state.result.blob, `${$("filenameInput").value || "screenly-recording"}.webm`);
$("saveButton").onclick = async () => { try { await saveRecording({ id: crypto.randomUUID(), name: $("filenameInput").value || "screenly-recording", blob: state.result.blob, createdAt: Date.now(), duration: state.result.duration }); await renderLibrary(); modal("resultDialog", false); toast("Saved to your library"); } catch { toast("Storage quota exceeded or unavailable.", true); } };
$("snapshotButton").onclick = () => { const video = el.resultVideo; const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d").drawImage(video, 0, 0); downloadBlob(dataUrlToBlob(canvas.toDataURL("image/png")), "screenly-snapshot.png"); };
function dataUrlToBlob(dataUrl) { const [meta, data] = dataUrl.split(","); return new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: meta.match(/:(.*?);/)[1] }); }
document.addEventListener("keydown", event => { if (event.code === "Space" && state.recording && event.target.tagName !== "INPUT") { event.preventDefault(); togglePause(); } });
if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) { el.supportStatus.textContent = "Browser support limited"; toast("Use a current Chrome, Edge, or Firefox browser for recording.", true); } else el.supportStatus.textContent = "Browser ready";
renderLibrary();
