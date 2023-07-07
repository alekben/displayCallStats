var client;

AgoraRTC.setParameter("DISABLE_WEBAUDIO", true);
console.log("Start with Web Audio off");
var webAudioOff = true;

AgoraRTC.enableLogUpload();
var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
var userCount = 0;
var backcam = 0;
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

var videoProfiles = [{
  label: "240p_1",
  detail: "320x240, 15fps, 100Kbps",
  value: {width: 320,
    height: 240,
    frameRate: 15,
    bitrateMax: 100,
    bitrateMin: 50 }
}, {
  label: "360p_7",
  detail: "480×360, 15fps, 180Kbps",
  value: {width: 480,
    height: 360,
    frameRate: 15,
    bitrateMax: 180,
    bitrateMin: 90 }
}, {
  label: "360p_8",
  detail: "480×360, 30fps, 245Kbps",
  value: {width: 480,
    height: 360,
    frameRate: 30,
    bitrateMax: 245,
    bitrateMin: 115 }
}, {
  label: "480p_1",
  detail: "640×480, 15fps, 250Kbps",
  value: {width: 640,
    height: 480,
    frameRate: 15,
    bitrateMax: 250,
    bitrateMin: 125 }
}, {
  label: "480p_2",
  detail: "640×480, 30fps, 500Kbps",
  value: {width: 640,
    height: 480,
    frameRate: 30,
    bitrateMax: 500,
    bitrateMin: 250 }
}, {
  label: "720p_1",
  detail: "1280×720, 15fps, 570Kbps",
  value: {width: 1280,
    height: 720,
    frameRate: 15,
    bitrateMax: 570,
    bitrateMin: 265 }
}, {
  label: "720p_2",
  detail: "1280×720, 30fps, 1000Kbps",
  value: {width: 1280,
    height: 720,
    frameRate: 30,
    bitrateMax: 1000,
    bitrateMin: 500 }
}, {
  label: "1080p_1",
  detail: "1920×1080, 15fps, 1040Kbps",
  value: {width: 1920,
    height: 1080,
    frameRate: 15,
    bitrateMax: 1040,
    bitrateMin: 500 }
}, {
  label: "1080p_2",
  detail: "1920×1080, 30fps, 1500Kbps",
  value: {width: 1920,
    height: 1080,
    frameRate: 30,
    bitrateMax: 1500,
    bitrateMin: 750 }
}, {
  label: "Custom",
  detail: "VenueLive",
  value: {width: 1920,
    height: 1080,
    frameRate: 30,
    bitrateMax: 1000,
    bitrateMin: 750 }
}];
var curVideoProfile;

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
AgoraRTC.onCameraChanged = async changedDevice => {
  // When plugging in a device, switch to a device that is newly plugged in.
  if (changedDevice.state === "ACTIVE") {
    localTracks.videoTrack.setDevice(changedDevice.device.deviceId);
    // Switch to an existing device when the current device is unplugged.
  } else if (changedDevice.device.label === localTracks.videoTrack.getTrackLabel()) {
    const oldCameras = await AgoraRTC.getCameras();
    oldCameras[0] && localTracks.videoTrack.setDevice(oldCameras[0].deviceId);
  }
};
async function initDevices() {
  if (!localTracks.audioTrack) {
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: "standard_stereo"
    });
  }
  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: curVideoProfile.value, facingMode: "user"
    });
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

  // get cameras
  cams = await AgoraRTC.getCameras();
  const videoTrackLabel = localTracks.videoTrack.getTrackLabel();
  currentCam = cams.find(item => item.label === videoTrackLabel);
  $(".cam-input").val(currentCam.label);
  $(".cam-list").empty();
  cams.forEach(cam => {
    $(".cam-list").append(`<a class="dropdown-item" href="#">${cam.label}</a>`);
  });
}
async function switchCamera(label) {
  currentCam = cams.find(cam => cam.label === label);
  $(".cam-input").val(currentCam.label);
  // switch device of local video track.
  await localTracks.videoTrack.setDevice(currentCam.deviceId);
}

