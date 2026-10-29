export class CanvasCompositor {
  constructor(canvas, screenVideo, webcamVideo, fps = 30) {
    this.canvas = canvas;
    this.screenVideo = screenVideo;
    this.webcamVideo = webcamVideo;
    this.fps = fps;
    this.animationFrame = 0;
  }

  start(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.hidden = false;
    const context = this.canvas.getContext("2d");
    const draw = () => {
      context.drawImage(this.screenVideo, 0, 0, width, height);
      if (this.webcamVideo.srcObject && this.webcamVideo.readyState >= 2 && !this.webcamVideo.hidden) {
        const size = Math.round(Math.min(width, height) * 0.2);
        const x = width - size - 28;
        const y = height - size - 28;
        context.save();
        context.beginPath();
        context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(this.webcamVideo, x, y, size, size);
        context.restore();
        context.strokeStyle = "#9e78ff";
        context.lineWidth = Math.max(3, size / 30);
        context.beginPath();
        context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        context.stroke();
      }
      this.animationFrame = requestAnimationFrame(draw);
    };
    draw();
    return this.canvas.captureStream(this.fps);
  }

  stop() {
    cancelAnimationFrame(this.animationFrame);
    this.canvas.hidden = true;
  }
}
