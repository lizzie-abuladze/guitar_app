const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status');

// 1. Acoustic Guitar Sound Engine (Plucked Physical Modeling)
const guitarPoly = new Tone.PolySynth(Tone.PluckSynth, {
  attackNoise: 1.2,
  dampening: 4000,
  resonance: 0.96
}).toDestination();

// Add a slight room reverb for warm acoustic resonance
const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.3 }).toDestination();
guitarPoly.connect(reverb);

// 2. Drum Instruments
const kickDrum = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 8,
  oscillator: { type: "sine" }
}).toDestination();

const snareDrum = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.15, release: 0.1 }
}).toDestination();

let isPlaying = false;
let currentChord = "C";
let lastStrumY = null;
let lastDrumTriggerTime = 0;

// Acoustic Chord Frequencies
const CHORDS = {
  "C": ["C3", "E3", "G3", "C4", "E4"],
  "G": ["G2", "B2", "D3", "G3", "D4", "G4"],
  "Am": ["A2", "E3", "A3", "C4", "E4"],
  "F": ["F2", "A2", "C3", "F3", "A3", "F4"],
  "D": ["D3", "A3", "D4", "F#4"]
};

const chordNames = ["C", "G", "Am", "F", "D"];

function onResults(results) {
  if (videoElement.videoWidth && videoElement.videoHeight) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
  }
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Top 25% = Drum Zone Line
  const drumZoneY = canvasElement.height * 0.25;
  canvasCtx.strokeStyle = "rgba(236, 72, 153, 0.5)";
  canvasCtx.setLineDash([6, 6]);
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  canvasCtx.moveTo(0, drumZoneY);
  canvasCtx.lineTo(canvasElement.width, drumZoneY);
  canvasCtx.stroke();

  canvasCtx.fillStyle = "rgba(236, 72, 153, 0.9)";
  canvasCtx.font = "bold 16px sans-serif";
  canvasCtx.fillText("🥁 DRUM ZONE (Top Area)", 20, 25);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    let leftHand = null;
    let rightHand = null;

    // Fixed hand orientation for selfie mirror mode
    results.multiHandedness.forEach((handedness, index) => {
      if (handedness.label === "Left") {
        leftHand = results.multiHandLandmarks[index];  // Controls Chord
      } else {
        rightHand = results.multiHandLandmarks[index]; // Controls Strumming & Drums
      }
    });

    if (!leftHand && !rightHand && results.multiHandLandmarks.length > 0) {
      leftHand = results.multiHandLandmarks[0];
      if (results.multiHandLandmarks.length > 1) {
        rightHand = results.multiHandLandmarks[1];
      }
    }

    // 1. Left Hand - Select Acoustic Chord
    if (leftHand) {
      const indexTip = leftHand[8];
      
      canvasCtx.fillStyle = '#00FF00';
      canvasCtx.beginPath();
      canvasCtx.arc(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height, 16, 0, 2 * Math.PI);
      canvasCtx.fill();

      const chordIndex = Math.floor(indexTip.y * chordNames.length);
      currentChord = chordNames[Math.max(0, Math.min(chordNames.length - 1, chordIndex))];
    }

    // 2. Right Hand - Strum Acoustic Strings or Hit Drums
    if (rightHand) {
      const indexTip = rightHand[8];
      const currentY = indexTip.y * canvasElement.height;
      const now = Date.now();

      const inDrumZone = currentY < drumZoneY;
      canvasCtx.fillStyle = inDrumZone ? '#EC4899' : '#FF0000';
      canvasCtx.beginPath();
      canvasCtx.arc(indexTip.x * canvasElement.width, currentY, 16, 0, 2 * Math.PI);
      canvasCtx.fill();

      if (lastStrumY !== null) {
        const speed = indexTip.y - lastStrumY;

        // Top Zone: Drums
        if (inDrumZone && Math.abs(speed) > 0.05 && (now - lastDrumTriggerTime > 200)) {
          if (indexTip.x < 0.5) {
            kickDrum.triggerAttackRelease("C1", "8n");
            statusText.innerText = "🥁 Drum: KICK!";
          } else {
            snareDrum.triggerAttackRelease("16n");
            statusText.innerText = "🥁 Drum: SNARE!";
          }
          lastDrumTriggerTime = now;
        } 
        // Lower Area: Acoustic Guitar Strumming
        else if (!inDrumZone && Math.abs(speed) > 0.05 && isPlaying) {
          guitarPoly.triggerAttackRelease(CHORDS[currentChord], "2n");
          statusText.innerText = "🪕 Acoustic Chord: " + currentChord;
        }
      }
      lastStrumY = indexTip.y;
    }
  }

  // Display active acoustic chord on canvas
  canvasCtx.fillStyle = "#38bdf8";
  canvasCtx.font = "bold 24px sans-serif";
  canvasCtx.fillText("Chord: " + currentChord, 20, canvasElement.height - 20);

  canvasCtx.restore();
}

// MediaPipe setup with fast detection options
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0, // Set to 0 for rapid tracking
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

startBtn.addEventListener('click', async () => {
  try {
    await Tone.start();
    isPlaying = true;
    statusText.innerText = "Starting Camera...";

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

    statusText.innerText = "Acoustic Band Active! Strum below line, hit top zone for drums.";
    startBtn.style.display = 'none';
    
    processFrame();

  } catch (err) {
    console.error(err);
    statusText.innerText = "Camera Access Error. Please allow webcam permissions.";
  }
});
