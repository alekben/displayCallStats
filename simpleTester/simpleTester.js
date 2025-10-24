// Web SDK Testing Client
AgoraRTC.setParameter("SHOW_GLOBAL_CLIENT_LIST", true);

// Global state management
let testState = {
    isRunning: false,
    clients: [],
    testTimer: null,
    timeRemaining: 0,
    localVideoTrack: null,
    localAudioTrack: null,
    videoContainer: null
};

// Test configuration
let testConfig = {
    appId: '',
    clientCount: 1,
    channelMode: 'same',
    channelName: 'TEST',
    uidType: 'integer',
    testDuration: 60,
    mediaOptions: 'both'
};

// Initialize the testing client
function initializeTestingClient() {
    log('Testing client initialized');
    setupEventListeners();
    setupButtonHandlers();
    updateUI();
}

// Setup event listeners for device changes
function setupEventListeners() {
    AgoraRTC.on('microphone-changed', async (changedDevice) => {
        log(`Audio device changed: ${changedDevice.state} - ${changedDevice.device.label}`);
    });
}

// Setup button event handlers
function setupButtonHandlers() {
    document.getElementById('startTest').onclick = startTest;
    document.getElementById('stopTest').onclick = stopTest;
    document.getElementById('clearLog').onclick = clearLog;
    
    // Update configuration when form changes
    document.getElementById('appId').onchange = updateConfig;
    document.getElementById('clientCount').onchange = updateConfig;
    document.getElementById('channelMode').onchange = updateConfig;
    document.getElementById('channelName').onchange = updateConfig;
    document.getElementById('uidType').onchange = updateConfig;
    document.getElementById('testDuration').onchange = updateConfig;
    document.getElementById('mediaOptions').onchange = updateConfig;
}

// Update configuration from form
function updateConfig() {
    testConfig.appId = document.getElementById('appId').value;
    testConfig.clientCount = parseInt(document.getElementById('clientCount').value);
    testConfig.channelMode = document.getElementById('channelMode').value;
    testConfig.channelName = document.getElementById('channelName').value;
    testConfig.uidType = document.getElementById('uidType').value;
    testConfig.testDuration = parseInt(document.getElementById('testDuration').value);
    testConfig.mediaOptions = document.getElementById('mediaOptions').value;
    
    // Show/hide channel name input based on mode
    const channelNameGroup = document.querySelector('label[for="channelName"]').parentElement;
    if (testConfig.channelMode === 'same') {
        channelNameGroup.style.display = 'block';
    } else {
        channelNameGroup.style.display = 'none';
    }
}

// Start the test
async function startTest() {
    if (testState.isRunning) {
        log('Test is already running');
        return;
    }
    
    updateConfig();
    
    if (!testConfig.appId) {
        log('Please enter an App ID');
        return;
    }
    
    log('Starting test...');
    testState.isRunning = true;
    testState.timeRemaining = testConfig.testDuration;
    
    updateUI();
    updateStatus('Test Running', 'running');
    
    try {
        // Create and join clients
        await createAndJoinClients();
        
        // Start timer
        startTimer();
        
        log(`Test started with ${testConfig.clientCount} clients`);
    } catch (error) {
        log(`Error starting test: ${error.message}`);
        stopTest();
    }
}

// Create and join multiple clients
async function createAndJoinClients() {
    testState.clients = [];
    
    // Create local tracks if needed
    if (testConfig.mediaOptions === 'both' || testConfig.mediaOptions === 'audio') {
        testState.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    }
    if (testConfig.mediaOptions === 'both' || testConfig.mediaOptions === 'video') {
        testState.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    }
    
    // Display local video if camera is enabled
    if (testState.localVideoTrack) {
        displayLocalVideo();
    }
    
    // Create and join clients
    for (let i = 0; i < testConfig.clientCount; i++) {
        const client = await createClient(i);
        testState.clients.push(client);
    }
    
    log(`Created ${testState.clients.length} clients`);
}

