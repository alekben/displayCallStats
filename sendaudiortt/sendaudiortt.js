var popups = 0;

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
}

var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});

var localTracks = {
  audioMixingTrack: null
};

var options = {
  appid: null,
  channel: null,
  uid: null
};

var audioMixing = {
  state: "IDLE",
  // "IDLE" | "LOADING | "PLAYING" | "PAUSE"
  duration: 0
};

var sttState = {
  state: "OFFLINE",
  pubBot: "444"
}

let transcribeIndex = 0;

const playButton = $(".play");
playButton.click(function () {
  if (audioMixing.state === "IDLE" || audioMixing.state === "LOADING") return;
  toggleAudioMixing();
  return false;
});
let audioMixingProgressAnimation;


$("#join-form").submit(async function (e) {
  e.preventDefault();
  const file = $("#local-file").prop("files")[0];
  if (!file) {
    console.warn("please choose a audio file");
    showPopup(`Please choose a file to transcribe first!`);
    return;
  }
  try {
    options.channel = generateRandomString(10);
    options.uid = Number(12345);
    options.appid = "7c9a6773eb7b4650831ecdb3a0931dac";
    await join();
  } catch (error) {
    console.error(error);
  } finally {
    //start rtt
    $("#join").attr("disabled", true);
    $("#leave").attr("disabled", false);
    //$("#audio-controls").attr("hidden", false);
    //$("#audio-volume").attr("hidden", false);
    //$("#audio-speed").attr("hidden", false);
    //$("#local-audio-mixing").attr("disabled", true);
    $("#speed").attr("disabled", false); // Enable speed control
    await startTranscription();
    startAudioMixing(file);
  }
});



$("#leave").click(async function (e) {
  leave();
});

$(".audio-bar .progress").click(function (e) {
  setAudioMixingPosition(e.offsetX);
  return false;
});

$("#volume").click(function (e) {
  setVolume($("#volume").val());
});

$("#speed").click(function (e) {
  setSpeed($("#speed").val());
});


function setVolume(value) {
  // set the audio mixing playing position
  localTracks.audioMixingTrack.setVolume(parseInt(value));
}

function setSpeed(value) {
  // set the audio mixing speed
  localTracks.audioMixingTrack.setAudioBufferPlaybackSpeed(parseInt(value)*10);
}

function setAudioMixingPosition(clickPosX) {
  if (audioMixing.state === "IDLE" || audioMixing.state === "LOADING") return;
  const newPosition = clickPosX / $(".progress").width();

  // set the audio mixing playing position
  localTracks.audioMixingTrack.seekAudioBuffer(newPosition * audioMixing.duration);
}

async function startAudioMixing(file) {
  if (audioMixing.state === "PLAYING" || audioMixing.state === "LOADING") return;
  const options = {};
  if (file) {
    clearTranscription(); // Clear the previous transcription
    options.source = file;
    try {
      audioMixing.state = "LOADING";
      localTracks.audioMixingTrack = await AgoraRTC.createBufferSourceAudioTrack(options);
      await client.publish(localTracks.audioMixingTrack);
      localTracks.audioMixingTrack.play();
      localTracks.audioMixingTrack.startProcessAudioBuffer({
        loop: false
      });
      audioMixing.duration = localTracks.audioMixingTrack.duration;
      $(".audio-duration").text(toMMSS(audioMixing.duration));
      playButton.toggleClass('active', true);
      setAudioMixingProgress();

      audioMixing.state = "PLAYING";
      sttState.state = "TRANSCRIBING"; // Set state to transcribing
      updateStateIndicator();
      $("#download").attr("disabled", true); // Disable download button while transcribing
      console.log("start audio mixing");

      //const levelBox = document.getElementById('level');

      //const levelContainer = document.createElement('div');
      //levelContainer.className = 'level';

      //const levelBar = document.createElement('div');
      //levelBar.className = 'level-inner';

      //levelContainer.appendChild(levelBar);
      //levelBox.appendChild(levelContainer);

      //const audioContext = new AudioContext();
      //const analyser = audioContext.createAnalyser();
      //const sttSource = audioContext.createMediaStreamSource(localTracks.audioMixingTrack.);
      //microphone.connect(analyser);
    
      //analyser.fftSize = 256;
      //const bufferLength = analyser.frequencyBinCount;
      //const dataArray = new Uint8Array(bufferLength);
    
      //function updateLevel() {
      //  analyser.getByteFrequencyData(dataArray);
      //  let sum = 0;
      //  for (let i = 0; i < bufferLength; i++) {
      //    sum += dataArray[i];
      //  }
      //  const average = sum / bufferLength;
      //
      //  levelBar.style.width = `${average}%`;
      //
      //  requestAnimationFrame(updateLevel);
      //}
      //
      //updateLevel();
    } catch (e) {
      audioMixing.state = "IDLE";
      console.error(e);
    }
  } else {
    showPopup(`No file somehow, stopping`);
    await leave();
  }
}

