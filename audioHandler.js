// Audio context and state for MP3 playback
let audioContext = null;
let audioPlayer = null;
let mp3Source = null;
let mp3Analyser = null;

// Initialize audio context on first interaction
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Load MP3 file and decode it
async function loadMP3() {
    try {
        const fileInput = document.getElementById('file-selector');
        const file = fileInput.files[0];

        if (!file) {
            throw new Error('No file selected');
        }

        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = initAudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        console.log('MP3 decoded successfully', audioBuffer);
        return audioBuffer;
    } catch (error) {
        console.error('Error loading MP3:', error);
        showError('Failed to load or decode MP3 file');
        throw error;
    }
}

// Play the MP3 audio buffer
function playMP3(audioBuffer) {
    const audioCtx = initAudioContext();

    // Create gain node for volume control
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = Math.pow(10, (document.getElementById('volSlider').value || -15) / 20);

    // Create analyser for visualization
    mp3Analyser = audioCtx.createAnalyser();
    mp3Analyser.fftSize = 1024;
    gainNode.connect(mp3Analyser);
    mp3Analyser.connect(audioCtx.destination);

    // Create buffer source and play
    mp3Source = audioCtx.createBufferSource();
    mp3Source.buffer = audioBuffer;
    mp3Source.connect(gainNode);

    mp3Source.onended = () => {
        audioPlayer = null;
        mp3Source = null;
        onSequenceEnd({ detail: { message: 'MP3 playback ended.' } });
    };

    mp3Source.start(0);
    audioPlayer = mp3Source;

    // Start drawing waveform
    drawMP3Waveform();

    console.log('MP3 playback started');
}

// Stop MP3 playback
function stopMP3() {
    if (mp3Source) {
        mp3Source.stop();
        mp3Source = null;
        audioPlayer = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

// Draw waveform for MP3 using analyser
function drawMP3Waveform() {
    if (!mp3Analyser || !audioPlayer) {
        return;
    }

    requestAnimationFrame(drawMP3Waveform);

    // Get frequency data
    const frequencyData = new Uint8Array(mp3Analyser.frequencyBinCount);
    mp3Analyser.getByteFrequencyData(frequencyData);

    // Draw on canvas
    const canvas = document.getElementById('wave0');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#569dcb';

        const barWidth = (canvas.width / frequencyData.length) * 2.5;
        let x = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            const barHeight = (frequencyData[i] / 255) * canvas.height;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
}

// Error message display helper
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => { errorMessage.style.display = 'none'; }, 5000);
    }
}
