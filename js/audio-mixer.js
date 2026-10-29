export class AudioMixer {
  constructor(options = {}) {
    this.context = new AudioContext();
    this.destination = this.context.createMediaStreamDestination();
    this.sources = [];
    this.options = options;
  }

  addStream(stream, volume = 1) {
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return false;
    const source = this.context.createMediaStreamSource(new MediaStream(audioTracks));
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.destination);
    this.sources.push({ source, gain });
    return true;
  }

  async resume() {
    if (this.context.state === "suspended") await this.context.resume();
  }

  getStream() { return this.destination.stream; }

  stop() {
    this.sources.forEach(({ source }) => source.disconnect());
    this.sources = [];
    this.context.close();
  }
}
