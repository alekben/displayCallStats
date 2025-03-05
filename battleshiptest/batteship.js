//random
async function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
    return result;
}


//Agora
var client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp9"
});

var localTracks = {
    audioTrack: null,
    videoTrack: null
};

var remoteUsers = {};

function handleUserJoined(user) {
    const id = user.uid;
    updateUIDs(id, "add");
    showPopup(`UID ${id} user-joined`);
};
function handleUserPublished(user, mediaType) {
    const id = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}
function handleUserUnpublished(user, mediaType) {
    const id = user.uid;
    if (mediaType === 'video') {
      //switch to avatar
    }
}
function handleUserLeft(user) {
    const id = user.uid;
    delete remoteUsers[id];
};
async function subscribe(user, mediaType) {
    await client.subscribe(user, mediaType);
    if (mediaType === 'video') {
      user.videoTrack.play(`remotePlayer`);
    }
    if (mediaType === 'audio') {
      user.audioTrack.play();
    }
}


//button functions
async function startGame() {
    if (!client) {
        client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    }
    
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);
    //client.on("user-info-updated", handleUserInfoUpdated);
    const channel = await generateRandomString(10);
    await client.join("7c9a6773eb7b4650831ecdb3a0931dac", channel, null, "PlayerA");

    if (!localTracks.audioTrack) {
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: "music_standard"
        });
    };
    if (!localTracks.videoTrack) {
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
           encoderConfig: "480p_2"
        });
    };
    await client.publish(Object.values(localTracks));
    localTracks.videoTrack.play("localPlayer");

    const startButton = document.getElementById("start");
    startButton.disabled = true;
    const joinButton = document.getElementById("join")
    joinButton.disabled = true;
    const endButton = document.getElementById("end")
    endButton.disabled = false;
  }

  async function joinGame() {
    try {
        const res = await fetch(
          "https://malb3vrc6lk6qppe3ymsfv63cy0nsjvh.lambda-url.us-east-2.on.aws/", {
            method: "GET",
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json",
                "Content-Type": "application/json"
              }});
        const response = await res.json();
        console.log("User Count 1 Channels: ", response);
      } catch (err) {
        console.log(err);
      }
  }

  async function endGame() {
    await client.sendStreamMessage("end_game");
    await client.unpublish();
    for (trackName in localTracks) {
        var track = localTracks[trackName];
        if (track) {
          track.stop();
          track.close();
          localTracks[trackName] = undefined;
        }
      }
    await client.leave()
    const startButton = document.getElementById("start");
    startButton.disabled = false;
    const joinButton = document.getElementById("join")
    joinButton.disabled = false;
    const endButton = document.getElementById("end")
    endButton.disabled = true;
  }