async function switchCamMobile() {
  if (backcam) {
    if (!localTracks.videoTrack) {
      localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: curVideoProfile.value, facingMode: "user"
      });
    backcam = 0;
    localTracks.videoTrack.play("local-player");
    await client.publish(localTracks.videoTrack);
  } else {
    stream = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: curVideoProfile.value, facingMode: "user"
    });
    localTracks.videoTrack.replaceTrack(stream.getMediaStreamTrack(), true);
    backcam = 0;
  }
  } else {
    if (!localTracks.videoTrack) {
      localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: curVideoProfile.value, facingMode: "environment"
      });
    backcam = 1;
    localTracks.videoTrack.play("local-player");
    await client.publish(localTracks.videoTrack);
  } else {
    stream = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: curVideoProfile.value, facingMode: "environment"
    });
    localTracks.videoTrack.replaceTrack(stream.getMediaStreamTrack(), true);
    backcam = 1;
  }
  }
}

async function toggleWebAudio() {
  if (webAudioOff) {
    console.log("Turning WebAudio back on.");
    webAudioOff = false;
    AgoraRTC.setParameter("DISABLE_WEBAUDIO", false);
    $("#webAudio").text("Disable WebAudio");
  } else {
    console.log("Turning WebAudio off.");
    webAudioOff = true;
    AgoraRTC.setParameter("DISABLE_WEBAUDIO", true);
    $("#webAudio").text("Enable WebAudio");
  }
}

async function switchMicrophone(label) {
  currentMic = mics.find(mic => mic.label === label);
  $(".mic-input").val(currentMic.label);
  // switch device of local audio track.
  await localTracks.audioTrack.setDevice(currentMic.deviceId);
}
function initVideoProfiles() {
  videoProfiles.forEach(profile => {
    $(".profile-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  curVideoProfile = videoProfiles.find(item => item.label == '240p_1');
  $(".profile-input").val(`${curVideoProfile.detail}`);
}
async function changeVideoProfile(label) {
  curVideoProfile = videoProfiles.find(profile => profile.label === label);
  $(".profile-input").val(`${curVideoProfile.detail}`);
  // change the local video track`s encoder configuration
  localTracks.videoTrack && (await localTracks.videoTrack.setEncoderConfiguration(curVideoProfile.value));
}

let statsInterval;

// the demo can auto join channel with params in url
$(() => {
  initVideoProfiles();
  $(".profile-list").delegate("a", "click", function (e) {
    changeVideoProfile(this.getAttribute("label"));
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
        mode: "rtc",
        codec: getCodec()
      });
    }
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
  }
});
$("#leave").click(function (e) {
  leave();
});
$("#switchCamMobile").click(function (e) {
  switchCamMobile();
});
$("#webAudio").click(function (e) {
  toggleWebAudio();
});
$('#agora-collapse').on('show.bs.collapse	', function () {
  initDevices();
});
$(".cam-list").delegate("a", "click", function (e) {
  switchCamera(this.text);
});
$(".mic-list").delegate("a", "click", function (e) {
  switchMicrophone(this.text);
});

async function join() {
  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  client.on("exception", handleLowInput);

  // join the channel
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  if (!localTracks.audioTrack) {
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: "music_standard"
    });
  }
  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: curVideoProfile.value, facingMode: "user"
    });
  }
  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#joined-setup").css("display", "flex");

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
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
  $("#joined-setup").css("display", "none");
  console.log("client leaves channel success");
}
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
    audio: client.getLocalAudioStats()
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
    description: "Send audio bit rate",
    value: localStats.audio.sendBitrate,
    unit: "bps"
    }, {
    description: "Total audio packets loss",
    value: localStats.audio.sendPacketsLost,
    unit: ""
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
      audio: client.getRemoteAudioStats()[uid]
    };
    const remoteTracksStatsList = [{
      description: "Receiving FPS",
      value: remoteTracksStats.video.receiveFrameRate,
      unit: ""
    }, {
      description: "Decoding FPS",
      value: remoteTracksStats.video.decodeFrameRate,
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

function getCodec() {
  var radios = document.getElementsByName("radios");
  var value;
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].checked) {
      value = radios[i].value;
    }
  }
  return value;
}