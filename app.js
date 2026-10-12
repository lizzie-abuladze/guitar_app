const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status');

// Mobile synth configuration
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
  canvasElement.width = videoElement.videoWidth || 640;
  canvasElement.height = videoElement.videoHeight || 480;
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    let leftHand = null;
    let rightHand = null;

    results.multiHandedness.forEach((handedness, index) => {
      if (handedness.label === "Left") {
        leftHand = results.multiHandLandmarks[index];
      } else {
        rightHand = results.multiHandLandmarks[index];
      }
    });

    // 1. Left Hand - Select Chord
    if (leftHand) {
      const indexTip = leftHand[8];
      
      canvasCtx.fillStyle = '#00FF00';
      canvasCtx.beginPath();
      canvasCtx.arc(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height, 12, 0, 2 * Math.PI);
      canvasCtx.fill();

      const chordIndex = Math.floor(indexTip.y * chordNames.length);
      currentChord = chordNames[Math.max(0, Math.min(chordNames.length - 1, chordIndex))];
    }

    // 2. Right Hand - Strum
    if (rightHand) {
      const indexTip = rightHand[8];

      canvasCtx.fillStyle = '#FF0000';
      canvasCtx.beginPath();
      canvasCtx.arc(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height, 12, 0, 2 * Math.PI);
      canvasCtx.fill();

      if (lastStrumY !== null) {
        const speed = indexTip.y - lastStrumY;
        
        if (Math.abs(speed) > 0.07 && isPlaying) {
          synth.triggerAttackRelease(CHORDS[currentChord], "2n");
          statusText.innerText = "Chord: " + currentChord;
        }
      }
      lastStrumY = indexTip.y;
    }
  }

  canvasCtx.fillStyle = "#38bdf8";
  canvasCtx.font = "bold 20px Arial";
  canvasCtx.fillText("Chord: " + currentChord, 20, canvasElement.height - 20);

  canvasCtx.restore();
}

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0, // Set to 0 for smoother mobile performance
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

hands.onResults(onResults);

// Mobile touch event listener
startBtn.addEventListener('click', async () => {
  try {
    // Unlock Web Audio API on mobile iOS/Android
    await Tone.start();
    isPlaying = true;
    statusText.innerText = "Accessing camera...";

    // Request front selfie camera explicitly for mobile devices
    const constraints = {
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });

    await camera.start();
    statusText.innerText = "Guitar Ready! Strum hands in air.";
    startBtn.style.display = 'none';

  } catch (err) {
    console.error(err);
    statusText.innerText = "Error: Please allow camera access.";
  }
});
