//MediaRecorder

let recording = document.getElementById("recording");
let startButton = document.getElementById("record");
let downloadButton = document.getElementById("download");
let logElement = document.getElementById("log");
let recordingTimeMS = 10000;


function log(msg) {
  logElement.innerHTML += msg + "\n";
}

function wait(delayInMS) {
  return new Promise(resolve => setTimeout(resolve, delayInMS));
}

function stop(stream) {
  stream.getTracks().forEach(track => track.stop());
  $("#download").attr("hidden", false);
  log("Done recording.");
}

//Handles startRecording being triggered by start button
startButton.addEventListener("click", function() {
      let stream = localTracks.videoTrack.getMediaStreamTrack();
      const vstream = new MediaStream();
      vstream.addTrack(stream);
      streamname = "video_" + localTracks.videoTrack.getTrackId();
      let vvstream = document.getElementById(`${streamname}`);
      download.href = localTracks.videoTrack;
      vvstream.captureStream = vvstream.captureStream || vvstream.mozCaptureStream;
      startRecording(vstream, recordingTimeMS)
      .then (recordedChunks => {
      let recordedBlob = new Blob(recordedChunks, { type: "video/webm; codecs=vp8,opus" });
      vvstream.src = URL.createObjectURL(recordedBlob);
      download.href = URL.createObjectURL(recordedBlob);
      download.download = "RecordedTrack.webm";
      log("Successfully recorded " + recordedBlob.size + " bytes of " + recordedBlob.type + " media.");
      $("#download").attr("hidden", false);
      localTracks.videoTrack.play("local-player");
      })
});

//creates a MediaRecorder, whatever data is available from the defined stream is converted to a data array and returned after the duration

function startRecording(stream, lengthInMS) {
  $("#download").attr("hidden", true);
  let recorder = new MediaRecorder(stream);
  let data = [];

  recorder.ondataavailable = event => data.push(event.data);
  recorder.start();
  log(recorder.state + " for " + (lengthInMS/1000) + " seconds...");

  let stopped = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = event => reject(event.name);
  });

  let recorded = wait(lengthInMS).then(
    () => recorder.state == "recording" && recorder.stop()
  );

  return Promise.all([
    stopped,
    recorded
  ])
  .then(() => data);
}




// create Agora client
var client = AgoraRTC.createClient({
  mode: "p2p",
  codec: "vp9"
});

//var loopback_client = AgoraRTC.createClient({
//  mode: "rtc",
//  codec: "vp9"
//});

//AgoraRTC.setParameter("DISABLE_WEBAUDIO", true);
console.log("Start with Web Audio OFF");
var webAudioOff = true;

AgoraRTC.enableLogUpload();
var localTracks = {
  videoTrack: null,
  audioTrack: null,
  scrTrack: null
};

var localTrackState = {
  audioTrackMuted: false,
  audioTrackEnabled: false
};

var joined = false;
//var loopback = false;

var remoteUsers = {};
//var remoteUsersLoopback = {};
var userCount = 0;

// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null,
  //uidLoopback: null
};

var audioProfiles = [{
  label: "speech_low_quality",
  detail: "16 Khz, mono, 24Kbps",
  value: "speech_low_quality"
}, {
  label: "speech_standard",
  detail: "32 Khz, mono, 24Kbps",
  value: "speech_standard"
}, {
  label: "music_standard",
  detail: "48 Khz, mono, 40 Kbps",
  value: "music_standard"
}, {
  label: "standard_stereo",
  detail: "48 Khz, stereo, 64 Kbps",
  value: "standard_stereo"
}, {
  label: "high_quality",
  detail: "48 Khz, mono, 129 Kbps",
  value: "high_quality"
}, {
  label: "high_quality_stereo",
  detail: "48 Khz, stereo, 192 Kbps",
  value: "high_quality_stereo"
}, {
  label: "320_high",
  detail: "48 Khz, stereo, 320 Kbps",
  value: {
    bitrate: 320,
    sampleRate: 48000,
    sampleSize: 16,
    stereo: true
  }
}];
var curMicProfile;

