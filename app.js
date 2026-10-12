const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status');

// Mobile-optimized synth configuration
const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 }
}).toDestination();

let isPlaying = false;
let currentChord = "C";
let lastStrumY = null;

const CHORDS = {
  "C": ["C3", "E3", "G3", "C4", "E4"],
  "G": ["G2", "B2", "D3", "G3", "D4", "G4"],
  "Am": ["A2", "E3", "A3", "C4", "E4"],
  "F": ["F2", "A2", "C3", "F3", "A3", "F4"],
  "D": ["D3", "A3", "D4", "F#4"]
};

const chordNames = ["C", "G", "Am", "F", "D"];

function onResults(results) {
  // Ensure Canvas size matches Video dimensions dynamically
  if (videoElement.videoWidth && videoElement.videoHeight) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
  }
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    let leftHand = null;
    let rightHand = null;

    results.multiHandedness.forEach((handedness, index) => {
      // Handle camera mirroring
      if (handedness.label === "Left") {
        rightHand = results.multiHandLandmarks[index];
      } else {
        leftHand = results.multiHandLandmarks[index];
      }
    });

    // Fallback if handedness detection is uncertain
    if (!leftHand && !rightHand && results.multiHandLandmarks.length > 0) {
      leftHand = results.multiHandLandmarks[0];
      if (results.multiHandLandmarks.length > 1) {
        rightHand = results.multiHandLandmarks[1];
      }
    }

    // 1. Left Hand - Select Chord
    if (leftHand) {
      const indexTip = leftHand[8]; // Index fingertip
      
      // Draw bright green tracking circle
      canvasCtx.fillStyle = '#00FF00';
      canvasCtx.beginPath();
      canvasCtx.arc(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height, 16, 0, 2 * Math.PI);
      canvasCtx.fill();

      const chordIndex = Math.floor(indexTip.y * chordNames.length);
      currentChord = chordNames[Math.max(0, Math.min(chordNames.length - 1, chordIndex))];
    }

    // 2. Right Hand - Strumming
    if (rightHand) {
      const indexTip = rightHand[8];

      // Draw bright red tracking circle
      canvasCtx.fillStyle = '#FF0000';
      canvasCtx.beginPath();
      canvasCtx.arc(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height, 16, 0, 2 * Math.PI);
      canvasCtx.fill();

      if (lastStrumY !== null) {
        const speed = indexTip.y - lastStrumY;
        
        if (Math.abs(speed) > 0.05 && isPlaying) {
          synth.triggerAttackRelease(CHORDS[currentChord], "2n");
          statusText.innerText = "Chord Played: " + currentChord;
        }
      }
      lastStrumY = indexTip.y;
    }
  }

  // Draw Chord visual indicator
  canvasCtx.fillStyle = "#38bdf8";
  canvasCtx.font = "bold 26px sans-serif";
  canvasCtx.fillText("Chord: " + currentChord, 20, 40);

  canvasCtx.restore();
}

// Load MediaPipe Hands assets with fallback CDN
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

startBtn.addEventListener('click', async () => {
  try {
    await Tone.start();
    isPlaying = true;
    statusText.innerText = "Connecting camera...";

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });

    await camera.start();
    statusText.innerText = "Guitar Active! Move hand up/down for chord, strum to play.";
    startBtn.style.display = 'none';

  } catch (err) {
    console.error(err);
    statusText.innerText = "Camera Access Error. Please reload and allow permissions.";
  }
});
