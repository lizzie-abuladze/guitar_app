const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status');

let kickDrum, snareDrum, hiHatCymbal, synthSFX;
let masterCompressor, saturation;
let isPlaying = false;

let lastTriggerTimeLeft = 0;
let lastTriggerTimeRight = 0;
let lastYLeft = null;
let lastYRight = null;

function initAudio() {
  // 1. Master Output Processing (Boost Volume + Punch)
  // Master Compressor to squeeze out maximum punch and volume without clipping
  masterCompressor = new Tone.Compressor({
    threshold: -12,
    ratio: 6,
    attack: 0.003,
    release: 0.1
  }).toDestination();

  // Subtle distortion/saturation to make sounds thick and heavy
  saturation = new Tone.Distortion(0.15).connect(masterCompressor);

  // Master Volume Gain Boost (+6dB)
  Tone.Destination.volume.value = 6;

  // 2. Heavy Kick Drum (Low sub-bass drop + high initial slap)
  kickDrum = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 10,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 }
  }).connect(saturation);

  // 3. Punchy Snare Drum (Thick noise burst + body tone)
  snareDrum = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.2, release: 0.1 }
  }).connect(saturation);

  // 4. Loud Cymbal / Crash
  hiHatCymbal = new Tone.MetalSynth({
    frequency: 350,
    envelope: { attack: 0.001, decay: 0.25, release: 0.1 },
    harmonicity: 5.1,
    modulationIndex: 40,
    resonance: 3000,
    octaves: 2
  }).connect(masterCompressor);

  // 5. Heavy Electro Synth Hit
  synthSFX = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }
  }).connect(saturation);
}

function triggerPadSound(padIndex) {
  switch (padIndex) {
    case 0: // Top-Left: Heavy Snare
      snareDrum.triggerAttackRelease("8n");
      statusText.innerText = "Hit: HEAVY SNARE";
      break;
    case 1: // Bottom-Left: Sub Kick
      kickDrum.triggerAttackRelease("C0", "8n");
      statusText.innerText = "Hit: SUB KICK BASS";
      break;
    case 2: // Top-Right: Loud Cymbal
      hiHatCymbal.triggerAttackRelease("8n");
      statusText.innerText = "Hit: CRASH CYMBAL";
      break;
    case 3: // Bottom-Right: Heavy Synth
      synthSFX.triggerAttackRelease("C3", "16n");
      statusText.innerText = "Hit: HEAVY SYNTH";
      break;
  }
}

function onResults(results) {
  if (videoElement.videoWidth && videoElement.videoHeight) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
  }
  
  const w = canvasElement.width;
  const h = canvasElement.height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, w, h);

  // Visual Grid
  canvasCtx.lineWidth = 3;

  canvasCtx.fillStyle = "rgba(239, 68, 68, 0.25)";
  canvasCtx.fillRect(0, 0, w / 2, h / 2);

  canvasCtx.fillStyle = "rgba(59, 130, 246, 0.25)";
  canvasCtx.fillRect(0, h / 2, w / 2, h / 2);

  canvasCtx.fillStyle = "rgba(234, 179, 8, 0.25)";
  canvasCtx.fillRect(w / 2, 0, w / 2, h / 2);

  canvasCtx.fillStyle = "rgba(168, 85, 247, 0.25)";
  canvasCtx.fillRect(w / 2, h / 2, w / 2, h / 2);

  canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  canvasCtx.setLineDash([8, 8]);
  canvasCtx.beginPath();
  canvasCtx.moveTo(w / 2, 0); canvasCtx.lineTo(w / 2, h);
  canvasCtx.moveTo(0, h / 2); canvasCtx.lineTo(w, h / 2);
  canvasCtx.stroke();

  canvasCtx.fillStyle = "#ffffff";
  canvasCtx.font = "bold 18px sans-serif";
  canvasCtx.fillText("🥁 HEAVY SNARE", 20, 40);
  canvasCtx.fillText("💥 SUB KICK", 20, h / 2 + 40);
  canvasCtx.fillText("🔔 CRASH CYMBAL", w / 2 + 20, 40);
  canvasCtx.fillText("⚡ HEAVY SYNTH", w / 2 + 20, h / 2 + 40);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const now = Date.now();

    results.multiHandLandmarks.forEach((hand, handIdx) => {
      const fingerTips = [8, 12, 16];
      let avgX = 0;
      let avgY = 0;

      fingerTips.forEach((idx) => {
        const pt = hand[idx];
        avgX += (1 - pt.x);
        avgY += pt.y;

        canvasCtx.fillStyle = handIdx === 0 ? "#00FF00" : "#FF0077";
        canvasCtx.beginPath();
        canvasCtx.arc((1 - pt.x) * w, pt.y * h, 10, 0, 2 * Math.PI);
        canvasCtx.fill();
      });

      avgX /= fingerTips.length;
      avgY /= fingerTips.length;

      let padIndex = 0;
      if (avgX < 0.5 && avgY < 0.5) padIndex = 0;
      else if (avgX < 0.5 && avgY >= 0.5) padIndex = 1;
      else if (avgX >= 0.5 && avgY < 0.5) padIndex = 2;
      else if (avgX >= 0.5 && avgY >= 0.5) padIndex = 3;

      const lastY = handIdx === 0 ? lastYLeft : lastYRight;
      const lastTrigger = handIdx === 0 ? lastTriggerTimeLeft : lastTriggerTimeRight;

      if (lastY !== null) {
        const speed = avgY - lastY;

        if (speed > 0.04 && (now - lastTrigger > 180)) {
          triggerPadSound(padIndex);

          if (handIdx === 0) lastTriggerTimeLeft = now;
          else lastTriggerTimeRight = now;
        }
      }

      if (handIdx === 0) lastYLeft = avgY;
      else lastYRight = avgY;
    });
  }

  canvasCtx.restore();
}

startBtn.addEventListener('click', async () => {
  try {
    statusText.innerText = "Powering up drum audio...";
    
    if (typeof window.Hands === 'undefined') {
      throw new Error("MediaPipe library failed to load from CDN.");
    }

    await Tone.start();
    initAudio();
    isPlaying = true;

    statusText.innerText = "Starting camera...";

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    videoElement.srcObject = stream;
    await videoElement.play();

    async function processFrame() {
      if (isPlaying) {
        await hands.send({ image: videoElement });
        requestAnimationFrame(processFrame);
      }
    }

    statusText.innerText = "Heavy Drums Active! Tap pads to play.";
    startBtn.style.display = 'none';
    
    processFrame();

  } catch (err) {
    console.error(err);
    statusText.innerText = "Error: " + err.message;
  }
});