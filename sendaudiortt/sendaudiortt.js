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
  state: "OFFLINE"
}

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
    //indicate STT bot joined
  } else {
    showPopup(`Some user other than pubBot joined.`);
  }
}

function handleUserLeft(user) {
  const id = user.uid;
  if (id == sttState.pubBot) {
    showPopup(`STT bot ${user.uid} left.`);
    //indicate STT bot left
    leave();
  } else {
    showPopup(`Some user other than pubBot left.`);
  }
}

function handleSTT(msgUid, data) {
  // use protobuf decode data
  const msg = $protobufRoot.lookup("Text").decode(data) || {};
  console.log("handleStreammessage", msg);
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
      addTranscribeItem(uid, text);
      if (isFinal) {
        addToCaptions(text);
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
    $("#stt-transcribe .content").prepend($item);
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