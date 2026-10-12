const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status');

// Tone.js Audio Synth setup
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
  // Sync canvas size to video size dynamically
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
      if (handedness.label === "Left") {
        rightHand = results.multiHandLandmarks[index];
      } else {
        leftHand = results.multiHandLandmarks[index];
      }
    });

    if (!leftHand && !rightHand && results.multiHandLandmarks.length > 0) {
      leftHand = results.multiHandLandmarks[0];
      if (results.multiHandLandmarks.length > 1) {
        rightHand = results.multiHandLandmarks[1];
      }
    }

    // 1. Left Hand - Select Chord
    if (leftHand) {
      const indexTip = leftHand[8];
      
      canvasCtx.fillStyle = '#00FF00';
      canvasCtx.beginPath();
      canvasCtx.arc(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height, 16, 0, 2 * Math.PI);
      canvasCtx.fill();

      const chordIndex = Math.floor(indexTip.y * chordNames.length);
      currentChord = chordNames[Math.max(0, Math.min(chordNames.length - 1, chordIndex))];
    }

    // 2. Right Hand - Strum
    if (rightHand) {
      const indexTip = rightHand[8];

      canvasCtx.fillStyle = '#FF0000';
      canvasCtx.beginPath();
      canvasCtx.arc(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height, 16, 0, 2 * Math.PI);
      canvasCtx.fill();

      if (lastStrumY !== null) {
        const speed = indexTip.y - lastStrumY;
        
        if (Math.abs(speed) > 0.05 && isPlaying) {
          synth.triggerAttackRelease(CHORDS[currentChord], "2n");
          statusText.innerText = "Playing: " + currentChord;
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

// MediaPipe setup using stable CDN assets
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
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
    statusText.innerText = "Starting Camera...";

    // 1. Get raw video stream directly from device
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

    // 2. Process video frames into MediaPipe continuously
    async function processFrame() {
      if (isPlaying) {
        await hands.send({ image: videoElement });
        requestAnimationFrame(processFrame);
      }
    }

    statusText.innerText = "Guitar Active! Move hand for chord, strum to play.";
    startBtn.style.display = 'none';
    
    // Start processing frame loop
    processFrame();

  } catch (err) {
    console.error(err);
    statusText.innerText = "Camera Access Error. Please check permissions.";
  }
});
