import { AudioMixer } from "./audio-mixer.js";
import { CanvasCompositor } from "./canvas-compositor.js";

export class RecorderEngine {
  constructor(elements, options) {
    this.el = elements;
    this.options = options;
    this.screenStream = null;
    this.cameraStream = null;
    this.micStream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.compositor = null;
    this.mixer = null;
  }

  async shareScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Screen sharing is not supported in this browser.");
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: this.options.fps }, audio: true });
    this.el.screenPreview.srcObject = this.screenStream;
    this.el.screenPreview.hidden = false;
    this.el.previewEmpty.hidden = true;
    const track = this.screenStream.getVideoTracks()[0];
    track.addEventListener("ended", () => this.handleScreenEnded());
    const settings = track.getSettings();
    this.el.previewResolution.textContent = `${settings.width || "?"} × ${settings.height || "?"}`;
  }

  async toggleCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
      this.el.webcamPreview.srcObject = null;
      this.el.webcamPreview.hidden = true;
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported in this browser.");
    this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    this.el.webcamPreview.srcObject = this.cameraStream;
    this.el.webcamPreview.hidden = false;
    return true;
  }

  async toggleMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported in this browser.");
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: this.options.echo, noiseSuppression: this.options.noise } });
    return true;
  }

  async start() {
    if (!this.screenStream) throw new Error("Select a screen source first.");
    if (this.mediaRecorder?.state === "recording") throw new Error("A recording is already in progress.");
    this.chunks = [];
    let videoStream = this.screenStream;
    if (this.options.studio && this.cameraStream) {
      this.compositor = new CanvasCompositor(this.el.canvas, this.el.screenPreview, this.el.webcamPreview, this.options.fps);
      const track = this.screenStream.getVideoTracks()[0];
      const settings = track.getSettings();
      videoStream = this.compositor.start(settings.width || 1280, settings.height || 720);
    }
    this.mixer = new AudioMixer();
    this.mixer.addStream(this.screenStream);
    if (this.micStream) this.mixer.addStream(this.micStream);
    await this.mixer.resume();
    const tracks = [...videoStream.getVideoTracks(), ...this.mixer.getStream().getAudioTracks()];
    const stream = new MediaStream(tracks);
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(MediaRecorder.isTypeSupported) || "";
    this.mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: this.options.bitrate });
    this.mediaRecorder.ondataavailable = event => { if (event.data.size) this.chunks.push(event.data); };
    this.mediaRecorder.start(250);
    this.startedAt = performance.now();
  }

  pause() { this.mediaRecorder?.pause(); }
  resume() { this.mediaRecorder?.resume(); }
  stop() { if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop(); }

  finish() {
    this.mixer?.stop();
    this.compositor?.stop();
    const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || "video/webm" });
    this.mediaRecorder = null;
    return { blob, duration: performance.now() - this.startedAt, type: blob.type };
  }

  handleScreenEnded() {
    if (this.mediaRecorder?.state !== "inactive") this.stop();
    this.screenStream = null;
    this.el.screenPreview.srcObject = null;
  }

  cleanup() {
    [this.screenStream, this.cameraStream, this.micStream].forEach(stream => stream?.getTracks().forEach(track => track.stop()));
    this.screenStream = this.cameraStream = this.micStream = null;
    this.el.screenPreview.srcObject = null;
    this.el.webcamPreview.srcObject = null;
  }
}