let pendingPause = false; 
function toggleAudioMixing() {
  if (audioMixing.state === "PAUSE") {
    playButton.toggleClass('active', true);

    if (!pendingPause) {
    // resume audio mixing
    localTracks.audioMixingTrack.resumeProcessAudioBuffer();
    audioMixing.state = "PLAYING";

    sttState.state = "TRANSCRIBING"; // Set state back to transcribing
    updateStateIndicator();
    }
    else {
      pendingPause = true;
      console.log("Pending pause...");
    }
  } else {
    playButton.toggleClass('active', false);

    // pause audio mixing
    localTracks.audioMixingTrack.pauseProcessAudioBuffer();
    audioMixing.state = "PAUSE";

    sttState.state = "PAUSED"; // Set state to paused
    updateStateIndicator();
  }
}

function stopAudioMixing() {
  if (audioMixing.state === "IDLE" || audioMixing.state === "LOADING") return;
  audioMixing.state = "IDLE";

  localTracks.audioMixingTrack.stopProcessAudioBuffer();
  localTracks.audioMixingTrack.stop();
  $(".progress-bar").css("width", "0%");
  $(".audio-current-time").text(toMMSS(0));
  $(".audio-duration").text(toMMSS(0));
  playButton.toggleClass('active', false);
  cancelAnimationFrame(audioMixingProgressAnimation);

  sttState.state = "OFFLINE"; // Set state to offline
  updateStateIndicator();

  $("#download").attr("disabled", false); // Enable download button
}

function setAudioMixingProgress() {
  audioMixingProgressAnimation = requestAnimationFrame(setAudioMixingProgress);
  const currentTime = localTracks.audioMixingTrack.getCurrentTime();
  $(".progress-bar").css("width", `${currentTime / audioMixing.duration * 100}%`);
  $(".audio-current-time").text(toMMSS(currentTime));
}

async function join() {
  client.on("user-joined", handleUserJoined);
  client.on("user-left", handleUserLeft);
  client.on("stream-message", handleSTT);

  options.uid = await client.join(options.appid, options.channel, null, options.uid);
  $("#local-player-name").text(`localVideo(${options.uid})`);
  showPopup(`Join channel success`);
}

async function leave() {
  stopAudioMixing();
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = null;
    }
  }

  // leave the channel
  await client.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  //$("#audio-controls").attr("hidden", true);
  //$("#audio-volume").attr("hidden", true);
  //$("#audio-speed").attr("hidden", true);
  $("#speed").attr("disabled", true); // Disable speed control
}

function handleUserJoined(user) {
  const id = user.uid;
  if (id == sttState.pubBot) {
    showPopup(`STT bot ${user.uid} joined.`);
    sttState.state = "TRANSCRIBING";
    //indicate STT bot joined
    updateStateIndicator();
  } else {
    showPopup(`Some user other than pubBot joined.`);
  }
}