AgoraRTC.onAutoplayFailed = () => {
  alert("click to start autoplay!");
};

AgoraRTC.onMicrophoneChanged = async changedDevice => {
  // When plugging in a device, switch to a device that is newly plugged in.
  console.log("OnMicrophoneChanged triggered");
  if (changedDevice.state === "ACTIVE") {
    localTracks.audioTrack.setDevice(changedDevice.device.deviceId);
    // Switch to an existing device when the current device is unplugged.
  } else if (changedDevice.device.label === localTracks.audioTrack.getTrackLabel()) {
    const oldMicrophones = await AgoraRTC.getMicrophones();
    oldMicrophones[0] && localTracks.audioTrack.setDevice(oldMicrophones[0].deviceId);
  }
};

async function initDevices() {
  if (joined) {
    if (!localTracks.audioTrack) {
      localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: curMicProfile.value, "AEC": true, "ANS": true, "AGC": true
      });
    } else {
      console.log("mic track already exists, replacing.");
      await client.unpublish(localTracks.audioTrack);
      await localTracks.audioTrack.stop();
      await localTracks.audioTrack.close();
      localTracks.audioTrack = undefined;
      localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: curMicProfile.value, "AEC": true, "ANS": true, "AGC": true
      });
      publishMic();
      $("#setMuted").attr("disabled", false);
      $("#setEnabled").attr("disabled", false);
      $("#setMuted").text("Mute Mic Track");
      $("#setEnabled").text("Disable Mic Track");
      localTrackState.audioTrackEnabled = true;
      localTrackState.audioTrackMuted = false;
      }
    }

  // get mics
  mics = await AgoraRTC.getMicrophones();
  const audioTrackLabel = localTracks.audioTrack.getTrackLabel();
  currentMic = mics.find(item => item.label === audioTrackLabel);
  $(".mic-input").val(currentMic.label);
  $(".mic-list").empty();
  mics.forEach(mic => {
    $(".mic-list").append(`<a class="dropdown-item" href="#">${mic.label}</a>`);
  });
}

async function switchMicrophone(label) {
  currentMic = mics.find(mic => mic.label === label);
  $(".mic-input").val(currentMic.label);
  // switch device of local audio track.
  await localTracks.audioTrack.setDevice(currentMic.deviceId);
}

function initMicProfiles() {
  audioProfiles.forEach(profile => {
    $(".profile-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  curMicProfile = audioProfiles.find(item => item.label == 'speech_low_quality');
  $(".profile-input").val(`${curMicProfile.detail}`);
}

async function changeMicProfile(label) {
  curMicProfile = audioProfiles.find(profile => profile.label === label);
  $(".profile-input").val(`${curMicProfile.detail}`);
  // change the local audio track`s encoder configuration
  initDevices();
}

let statsInterval;

// the demo can auto join channel with params in url
$(() => {
  initMicProfiles();
  $(".profile-list").delegate("a", "click", function (e) {
    changeMicProfile(this.getAttribute("label"));
  });
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
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "p2p",
        codec: "vp9"
      });
    }
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    //await client.enableDualStream();
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
    $("#record").attr("disabled", false);
    $("#createTrack").attr("disabled", false);
    $("#publishTrack").attr("disabled", true);
    //$("#startLoopback").attr("disabled", true);
    $("#setMuted").attr("disabled", true);
    $("#setEnabled").attr("disabled", true);
    joined = true;
  }
});
$("#leave").click(function (e) {
  leave();
});

$("#createTrack").click(function (e) {
  initDevices();
  $("#createTrack").attr("disabled", true);
  $("#publishTrack").attr("disabled", false);
});

$("#publishTrack").click(function (e) {
  publishMic();
  $("#publishTrack").attr("disabled", true);
  //$("#startLoopback").attr("disabled", false);
  $("#setMuted").attr("disabled", false);
  $("#setEnabled").attr("disabled", false);
});