// Create a single client
async function createClient(index) {
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    
    // Generate UID
    const uid = testConfig.uidType === 'string' ? `user_${index}_${Date.now()}` : index;
    
    // Generate channel name
    let channelName;
    if (testConfig.channelMode === 'same') {
        channelName = testConfig.channelName;
    } else {
        channelName = `channel_${index}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Setup event listeners for this client
    setupClientEventListeners(client, index);
    
    try {
        // Join channel
        await client.join(testConfig.appId, channelName, null, uid);
        log(`Client ${index} joined channel ${channelName} with UID ${uid}`);
        
        // Publish tracks if available
        const tracksToPublish = [];
        if (testState.localAudioTrack && (testConfig.mediaOptions === 'both' || testConfig.mediaOptions === 'audio')) {
            tracksToPublish.push(testState.localAudioTrack);
        }
        if (testState.localVideoTrack && (testConfig.mediaOptions === 'both' || testConfig.mediaOptions === 'video')) {
            tracksToPublish.push(testState.localVideoTrack);
        }
        
        if (tracksToPublish.length > 0) {
            await client.publish(tracksToPublish);
            log(`Client ${index} published ${tracksToPublish.length} tracks`);
        }
        
        return {
            client: client,
            index: index,
            uid: uid,
            channelName: channelName
        };
    } catch (error) {
        log(`Error creating client ${index}: ${error.message}`);
        throw error;
    }
}

// Setup event listeners for a specific client
function setupClientEventListeners(client, index) {
    client.on("user-published", async (user, mediaType) => {
        try {
            await client.subscribe(user, mediaType);
            log(`Client ${index}: Subscribed to remote user ${user.uid} ${mediaType}`);
            
            if (mediaType === "video") {
                displayRemoteVideo(user, index);
            }
            
            if (mediaType === "audio") {
                user.audioTrack.play();
            }
        } catch (error) {
            log(`Client ${index}: Error subscribing to user ${user.uid}: ${error.message}`);
        }
    });
    
    client.on("user-unpublished", (user) => {
        log(`Client ${index}: Remote user ${user.uid} unpublished`);
        const remotePlayerContainer = document.getElementById(`remote_${index}_${user.uid}`);
        if (remotePlayerContainer) {
            remotePlayerContainer.remove();
        }
    });
    
    client.on("connection-state-change", (cur, prev, reason) => {
        log(`Client ${index}: Connection state changed to ${cur} from ${prev} (${reason})`);
    });
    
    client.on("peerconnection-state-change", (curState, revState) => {
        log(`Client ${index}: PeerConnection state changed to ${curState} from ${revState}`);
    });
    
    client.on("exception", (error) => {
        log(`Client ${index}: Exception occurred: ${error.message}`);
    });
}

// Display local video
function displayLocalVideo() {
    if (!testState.localVideoTrack) return;
    
    const videoContainer = document.getElementById('videoContainer');
    const localPlayerContainer = document.createElement("div");
    localPlayerContainer.id = "local_video";
    localPlayerContainer.style.width = "320px";
    localPlayerContainer.style.height = "240px";
    localPlayerContainer.style.border = "2px solid #28a745";
    localPlayerContainer.style.borderRadius = "4px";
    localPlayerContainer.style.backgroundColor = "#000";
    localPlayerContainer.style.position = "relative";
    
    const label = document.createElement("div");
    label.textContent = "Local Video";
    label.style.position = "absolute";
    label.style.top = "5px";
    label.style.left = "5px";
    label.style.color = "white";
    label.style.backgroundColor = "rgba(0,0,0,0.7)";
    label.style.padding = "2px 5px";
    label.style.borderRadius = "3px";
    label.style.fontSize = "12px";
    localPlayerContainer.appendChild(label);
    
    videoContainer.appendChild(localPlayerContainer);
    testState.localVideoTrack.play(localPlayerContainer);
    
    testState.videoContainer = localPlayerContainer;
}

// Display remote video
function displayRemoteVideo(user, clientIndex) {
    const videoContainer = document.getElementById('videoContainer');
    const remotePlayerContainer = document.createElement("div");
    remotePlayerContainer.id = `remote_${clientIndex}_${user.uid}`;
    remotePlayerContainer.style.width = "320px";
    remotePlayerContainer.style.height = "240px";
    remotePlayerContainer.style.border = "2px solid #007bff";
    remotePlayerContainer.style.borderRadius = "4px";
    remotePlayerContainer.style.backgroundColor = "#000";
    remotePlayerContainer.style.position = "relative";
    
    const label = document.createElement("div");
    label.textContent = `Remote ${user.uid} (Client ${clientIndex})`;
    label.style.position = "absolute";
    label.style.top = "5px";
    label.style.left = "5px";
    label.style.color = "white";
    label.style.backgroundColor = "rgba(0,0,0,0.7)";
    label.style.padding = "2px 5px";
    label.style.borderRadius = "3px";
    label.style.fontSize = "12px";
    remotePlayerContainer.appendChild(label);
    
    videoContainer.appendChild(remotePlayerContainer);
    user.videoTrack.play(remotePlayerContainer);
}

// Start the test timer
function startTimer() {
    testState.testTimer = setInterval(() => {
        testState.timeRemaining--;
        document.getElementById('timeRemaining').textContent = testState.timeRemaining;
        
        if (testState.timeRemaining <= 0) {
            log('Test duration completed, stopping test...');
            stopTest();
        }
    }, 1000);
    
    document.getElementById('timer').style.display = 'block';
}

// Stop the test
async function stopTest() {
    if (!testState.isRunning) {
        return;
    }
    
    log('Stopping test...');
    testState.isRunning = false;
    
    // Clear timer
    if (testState.testTimer) {
        clearInterval(testState.testTimer);
        testState.testTimer = null;
    }
    
    document.getElementById('timer').style.display = 'none';
    
    // Leave all channels
    for (let i = 0; i < testState.clients.length; i++) {
        try {
            const clientInfo = testState.clients[i];
            await clientInfo.client.leave();
            log(`Client ${i} left channel ${clientInfo.channelName}`);
        } catch (error) {
            log(`Error leaving client ${i}: ${error.message}`);
        }
    }
    
    // Clean up local tracks
    if (testState.localAudioTrack) {
        testState.localAudioTrack.close();
        testState.localAudioTrack = null;
    }
    if (testState.localVideoTrack) {
        testState.localVideoTrack.close();
        testState.localVideoTrack = null;
    }
    
    // Clear video containers
    const videoContainer = document.getElementById('videoContainer');
    videoContainer.innerHTML = '';
    
    // Clear clients array
    testState.clients = [];
    
    updateUI();
    updateStatus('Test Stopped', 'stopped');
    log('Test stopped successfully');
}

// Update UI state
function updateUI() {
    const startButton = document.getElementById('startTest');
    const stopButton = document.getElementById('stopTest');
    
    if (testState.isRunning) {
        startButton.disabled = true;
        stopButton.disabled = false;
    } else {
        startButton.disabled = false;
        stopButton.disabled = true;
    }
}

// Update status display
function updateStatus(message, className) {
    const statusElement = document.getElementById('testStatus');
    statusElement.textContent = message;
    statusElement.className = `status ${className}`;
}

// Clear log
function clearLog() {
    document.getElementById('log').innerHTML = '';
}

// Logging function
function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logElement = document.getElementById('log');
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${timestamp}] ${message}`;
    logElement.appendChild(logEntry);
    logElement.scrollTop = logElement.scrollHeight;
    console.log(message);
}

// Initialize the testing client when page loads
window.onload = function() {
    initializeTestingClient();
};