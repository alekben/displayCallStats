// RTC client instance
let client = null;

// Declare variables for the local tracks
let localAudioTrack = null; 
let localVideoTrack = null; 

// Connection parameters
let appId = "7c9a6773eb7b4650831ecdb3a0931dac";
let channel = "TEST";
let uid = 0; // User ID

// Initialize the AgoraRTC client
function initializeClient() {
    client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    setupEventListeners();
}

// Handle client events
function setupEventListeners() {
    client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        console.log("subscribe success");

        if (mediaType === "video") {
            displayRemoteVideo(user);
        }

        if (mediaType === "audio") {
            user.audioTrack.play();
        }
    });

    client.on("user-unpublished", (user) => {
        const remotePlayerContainer = document.getElementById(user.uid);
        remotePlayerContainer && remotePlayerContainer.remove();
    });

    client.on("connection-state-change", (cur, prev, reason) => {
        if (cur === "DISCONNECTED") {
            log(`WebSocket Connection state changed to ${cur} from ${prev} for reason ${reason}.`);
        } else {
            log(`WebSocket Connection state changed to ${cur}.`);
        }
    });

    client.on("peerconnection-state-change", (curState, revState) => {
        if (curState === "disconnected") {
            log(`Media PeerConnection state changed to ${curState} from ${revState}.`);
        } else {
            log(`Media PeerConnection state changed to ${curState}.`);
        }
    });
}

function log(message) {
    document.getElementById("log").appendChild(document.createElement('div')).append(message)
};

// Join a channel and publish local media
async function joinChannel() {
    log("Joining channel...");
    uid = await client.join(appId, channel, null, 0);
    console.log(`Join resolved to UID: ${uid}.`);
    log(`Join resolved to UID: ${uid}.`);
    await createLocalTracks();
    await publishLocalTracks();
    displayLocalVideo();
    console.log("Publish success!");
}

// Create local audio and video tracks
async function createLocalTracks() {
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localVideoTrack = await AgoraRTC.createCameraVideoTrack();
}

// Publish local audio and video tracks
async function publishLocalTracks() {
    await client.publish([localAudioTrack, localVideoTrack]);
}

// Display local video
function displayLocalVideo() {
    const localPlayerContainer = document.createElement("div");
    localPlayerContainer.id = uid;
    localPlayerContainer.textContent = `Local Track: ${uid}`;
    localPlayerContainer.style.width = "640px";
    localPlayerContainer.style.height = "480px";
    document.body.append(localPlayerContainer);
    localVideoTrack.play(localPlayerContainer);
}

// Display remote video
function displayRemoteVideo(user) {
    const remoteVideoTrack = user.videoTrack;
    const remotePlayerContainer = document.createElement("div");
    remotePlayerContainer.id = user.uid.toString();
    remotePlayerContainer.textContent = `Remote user ${user.uid}`;
    remotePlayerContainer.style.width = "640px";
    remotePlayerContainer.style.height = "480px";
    document.body.append(remotePlayerContainer);
    remoteVideoTrack.play(remotePlayerContainer);
}

// Leave the channel and clean up
async function leaveChannel() {
    // Close local tracks
    localAudioTrack.close();
    localVideoTrack.close();

    // Remove local video container
    const localPlayerContainer = document.getElementById(uid);
    localPlayerContainer && localPlayerContainer.remove();

    // Remove all remote video containers
    client.remoteUsers.forEach((user) => {
        const playerContainer = document.getElementById(user.uid);
        playerContainer && playerContainer.remove();
    });

    // Leave the channel
    await client.leave();
}

// Set up button click handlers
function setupButtonHandlers() {
    document.getElementById("join").onclick = joinChannel;
    document.getElementById("leave").onclick = leaveChannel;
}

// Start the basic call
function startBasicCall() {
    initializeClient();
    window.onload = setupButtonHandlers;
}

startBasicCall();