function handleUserLeft(user) {
  const id = user.uid;
  if (id == sttState.pubBot) {
    showPopup(`STT bot ${user.uid} left.`);
    //indicate STT bot left
    sttState.state = "OFFLINE";
    updateStateIndicator();
    $("#download").attr("disabled", false); // Enable download button
    leave();
  } else {
    showPopup(`Some user other than pubBot left.`);
  }
}

function handleSTT(msgUid, data) {
  // use protobuf decode data
  const msg = $protobufRoot.lookup("Text").decode(data) || {};
  const {
    words,
    data_type,
    trans = [],
    duration_ms,
    uid
  } = msg;
  if (data_type == "transcribe") {
    if (words.length) {
      let isFinal = false;
      let text = "";
      words.forEach(item => {
        if (item.isFinal) {
          isFinal = true;
        }
        text += item?.text;
      });
      //addTranscribeItem(uid, text);
      if (isFinal) {
        const currPlaybackTime = localTracks.audioMixingTrack.getCurrentTime();
        const sentStartTime = (currPlaybackTime * 1000) - duration_ms;
        const formattedStartTime = toMMSS(sentStartTime / 1000);
        addTranscribeItem(formattedStartTime, text);
        transcribeIndex++;

        if (pendingPause) {
          console.log("Pausing audio after final STT...");
          localTracks.audioMixingTrack.pauseProcessAudioBuffer();
          audioMixing.state = "PAUSE";
          sttState.state = "PAUSED"; // Set state to paused
          updateStateIndicator();
          pendingPause = false; // Reset the pause flag
        }
      }
    }
  } 
}

function addTranscribeItem(uid, msg) {
  if ($(`#transcribe-${transcribeIndex}`)[0]) {
    $(`#transcribe-${transcribeIndex} .msg`).html(msg);
  } else {
    const $item = $(`<div class="item" id="transcribe-${transcribeIndex}">
    <span class="uid">${uid}</span>:
    <span class="msg">${msg}</span>
  </div>`);
    $("#stt-transcribe .content").append($item);
    document.querySelector("#stt-transcribe").scrollTop = document.querySelector("#stt-transcribe").scrollHeight;
  }
}

// calculate the MM:SS format from millisecond
function toMMSS(second) {
  // const second = millisecond / 1000;
  let MM = parseInt(second / 60);
  let SS = parseInt(second % 60);
  MM = MM < 10 ? "0" + MM : MM;
  SS = SS < 10 ? "0" + SS : SS;
  return `${MM}:${SS}`;
}

function showPopup(message) {
  const newPopup = popups + 1;
  console.log(`Popup count: ${newPopup}`);
  const y = $(`<div id="popup-${newPopup}" class="popupHidden">${message}</div>`);
  $("#popup-section").append(y);
  var x = document.getElementById(`popup-${newPopup}`);
  x.className = "popupShow";
  z = popups * 10;
  $(`#popup-${newPopup}`).css("left", `${z}%`);
  popups++;
  setTimeout(function(){ $(`#popup-${newPopup}`).remove(); popups--;}, 5000);
}

//STT variables
var gatewayAddress = "https://api.agora.io";
let taskId = '';
let tokenName = '';

function GetAuthorization() {
  const authorization = 'Basic M2ZjOTQ4MGU2YWFhNDIwY2I3NjZmNDQ0ZDY2N2IyMjY6ZDI2N2Y1YzMxZDNkNGJkZmFmZTA0ODJmYTQ4ZDA3ZmI=';
  return authorization;
}

