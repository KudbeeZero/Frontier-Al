let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let droneOsc: OscillatorNode | null = null;
let droneGainNode: GainNode | null = null;
let lfoOsc: OscillatorNode | null = null;
let lfoGain: GainNode | null = null;
let beepInterval: ReturnType<typeof setTimeout> | null = null;
let radioInterval: ReturnType<typeof setTimeout> | null = null;
let running = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

function scheduleBeep() {
  if (!running) return;
  const delay = 15000 + Math.random() * 5000;
  beepInterval = setTimeout(() => {
    if (!running || !masterGain) return;
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "square";
    osc.frequency.value = 880 + Math.random() * 40;
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.05, ac.currentTime + 0.01);
    g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.12);
    osc.connect(g).connect(masterGain);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.15);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
    scheduleBeep();
  }, delay);
}

function scheduleRadioChatter() {
  if (!running) return;
  const delay = 50000 + Math.random() * 20000;
  radioInterval = setTimeout(() => {
    if (!running || !masterGain) return;
    const ac = getCtx();
    const t = ac.currentTime;

    const keyUpOsc = ac.createOscillator();
    const keyUpGain = ac.createGain();
    keyUpOsc.type = "sine";
    keyUpOsc.frequency.value = 1200;
    keyUpGain.gain.setValueAtTime(0, t);
    keyUpGain.gain.linearRampToValueAtTime(0.04, t + 0.01);
    keyUpGain.gain.linearRampToValueAtTime(0, t + 0.06);
    keyUpOsc.connect(keyUpGain).connect(masterGain);
    keyUpOsc.start(t);
    keyUpOsc.stop(t + 0.08);
    keyUpOsc.onended = () => { keyUpOsc.disconnect(); keyUpGain.disconnect(); };

    const chatterStart = t + 0.1;
    const chatterDuration = 0.3 + Math.random() * 0.3;
    const bufferLen = Math.floor(ac.sampleRate * chatterDuration);
    const noiseBuffer = ac.createBuffer(1, bufferLen, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noiseSrc = ac.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const bandpass = ac.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1800 + Math.random() * 400;
    bandpass.Q.value = 3;

    const highpass = ac.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 600;

    const chatterGain = ac.createGain();
    chatterGain.gain.setValueAtTime(0, chatterStart);
    chatterGain.gain.linearRampToValueAtTime(0.035, chatterStart + 0.02);
    chatterGain.gain.setValueAtTime(0.035, chatterStart + chatterDuration - 0.05);
    chatterGain.gain.linearRampToValueAtTime(0, chatterStart + chatterDuration);

    const amOsc = ac.createOscillator();
    const amGain = ac.createGain();
    amOsc.type = "square";
    amOsc.frequency.value = 6 + Math.random() * 6;
    amGain.gain.value = 0.4;
    amOsc.connect(amGain).connect(chatterGain.gain);
    amOsc.start(chatterStart);
    amOsc.stop(chatterStart + chatterDuration + 0.05);

    noiseSrc.connect(bandpass).connect(highpass).connect(chatterGain).connect(masterGain!);
    noiseSrc.start(chatterStart);
    noiseSrc.stop(chatterStart + chatterDuration + 0.01);
    noiseSrc.onended = () => {
      noiseSrc.disconnect();
      bandpass.disconnect();
      highpass.disconnect();
      chatterGain.disconnect();
      amOsc.disconnect();
      amGain.disconnect();
    };

    const endBeepTime = chatterStart + chatterDuration + 0.05;
    const endOsc = ac.createOscillator();
    const endGain = ac.createGain();
    endOsc.type = "sine";
    endOsc.frequency.value = 1200;
    endGain.gain.setValueAtTime(0, endBeepTime);
    endGain.gain.linearRampToValueAtTime(0.03, endBeepTime + 0.01);
    endGain.gain.linearRampToValueAtTime(0, endBeepTime + 0.05);
    endOsc.connect(endGain).connect(masterGain!);
    endOsc.start(endBeepTime);
    endOsc.stop(endBeepTime + 0.07);
    endOsc.onended = () => { endOsc.disconnect(); endGain.disconnect(); };

    scheduleRadioChatter();
  }, delay);
}

export function startSpaceAmbience(): void {
  if (running) return;
  running = true;

  const ac = getCtx();

  masterGain = ac.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(ac.destination);

  droneOsc = ac.createOscillator();
  droneOsc.type = "sine";
  droneOsc.frequency.value = 55;

  lfoOsc = ac.createOscillator();
  lfoOsc.type = "sine";
  lfoOsc.frequency.value = 0.15;
  lfoGain = ac.createGain();
  lfoGain.gain.value = 1.5;
  lfoOsc.connect(lfoGain).connect(droneOsc.frequency);
  lfoOsc.start();

  droneGainNode = ac.createGain();
  droneGainNode.gain.value = 0.02;
  droneOsc.connect(droneGainNode).connect(masterGain);
  droneOsc.start();

  masterGain.gain.linearRampToValueAtTime(1, ac.currentTime + 2);

  scheduleBeep();
  scheduleRadioChatter();
}

export function stopSpaceAmbience(): void {
  running = false;

  if (beepInterval !== null) { clearTimeout(beepInterval); beepInterval = null; }
  if (radioInterval !== null) { clearTimeout(radioInterval); radioInterval = null; }

  try { droneOsc?.stop(); } catch (_) {}
  try { lfoOsc?.stop(); } catch (_) {}
  droneOsc?.disconnect();
  lfoOsc?.disconnect();
  lfoGain?.disconnect();
  droneGainNode?.disconnect();
  masterGain?.disconnect();

  droneOsc = null;
  lfoOsc = null;
  lfoGain = null;
  droneGainNode = null;
  masterGain = null;
}
