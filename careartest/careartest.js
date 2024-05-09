// create Agora client
var clientSender = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});

var clientListener = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});

//client.setClientRole("host");

var localTracks = {
  videoTrack: null,
  audioTrack: null,
  audioMixingTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  uid2: null,
  token: null,
  audioEnabled: true
};
var audioMixing = {
  state: "IDLE",
  // "IDLE" | "LOADING | "PLAYING" | "PAUSE"
  duration: 0
};
const playButton = $(".play");
let audioMixingProgressAnimation;

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.uid = urlParams.get("uid");
  if (options.appid && options.channel) {
    $("#uid").val(options.uid);
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
});
$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    await join();
    if (options.token) {
      $("#success-alert-with-token").css("display", "block");
    } else {
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      $("#success-alert").css("display", "block");
    }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
    $("#audio-mixing").attr("disabled", false);
    $("#stop-audio-mixing").attr("disabled", false);
    $("#setEnabled").attr("disabled", false);
  }
});
$("#setEnabled").click(async function (e) {
  switchSetEnabled();
});
$("#leave").click(async function (e) {
  leave();
});
$("#audio-mixing").click(function (e) {
  startAudioMixing();
});
$("#stop-audio-mixing").click(function (e) {
  stopAudioMixing();
  return false;
});
$(".audio-bar .progress").click(function (e) {
  setAudioMixingPosition(e.offsetX);
  return false;
});
$("#volume").click(function (e) {
  setVolume($("#volume").val());
});

playButton.click(function () {
  if (audioMixing.state === "IDLE" || audioMixing.state === "LOADING") return;
  toggleAudioMixing();
  return false;
});
function setAudioMixingPosition(clickPosX) {
  if (audioMixing.state === "IDLE" || audioMixing.state === "LOADING") return;
  const newPosition = clickPosX / $(".progress").width();

  // set the audio mixing playing position
  localTracks.audioMixingTrack.seekAudioBuffer(newPosition * audioMixing.duration);
}
function setVolume(value) {
  // set the audio mixing playing position
  localTracks.audioMixingTrack.setVolume(parseInt(value));
}
async function switchSetEnabled() {
  await localTracks.audioTrack.setEnabled(!options.audioEnabled);
  options.audioEnabled = !options.audioEnabled;
}
async function startAudioMixing(file) {
  if (audioMixing.state === "PLAYING" || audioMixing.state === "LOADING") return;
  const options = {};
  if (file) {
    options.source = file;
  } else {
    options.source = "HeroicAdventure.mp3";
  }
  try {
    audioMixing.state = "LOADING";
    // if the published track will not be used, you had better unpublish it
    if (localTracks.audioMixingTrack) {
      await clientSender.unpublish(localTracks.audioMixingTrack);
    }
    // start audio mixing with local file or the preset file
    localTracks.audioMixingTrack = await AgoraRTC.createBufferSourceAudioTrack(options);
    await clientSender.publish(localTracks.audioMixingTrack);
    //localTracks.audioMixingTrack.play();
    localTracks.audioMixingTrack.startProcessAudioBuffer({
      loop: true
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
}
function stopAudioMixing() {
  if (audioMixing.state === "IDLE" || audioMixing.state === "LOADING") return;
  audioMixing.state = "IDLE";

  // stop audio mixing track
  localTracks.audioMixingTrack.stopProcessAudioBuffer();
  localTracks.audioMixingTrack.stop();
  $(".progress-bar").css("width", "0%");
  $(".audio-current-time").text(toMMSS(0));
  $(".audio-duration").text(toMMSS(0));
  playButton.toggleClass('active', false);
  cancelAnimationFrame(audioMixingProgressAnimation);
  console.log("stop audio mixing");
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
function setAudioMixingProgress() {
  audioMixingProgressAnimation = requestAnimationFrame(setAudioMixingProgress);
  const currentTime = localTracks.audioMixingTrack.getCurrentTime();
  $(".progress-bar").css("width", `${currentTime / audioMixing.duration * 100}%`);
  $(".audio-current-time").text(toMMSS(currentTime));
}

async function join() {
  // add event listener to play remote tracks when remote user publishs.
  //clientSender.on("user-published", handleUserPublished);
  //clientSender.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [options.uid, localTracks.videoTrack, localTracks.audioTrack] = await Promise.all([
  // join the channel
  clientSender.join(options.appid, options.channel, options.token || null, options.uid || null),
  // create local tracks, using microphone and camera
  AgoraRTC.createCameraVideoTrack(),
  AgoraRTC.createMicrophoneAudioTrack()]);

  clientListener.on("user-published", handleUserPublished);
  clientListener.on("user-unpublished", handleUserUnpublished);
  options.uid2 = await clientListener.join(options.appid, options.channel, options.token || null, options.uid2 || null);

  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);

  // publish local tracks to channel
  await clientSender.publish(localTracks.videoTrack);
  //localTracks.audioTrack.setMuted(true);
  console.log("publish success");
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
  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await clientSender.leave();
  await clientListener.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#setEnabled").attr("disabled", true);
  $("#audio-mixing").attr("disabled", true);
  $("#stop-audio-mixing").attr("disabled", true);
  console.log("client leaves channel success");
}
async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await clientListener.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}
function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}
function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
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