//$("#startLoopback").click(function (e) {
//  if (!loopback) {
//    startLoopbackClient();
//    loopback = true;
//  } else {
//    stopLoopbackClient();
//    loopback = false;
//  }
//  
//});

$("#setMuted").click(function (e) {
  if (!localTrackState.audioTrackMuted) {
    muteAudio();
  } else {
    unmuteAudio();
  }
});

$("#setEnabled").click(function (e) {
  if (localTrackState.audioTrackEnabled) {
    disableAudio();
  } else {
    enableAudio();
  }
});

$("#webAudio").click(function (e) {
  toggleWebAudio();
});

$('#agora-collapse').on('show.bs.collapse	', function () {
  initDevices();
});
$(".mic-list").delegate("a", "click", function (e) {
  switchMicrophone(this.text);
});

async function toggleWebAudio() {
  if (webAudioOff) {
    console.log("Turning WebAudio back ON.");
    webAudioOff = false;
    AgoraRTC.setParameter("DISABLE_WEBAUDIO", false);
    $("#webAudio").text("Disable WebAudio");
  } else {
    console.log("Turning WebAudio OFF.");
    webAudioOff = true;
    AgoraRTC.setParameter("DISABLE_WEBAUDIO", true);
    $("#webAudio").text("Enable WebAudio");
  }
}

async function publishMic() {
  if (!localTracks.audioTrack) {
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: curMicProfile.value, "AEC": true, "ANS": true, "AGC": true
    });
  }
    await client.publish(localTracks.audioTrack);
    console.log("Published mic track");
    localTrackState.audioTrackMuted = false;
    localTrackState.audioTrackEnabled = true;
}

async function muteAudio() {
  if (!localTracks.audioTrack) return;
  /**
   * After calling setMuted to mute an audio or video track, the SDK stops sending the audio or video stream. Users whose tracks are muted are not counted as users sending streams.
   * Calling setEnabled to disable a track, the SDK stops audio or video capture
   */
  await localTracks.audioTrack.setMuted(true);
  localTrackState.audioTrackMuted = true;
  $("#setMuted").text("Unmute Mic Track");
}

async function unmuteAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setMuted(false);
  localTrackState.audioTrackMuted = false;
  $("#setMuted").text("Mute Mic Track");
}

async function disableAudio() {
  if (!localTracks.audioTrack) return;
  /**
   * After calling setMuted to mute an audio or video track, the SDK stops sending the audio or video stream. Users whose tracks are muted are not counted as users sending streams.
   * Calling setEnabled to disable a track, the SDK stops audio or video capture
   */
  await localTracks.audioTrack.setEnabled(false);
  localTrackState.audioTrackEnabled = false;
  $("#setEnabled").text("Enable Mic Track");
}

async function enableAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(true);
  localTrackState.audioTrackEnabled = true;
  $("#setEnabled").text("Disable Mic Track");
}

async function join() {
  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  client.on("exception", handleLowInput);
  //AgoraRTC.setParameter("MEDIA_DEVICE_CONSTRAINTS",{audio:{googHighpassFilter: {exact:true}}});

  // join the channel
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  //if (!localTracks.audioTrack) {
  //  localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
  //    encoderConfig: "speech_low_quality"
  //  });
  //}
  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: "720p_3"});
  }
  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#joined-setup").css("display", "flex");

  // publish local tracks to channel
  await client.publish(localTracks.videoTrack);
  console.log("publish cam success");
  initStats();
}
async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }
  destructStats();
  joined = false;

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist-row1").html("");
  $("#remote-playerlist-row2").html("");
  $("#remote-playerlist-row3").html("");
  $("#remote-playerlist-row4").html("");

  // leave the channel
  await client.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#createTrack").attr("disabled", true);
  $("#publishTrack").attr("disabled", true);
  $("#record").attr("disabled", true);
  //$("#startLoopback").attr("disabled", true);
  $("#setMuted").attr("disabled", true);
  $("#setEnabled").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  console.log("client leaves channel success");
  //if (loopback) {
  //  stopLoopbackClient();
  //}
}