//STT functions
async function startTranscription() {
  const authorization = GetAuthorization();
  if (!authorization) {
    throw new Error("key or secret is empty");
  }
  const data = await acquireToken();
  tokenName = data.tokenName;
  const url = `${gatewayAddress}/v1/projects/${options.appid}/rtsc/speech-to-text/tasks?builderToken=${tokenName}`;
  const pullUid = '333';
  const pushUid = '444';
  const speakingLanguage = 'en-US'
  const s3Bucket = 'dev-generic';
  const AKey = 'AKIAZI' + '2LH7B7M' + 'Q2XWELL';
  const SKey= 'EnkQyzx2' + '8Vgpg9bV1' + 'kW9JifV' + 'i4VYYvpw' + '66PU2yqS';
  const s3Vendor = Number(1);
  const s3Region = Number(1);
  const s3FileNamePrefix = options.channel;
  
    let body = {
      "languages": [
        speakingLanguage
      ],
      "maxIdleTime": 60,
      "rtcConfig": {
          "channelName": options.channel,
          "subBotUid": pullUid,
          "pubBotUid": pushUid,
      }
    };
    if (s3Bucket != "") {
      body.captionConfig =
            {
              "storage":{
                  "accessKey": AKey,
                  "secretKey": SKey,
                  "bucket": s3Bucket,
                  "vendor": s3Vendor,
                  "region": s3Region
              }
            };
     }   


    if (s3FileNamePrefix) {
      body.captionConfig.storage = {
        ...body.captionConfig.storage,fileNamePrefix: [
            s3FileNamePrefix
        ]
      }
    }

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Authorization": GetAuthorization()
    },
    body: JSON.stringify(body)
  });
  res = await res.json();
  taskId = res.taskId;
  return res;
}

async function acquireToken() {
  const url = `${gatewayAddress}/v1/projects/${options.appid}/rtsc/speech-to-text/builderTokens`;
  const data = {
    instanceId: options.channel
  };
  let res = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Authorization": GetAuthorization()
    },
    body: JSON.stringify(data)
  });
  if (res.status == 200) {
    res = await res.json();
    console.log()
    return res;
  } else {
    // status: 504
    // please enable the realtime transcription service for this appid
    console.error(res.status, res);
    throw new Error(res);
  }
}

async function queryTranscription() {
  if (!taskId) {
    return
  }
  const url = `${gatewayAddress}/v1/projects/${options.appid}/rtsc/speech-to-text/tasks/${taskId}?builderToken=${tokenName}`;
  await fetch(url, {
    method: 'GET',
    headers: {
      "Content-Type": "application/json",
      "Authorization": GetAuthorization()
    }
})
  .then(response => response.json())
    .then(json => {
      console.log(json);
    }
  );
}

async function stopTranscription() {
  if (!taskId) {
    return;
  }
  const url = `${gatewayAddress}/v1/projects/${options.appid}/rtsc/speech-to-text/tasks/${taskId}?builderToken=${tokenName}`;
  let res = await fetch(url, {
    method: 'DELETE',
    headers: {
      "Content-Type": "application/json",
      "Authorization": GetAuthorization()
    }
  });
  taskId = null;
}

/**
 * Downloads the transcribed text from the element with id "stt-transcribe"
 * as a plain text file named "transcription.txt".
 */
function downloadTxt() {
  const text = document.getElementById("stt-transcribe").innerText;
  const blob = new Blob([text], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "transcription.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function updateStateIndicator() {
  const stateIndicator = document.getElementById("state-indicator");
  const stateText = document.getElementById("state-text");
  const bouncingDots = document.getElementById("bouncing-dots");

  if (sttState.state === "OFFLINE") {
    stateIndicator.className = "state-offline";
    stateText.textContent = "Offline";
    bouncingDots.style.display = "none";
  } else if (sttState.state === "TRANSCRIBING") {
    stateIndicator.className = "state-transcribing";
    stateText.textContent = "Transcribing";
    bouncingDots.style.display = "inline-flex";
  } else if (sttState.state === "PAUSED") {
    stateIndicator.className = "state-paused";
    stateText.textContent = "Paused";
    bouncingDots.style.display = "none";
  }
}

function clearTranscription() {
  $("#stt-transcribe .content").empty(); // Clear the content area
  transcribeIndex = 0; // Reset the transcription index
}