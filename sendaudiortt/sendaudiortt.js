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
    //$("#local-audio-mixing").attr("disabled", true);
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
      console.log("start audio mixing");
    } catch (e) {
      audioMixing.state = "IDLE";
      console.error(e);
    }
  } else {
    showPopup(`No file somehow, stopping`);
    await leave();
  }
}

function toggleAudioMixing() {
  if (audioMixing.state === "PAUSE") {
    playButton.toggleClass('active', true);

    // resume audio mixing
    localTracks.audioMixingTrack.resumeProcessAudioBuffer();
    audioMixing.state = "PLAYING";
  } else {
    playButton.toggleClass('active', false);

    // pause audio mixing
    localTracks.audioMixingTrack.pauseProcessAudioBuffer();
    audioMixing.state = "PAUSE";
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
  }
}