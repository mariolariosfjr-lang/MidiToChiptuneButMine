
let recorder;
let downloadReadyPromise = Promise.resolve(); // Init with resolved promise
let currentFileType = null; // Track whether we're playing MIDI or MP3

//todo: loadFile() results in inconsistent recorder state
// todo: check if tail end necessary

function loadFile() {
    console.log('Tone.js custom version:', Tone.version);

    // Get file and determine type
    const fileInput = document.getElementById('file-selector');
    const file = fileInput.files[0];

    if (!file) {
        showError('No file selected');
        return;
    }

    const fileName = file.name.toLowerCase();
    const isMidi = fileName.endsWith('.mid');
    const isMp3 = fileName.endsWith('.mp3');

    if (!isMidi && !isMp3) {
        showError('Please upload a .mid or .mp3 file');
        return;
    }

    // Stop any playback and clear current song
    stop();
    Tone.Transport.cancel();

    // Set initial volume
    Tone.getDestination().volume.value = document.getElementById('volSlider').value;

    if (isMidi) {
        currentFileType = 'midi';
        loadMidiFile();
    } else if (isMp3) {
        currentFileType = 'mp3';
        loadMp3File();
    }
}

function loadMidiFile() {
    // Init track ended event
    document.removeEventListener('seqEnd', onSequenceEnd);
    document.addEventListener('seqEnd', onSequenceEnd);

    // Get all the midi data
    const midiData = getMidi();

    // If a midi file has been loaded, prepare it for playback
    midiData.then((midiData) => {
        // Establish an instrument/analysers/notes for each track
        const instruments = getInstruments(midiData);
        getAnalysers(instruments);
        allContext(instruments);
        const notes = getNotes(midiData);

        // Load and schedule each part for tracks that have notes
        getParts(notes, instruments);

        // Schedule drawing to take place as soon as playback starts
        Tone.Transport.schedule((time) => {
            Tone.Draw.schedule(() => { 
                drawWave();
            }, time);
        });
    }).catch(error => {
        console.error('Error loading MIDI:', error);
        showError('Failed to load MIDI file');
    });
}

function loadMp3File() {
    // Load MP3 and prepare for playback
    loadMP3().then((audioBuffer) => {
        console.log('MP3 loaded successfully');
        // Ready to play when user clicks play
    }).catch(error => {
        console.error('Error loading MP3:', error);
    });
}

function initRecorder() {
    recorder = new Tone.Recorder();
    console.log('Init recorder: ', recorder);
    Tone.getDestination().connect(recorder);

    Tone.Transport.off('start');
    Tone.Transport.off('stop');
    Tone.Transport.off('pause');


    Tone.Transport.on('start', () => {
        if(recorder.state !== 'started') {
            recorder.start();
            console.log('Start event, new recorder state: ', recorder.state);
        } else {
            console.log('Start event, but recorder already started!');
        }
    });

    // Promise is immediately initialized and waits for the event to finish
    downloadReadyPromise = new Promise(async (resolve) => {
        Tone.Transport.on('stop', () => {
            console.log('Stop event, awaiting recorder end.');

                if(recorder.state !== 'stopped') {
                    setTimeout(async () => {
                            // Recording is returned as a blob
                            const recording = await recorder.stop(); 
                            console.log('Recorder stopped, new recorder state: ', recorder.state);
                            // Download by creating an anchor element and blob url
                            const url = URL.createObjectURL(recording);
                            const anchor = document.createElement("a");
                            anchor.download = "recording.webm";
                            anchor.href = url;
                            let download = anchor;
                            resolve(download);
                    }, 2000); 
                } else {
                    console.log('Stop event, recorder already running!');
                }
            });
        });
}


// Sets volume via slider
function setVolume(sliderVal) {
    if (currentFileType === 'midi') {
        Tone.getDestination().volume.value = sliderVal;
    } else if (currentFileType === 'mp3' && audioContext) {
        // For MP3, adjust the destination gain
        audioContext.destination.maxChannelCount = sliderVal;
    }
}

function playPause() {
    if (currentFileType === 'midi') {
        playPauseMidi();
    } else if (currentFileType === 'mp3') {
        playPauseMp3();
    }
}

function playPauseMidi() {
    if (Tone.Transport.state === 'started') {
        console.log('Pause tone');
        Tone.Transport.pause();
    }
    else if(Tone.Transport.state === 'paused') {
        console.log('Play/Resume tone');
        Tone.Transport.start()
    } else if(Tone.Transport.state === 'stopped') {
        console.log('Tone stopped: Initializing recorder.');
        initRecorder();
        Tone.Transport.start();
    }
}

function playPauseMp3() {
    // For MP3, start playback immediately
    if (audioPlayer) {
        // MP3 already playing - cannot pause, so we'll just show message
        showError('MP3 is already playing. Use Stop to halt playback.');
        return;
    }

    // Load the MP3 and play it
    loadMP3().then((audioBuffer) => {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        initRecorder();
        playMP3(audioBuffer);
    }).catch(error => {
        console.error('Error during MP3 playback:', error);
    });
}

function onSequenceEnd(event) {
    console.log('Sequence reached end event: ', event.detail.message);
    stop();
}
  
function stop() {
    if (currentFileType === 'midi') {
        if (Tone.Transport.state !== 'stopped') {
            console.log('Stop tone');
            Tone.Transport.stop();
        }
    } else if (currentFileType === 'mp3') {
        stopMP3();
    }
}

async function save() {
    if(recorder) {
        console.log('Save, stopping playback if necessary and awaiting download!');
        // Stop playback which fires event and stops recording
        stop();
        // Await for event to complete and to assign the download
        const downloadAnchor = await downloadReadyPromise;
        const errorMessage = document.getElementById('error-message');
        if (downloadAnchor) {
            console.log('Ready, downloading.')
            downloadAnchor.click();
        } else {
            errorMessage.textContent = 'No recording available.';
            errorMessage.style.display = 'block'; // Show error message
            setTimeout(() => { errorMessage.style.display = 'none'; }, 5000);
        }
    } else {
        console.log('Nothing loaded.')
    }
}