//async function startLoopbackClient() {
  // add event listener to play remote tracks when remote user publishs.
//  loopback_client.on("user-published", handleUserPublishedLoopback);
//  loopback_client.on("user-unpublished", handleUserUnpublishedLoopback);

  // join the channel
//  options.uidLoopback = await loopback_client.join(options.appid, options.channel, options.token || null, null);
//  $("#startLoopback").text("Stop Loopback");
//}

//async function stopLoopbackClient() {
//  await loopback_client.leave();
//  remoteUsersLoopback = {};
//  $("#startLoopback").text("Start Loopback");
//}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
        <div id="player-wrapper-${uid}">
          <div class="player-with-stats">
            <div id="player-${uid}" class="remotePlayer"></div>
            <div class="track-stats remoteStats"></div>
          </div>
        </div>
    `);
    switch (userCount) {
      case 1:
        $("#remote-playerlist-row1").append(player);
        console.log(`Adding remote to row 1 - User Count: ${userCount}`);
        break;
      case 2:
        $("#remote-playerlist-row1").append(player);
        console.log(`Adding remote to row 1 - User Count: ${userCount}`);
        break;
      case 3:
        $("#remote-playerlist-row2").append(player);
        console.log(`Adding remote to row 2 - User Count: ${userCount}`);
        break;
      case 4:
        $("#remote-playerlist-row2").append(player);
        console.log(`Adding remote to row 2 - User Count: ${userCount}`);
        break;
      case 5:
        $("#remote-playerlist-row3").append(player);
        console.log(`Adding remote to row 3 - User Count: ${userCount}`);
        break;
      case 6:
        $("#remote-playerlist-row3").append(player);
        console.log(`Adding remote to row 3 - User Count: ${userCount}`);
        break;
      case 7:
        $("#remote-playerlist-row4").append(player);
        console.log(`Adding remote to row 4 - User Count: ${userCount}`);
        break;
      case 8:
        $("#remote-playerlist-row4").append(player);
        console.log(`Adding remote to row 4 - User Count: ${userCount}`);
        break;
      default:
        console.log(`This shouldn't have happened, remote user count is: ${userCount}`);
    }
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

//async function subscribeLoopback(user, mediaType) {
//  console.log("Trying loopback subscription");
//  await loopback_client.subscribe(user, mediaType);
//  console.log("subscribe success");
//  if (mediaType === 'audio') {
//    user.audioTrack.play();
//  }
//}

function handleUserPublished(user, mediaType) {
  if (userCount >= 8 ) {
    console.log("8 remotes already publishing, not supporting more right now.");
    $("#room-full-alert").css("display", "block");
  } else {
    const id = user.uid;
    remoteUsers[id] = user;
    if (mediaType === 'video') {
      userCount = getRemoteCount(remoteUsers);
      console.log(`Remote User Video Count now: ${userCount}`);
    }
    subscribe(user, mediaType);
  }
}

//function handleUserPublishedLoopback(user, mediaType) {
//    const id = user.uid;
//    if (id === options.uid) {
//      if (mediaType === "audio") {
//        remoteUsersLoopback[id] = user;
//        subscribeLoopback(user, mediaType);    
//      }
//    }
//}

//function handleUserUnpublishedLoopback(user, mediaType) {
//  if (mediaType === 'audio') {
//    if (options.uid = user.uid) {
//      delete remoteUsersLoopback[user.uid];
//    }    
//  }
//}

function handleLowInput(event) {
  if (event == 2001) {
    console.log("audio input low trigger, reset track");
    localTracks.audioTrack.setEnabled(false).then(() => {
      localTracks.audioTrack.setEnabled(true);
    });
  }
}

function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
  }
  userCount = getRemoteCount(remoteUsers);
  console.log(`Remote User Count now: ${userCount}`);
}

function getRemoteCount( object ) {
  var length = 0;
  for( var key in object ) {
      if( object.hasOwnProperty(key) ) {
          ++length;
      }
  }
  return length;
};

// start collect and show stats information
function initStats() {
  statsInterval = setInterval(flushStats, 1000);
}

// stop collect and show stats information
function destructStats() {
  clearInterval(statsInterval);
  $("#session-stats").html("");
  $("#transport-stats").html("");
  $("#local-stats").html("");
}

// flush stats views
function flushStats() {
  // get the client stats message
  const clientStats = client.getRTCStats();
  const clientStatsList = [{
    description: "Host Count",
    value: clientStats.UserCount,
    unit: ""
  }, {
    description: "Joined Duration",
    value: clientStats.Duration,
    unit: "s"
  }, {
    description: "Bitrate receive",
    value: clientStats.RecvBitrate,
    unit: "bps"
  }, {
    description: "Bitrate sent",
    value: clientStats.SendBitrate,
    unit: "bps"
  }, {
    description: "Outgoing B/W",
    value: clientStats.OutgoingAvailableBandwidth.toFixed(3),
    unit: "kbps"
  }, {
    description: "RTT to SD-RTN Edge",
    value: clientStats.RTT,
    unit: "ms"
  }];
  $("#client-stats").html(`
    ${clientStatsList.map(stat => `<class="stats-row">${stat.description}: ${stat.value} ${stat.unit}<br>`).join("")}
  `);

// get the local track stats message
const localStats = {
  video: client.getLocalVideoStats(),
  //audio: client.getLocalAudioStats()
};
const localStatsList = [{
  description: "Capture FPS",
  value: localStats.video.captureFrameRate,
  unit: ""
  }, {
  description: "Send FPS",
  value: localStats.video.sendFrameRate,
  unit: ""
  }, {
  description: "Video encode delay",
  value: Number(localStats.video.encodeDelay).toFixed(2),
  unit: "ms"
  }, {
  description: "Video send resolution height",
  value: localStats.video.sendResolutionHeight,
  unit: ""
  }, {
  description: "Video send resolution width",
  value: localStats.video.sendResolutionWidth,
  unit: ""
  },  {
  description: "Send video bit rate",
  value: localStats.video.sendBitrate,
  unit: "bps"
  }, {
  description: "Total video packets loss",
  value: localStats.video.sendPacketsLost,
  unit: ""
  }, {
  description: "Total video freeze time",
  value: localStats.video.totalFreezeTime,
  unit: "s"
}];
$("#local-stats").html(`
  ${localStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
`);
Object.keys(remoteUsers).forEach(uid => {
  // get the remote track stats message
  const remoteTracksStats = {
    video: client.getRemoteVideoStats()[uid],
    //audio: client.getRemoteAudioStats()[uid]
  };
  const remoteTracksStatsList = [{
    description: "Codec",
    value: remoteTracksStats.video.codecType,
    unit: ""
  }, {
    description: "Receiving FPS",
    value: remoteTracksStats.video.receiveFrameRate,
    unit: ""
  }, {
    description: "Render FPS",
    value: remoteTracksStats.video.renderFrameRate,
    unit: ""
  }, {
    description: "Video received height",
    value: remoteTracksStats.video.receiveResolutionHeight,
    unit: ""
  }, {
    description: "Video received width",
    value: remoteTracksStats.video.receiveResolutionWidth,
    unit: ""
  }, {
    description: "Receiving video bitrate",
    value: remoteTracksStats.video.receiveBitrate,
    unit: "bps"
  }, {
    description: "Video receive delay",
    value: Number(remoteTracksStats.video.receiveDelay).toFixed(0),
    unit: "ms"
  }, {
    description: "Video packet lossrate",
    value: Number(remoteTracksStats.video.receivePacketsLost).toFixed(3),
    unit: "%"
  }, {
    description: "Total video freeze time",
    value: remoteTracksStats.video.totalFreezeTime,
    unit: "s"
  }, {
    description: "video freeze rate",
    value: Number(remoteTracksStats.video.freezeRate).toFixed(3),
    unit: "%"
  }];
  $(`#player-wrapper-${uid} .track-stats`).html(`
    ${remoteTracksStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
  `);
});
}
