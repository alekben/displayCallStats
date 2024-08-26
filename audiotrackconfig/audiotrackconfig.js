
//popup stuff
var popups = 0;

//audio stuff
var audioTrackConfig = {agc: true, aec: true, ans: true, webaudio: true, googFilter: true};

//misc
var proxy = false;
var fallback = false;
var proxyServer = ""
var bigRemote = 0;
var remoteFocus = 0;
var dumbTempFix = "Selected";

// create Agora client
var client = AgoraRTC.createClient({
  mode: "live",
  codec: "vp8"
});

AgoraRTC.setParameter('NEW_ICE_RESTART', true);
AgoraRTC.setParameter('TCP_CANDIDATE_ONLY', true);
AgoraRTC.enableLogUpload();

var localTracks = {
  videoTrack: null,
  audioTrack: null
};

var localTrackState = {
  audioTrackMuted: false,
  audioTrackEnabled: false,
  published:  false
};

var joined = false;

var remoteUsers = {};
var remotesArray = [];
var userCount = 0;

// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null,
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

//encoderConfig: curMicProfile.value, 
async function initDevices() {
  if (localTrackState.published) {
    if (!localTracks.audioTrack) {
      localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: curMicProfile.value, "AEC": audioTrackConfig.aec, "ANS": audioTrackConfig.ans, "AGC": audioTrackConfig.agc, "microphoneId":"default", bypassWebAudio:false});
    } else {
      console.log("mic track already exists, replacing.");
      await client.unpublish(localTracks.audioTrack);
      await localTracks.audioTrack.stop();
      await localTracks.audioTrack.close();
      localTracks.audioTrack = undefined;
      localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: curMicProfile.value, "AEC": audioTrackConfig.aec, "ANS": audioTrackConfig.ans, "AGC": audioTrackConfig.agc, "microphoneId":"default", bypassWebAudio:false});
      publishMic();
      showPopup("Replacing, unmuting, and publishing new mic track")
      $("#setMuted").attr("disabled", false);
      $("#setEnabled").attr("disabled", false);
      $("#setMuted").text("Mute Mic Track");
      $("#setEnabled").text("Disable Mic Track");
      localTrackState.audioTrackEnabled = true;
      localTrackState.audioTrackMuted = false;
      }
    } else {
      localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        "AEC": audioTrackConfig.aec, "ANS": audioTrackConfig.ans, "AGC": audioTrackConfig.agc,"microphoneId":"default", bypassWebAudio:false});
      localTrackState.audioTrackEnabled = true;
      localTrackState.audioTrackMuted = false;
      showPopup("Mic Track Created");
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
  curMicProfile = audioProfiles.find(item => item.label == 'music_standard');
  $(".profile-input").val(`${curMicProfile.detail}`);
}

async function changeMicProfile(label) {
  curMicProfile = audioProfiles.find(profile => profile.label === label);
  $(".profile-input").val(`${curMicProfile.detail}`);
  // change the local audio track`s encoder configuration
  initDevices();
}

async function changeTargetUID(label) {
  $(".uid-input").val(`${label}`);
  if (remoteFocus != 0) {
    var x = document.getElementById(`player-${remoteFocus}`);
    x.className = "remotePlayer";
  }
  var x = document.getElementById(`player-${label}`);
  if (x) {
    x.className = "remotePlayerSelected";
    remoteFocus = Number(label);
  }
}


function updateUIDs(id, action) {
  if (remotesArray.length == 0 && action == "remove") {
    $(".uid-list").empty();
    $(".uid-input").val(``);
  } else {
  let i = 0;
  while (i < remotesArray.length) {
    if (remotesArray[i] == id) {
      console.log("UID already in list");
      return;
    }
    i++;
  }

  $(".uid-list").empty();
  remotesArray.push(id);

  //repopulate
  let j = 0;
  while (j < remotesArray.length) {
    $(".uid-list").append(`<a class="dropdown-item" label="${remotesArray[j]}" href="#">${remotesArray[j]}</a>`);
    j++;
  } 
  $(".uid-input").val(`${remotesArray[0]}`);
}
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
        mode: "live",
        codec: "vp8"
      });
    }
    client.setClientRole("host");
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
    $("#createTrack").attr("disabled", false);
    $("#publishTrack").attr("disabled", true);
    $("#setMuted").attr("disabled", true);
    $("#setEnabled").attr("disabled", true);
    $("#subscribe").attr("disabled", false);
    $("#unsubscribe").attr("disabled", false);
    $("#biggerView").attr("disabled", false);
    $("#agc").attr("disabled", false);
    $("#aec").attr("disabled", false);
    $("#ans").attr("disabled", false);
    $("#googFilter").attr("disabled", false);
    joined = true;
  }
});
$("#leave").click(function (e) {
  leave();
});

$(".uid-list").delegate("a", "click", function (e) {
  changeTargetUID(this.getAttribute("label"));
});


$("#createTrack").click(function (e) {
  initDevices();
  $("#createTrack").attr("disabled", true);
  $("#publishTrack").attr("disabled", false);
  if (audioTrackConfig.webaudio = true) {
    $("#enableAiDenoiser").attr("disabled", false);
  }
});

$("#publishTrack").click(function (e) {
  publishMic();
  $("#publishTrack").attr("disabled", true);
  //$("#startLoopback").attr("disabled", false);
  $("#setMuted").attr("disabled", false);
  $("#setEnabled").attr("disabled", false);
});

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

$("#subscribe").click(function (e) {
  manualSub();
});
$("#unsubscribe").click(function (e) {
  manualUnsub();
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

$("#biggerView").click(function (e) {
  handleExpand();
});

$("#aec").click(function (e) {
  handleAEC();
});

$("#ans").click(function (e) {
  handleANS();
});

$("#agc").click(function (e) {
  handleAGC();
});

$("#googFilter").click(function (e) {
  handleGoogFilter();
});




async function toggleWebAudio() {
  if (audioTrackConfig.webaudio) {
    console.log("Turning WebAudio back ON.");
    audioTrackConfig.webaudio = true;
    AgoraRTC.setParameter("DISABLE_WEBAUDIO", false);
    $("#webAudio").text("Disable WebAudio");
    showPopup("WebAudio Enabled");
    initDevices();
  } else {
    console.log("Turning WebAudio OFF.");
    audioTrackConfig.webaudio = false;
    AgoraRTC.setParameter("DISABLE_WEBAUDIO", true);
    $("#webAudio").text("Enable WebAudio");
    $("#enableAiDenoiser").attr("disabled", true);
    showPopup("WebAudio Disabled");
    initDevices();
  }
}

async function publishMic() {
  if (!localTracks.audioTrack) {
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      "AEC": audioTrackConfig.aec, "ANS": audioTrackConfig.ans, "AGC": audioTrackConfig.agc, 
      "microphoneId":"default", bypassWebAudio:false});
  }
    await client.publish(localTracks.audioTrack);
    console.log("Published mic track");
    showPopup("Mic Track Published");
    localTrackState.audioTrackMuted = false;
    localTrackState.audioTrackEnabled = true;
    localTrackState.published = true;
}

async function muteAudio() {
  if (!localTracks.audioTrack) return;

  await localTracks.audioTrack.setMuted(true);
  localTrackState.audioTrackMuted = true;
  localTrackState.published = false;
  $("#setMuted").text("Unmute Mic Track");
  showPopup("Mic Track Muted");
}

async function unmuteAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setMuted(false);
  localTrackState.audioTrackMuted = false;
  localTrackState.published = true;
  $("#setMuted").text("Mute Mic Track");
  showPopup("Mic Track Unmuted");
}

async function disableAudio() {
  if (!localTracks.audioTrack) return;

  await localTracks.audioTrack.setEnabled(false);
  localTrackState.audioTrackEnabled = false;
  localTrackState.published = false;
  showPopup("Mic Track Disabled");
  $("#setEnabled").text("Enable Mic Track");
}

async function enableAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(true);
  localTrackState.audioTrackEnabled = true;
  localTrackState.published = true;
  showPopup("Mic Track Enabled");
  $("#setEnabled").text("Disable Mic Track");
}

async function join() {
  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  client.on("user-joined", handleUserJoined);
  client.on("user-left", handleUserLeft);
  client.on("user-info-updated", handleUserInfoUpdated);
  client.on("is-using-cloud-proxy", handleCloudProxy);
  client.on("join-fallback-to-proxy", handleFallback);

  // join the channel
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  
  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({encoderConfig: "720p_3"});
  }
  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#joined-setup").css("display", "flex");

  // publish local tracks to channel
  await client.setClientRole("host");
  await client.publish(localTracks.videoTrack);
  console.log("publish cam success");
  showPopup("Cam Track Published");
  showPopup(`Joined to channel ${options.channel} with UID ${options.uid}`);
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
  $("#remote-playerlist-row1").html("");
  $("#remote-playerlist-row2").html("");
  $("#remote-playerlist-row3").html("");
  $("#remote-playerlist-row4").html("");

  // Remove remote users and player views.
  remoteUsers = {};
  $("#remote-playerlist").html("");
  
  remotesArray = [];
  $(".uid-list").empty();
  $(".uid-input").val(``);

  // leave the channel
  await client.leave();
  showPopup(`Left channel ${options.channel}`);
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#createTrack").attr("disabled", true);
  $("#publishTrack").attr("disabled", true);
  $("#setMuted").attr("disabled", true);
  $("#setEnabled").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  $("#subscribe").attr("disabled", true);
  $("#unsubscribe").attr("disabled", true);
  $("#biggerView").attr("disabled", true);
  $("#agc").attr("disabled", true);
  $("#aec").attr("disabled", true);
  $("#ans").attr("disabled", true);
  $("#googFilter").attr("disabled", true);
  $("#enableAiDenoiser").attr("disabled", true);
  remoteFocus = 0;
  bigRemote = 0;
  proxy = false;
  fallback = false;

  localTrackState = {
    audioTrackMuted: false,
    audioTrackEnabled: false,
    published:  false
  };

  console.log("client leaves channel success");

}

async function manualSub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  showPopup(`Manually subscribed to UID ${id}`);
  await subscribe(user, "video");
  await subscribe(user, "audio");
}

async function manualUnsub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  await client.unsubscribe(user, "");
  $(`#player-wrapper-${id}`).remove();
  showPopup(`Manually unsubscribed from UID ${id}`);
}


async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    if (remoteFocus != 0) {
      dumbTempFix = "";
    } else {
      dumbTempFix = "Selected";
      remoteFocus = uid;
    }
    const player = $(`
      <div id="player-wrapper-${uid}">
        <div class="player-with-stats">
          <div id="player-${uid}" class="remotePlayer${dumbTempFix}"></div>
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
  showPopup(`Subscribing to ${mediaType} of UID ${uid}`);
}

function handleUserPublished(user, mediaType) {
  if (userCount >= 8 ) {
    console.log("8 remotes already publishing, not supporting more right now.");
    $("#room-full-alert").css("display", "block");
  } else {
    const id = user.uid;
    remoteUsers[id] = user;
    updateUIDs(id, "add");
    if (mediaType === 'video') {
      userCount = getRemoteCount(remoteUsers);
      console.log(`Remote User Video Count now: ${userCount}`);
    }
    subscribe(user, mediaType);
    showPopup(`UID ${id} published ${mediaType}`);
    showPopup(`Remote User Count now: ${userCount}`);
  }
}

function handleUserUnpublished(user, mediaType) {
  const id = user.uid;
  if (mediaType === 'video') {
    removeItemOnce(remotesArray, id);
    updateUIDs(id, "remove");
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
  }
  userCount = getRemoteCount(remoteUsers);
  console.log(`Remote User Count now: ${userCount}`);
  showPopup(`UID ${id} unpublished ${mediaType}`);
  showPopup(`Remote User Count now: ${userCount}`);
}

function handleUserJoined(user) {
  const id = user.uid;
  updateUIDs(id, "add");
  showPopup(`UID ${id} user-joined`);
}

function handleUserLeft(user) {
  const id = user.uid;
  removeItemOnce(remotesArray, id);
  updateUIDs(id, "remove");
  showPopup(`UID ${id} user-left`);
}

function handleUserInfoUpdated(uid, message) {
  console.log(`User Info Updated for ${uid}, new state is: ${message}`);
  showPopup(`UID ${uid} new state: ${message}`);
}

function handleCloudProxy(turn) {
  if (turn) {
    if (!proxy) {
      console.log(`TURN or Cloud Proxy Used!!!`);
      showPopup(`TURN or Cloud Proxy Used!!!`);
      proxy = turn;
    }
  }  
}

function handleFallback(server) {
  if (!fallback) {
    console.log(`Fallback Proxy Triggered!!!`);
    showPopup(`Fallback Proxy Triggered!!!`);
    fallback = true;
    proxyServer = server;
  }
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
  }, {
    description: "TURN",
    value: proxy,
    unit: ""
  }, {
    description: "Fallback Proxy",
    value: fallback,
    unit: ""
  }, {
    description: "Proxy Server",
    value: proxyServer,
    unit: ""
  }];
  $("#client-stats").html(`
    ${clientStatsList.map(stat => `<class="stats-row">${stat.description}: ${stat.value} ${stat.unit}<br>`).join("")}
  `);

// get the local track stats message

  var localStats = {};
  var localStatsList = [];

  if (localTracks.audioTrack) {
  localStats = {
    audioconfig: localTracks.audioTrack._config.encoderConfig,
    trackSettings: localTracks.audioTrack.getMediaStreamTrackSettings(),
    audio: client.getLocalAudioStats()
  };
  localStatsList = [{
    description: "Codec",
    value: localStats.audio.codecType,
    unit: ""
    }, {
    description: "Send Bitrate",
    value: localStats.audio.sendBitrate,
    unit: ""
    }, {
    description: "sendPacketsLost",
    value: localStats.audio.sendPacketsLost,
    unit: ""
    }, {
    description: "Send Volume Level",
    value: localStats.audio.sendVolumeLevel,
    unit: ""
    }, {
    description: "Audio Config",
    value: localStats.audioconfig,
    unit: ""
    },  {
    description: "Sample Rate",
    value: localStats.trackSettings.sampleRate,
    unit: ""
    }, {
    description: "AGC",
    value: localStats.trackSettings.autoGainControl,
    unit: ""
    }, {
    description: "AEC",
    value: localStats.trackSettings.echoCancellation,
    unit: ""
    }, {
    description: "ANS",
    value: localStats.trackSettings.noiseSuppression,
    unit: ""
    }];
    $("#local-stats").html(`
  ${localStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
`);
  } else {
    $("#local-stats").html(`
    Publish Mic Track For Stats`);
  }

Object.keys(remoteUsers).forEach(uid => {
  // get the remote track stats message
  const remoteTracksStats = {
    audio: client.getRemoteAudioStats()[uid]
  };
  const remoteTracksStatsList = [{
    description: "UID",
    value: uid,
    unit: ""
  }, {
    description: "Codec",
    value: remoteTracksStats.audio.codecType,
    unit: ""
  }, {
    description: "Receiving Bitrate",
    value: remoteTracksStats.audio.receiveBitrate,
    unit: ""
  }, {
    description: "Receiving Delay",
    value: remoteTracksStats.audio.receiveDelay,
    unit: ""
  }, {
    description: "transportDelay",
    value: remoteTracksStats.audio.transportDelay,
    unit: ""
  }, {
    description: "Total Freeze Time",
    value: remoteTracksStats.audio.totalFreezeTime,
    unit: ""
  }];
  $(`#player-wrapper-${uid} .track-stats`).html(`
    ${remoteTracksStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
  `);
});
}

function handleExpand() {
  const id = $(".uid-input").val();
  if (bigRemote == id) {
    shrinkRemote(id);
    bigRemote = 0;
  } else if (bigRemote == 0) {
    expandRemote(id);
    bigRemote = id;
  } else {
    shrinkRemote(id);
    expandRemote(id);
    bigRemote = id;
  }
}


function expandRemote(uid) {
  var x = document.getElementById(`player-${uid}`);
  if (uid == remoteFocus) {
    x.className = "remotePlayerLargeSelected";
    bigRemote = uid;
  } else {
    x.className = "remotePlayerLarge";
    bigRemote = uid;
  }

}

function shrinkRemote(uid) {
  var x = document.getElementById(`player-${uid}`);
  if (uid == remoteFocus) {
    x.className = "remotePlayerSelected";
    bigRemote = 0;
  } else {
    x.className = "remotePlayer";
    bigRemote = 0;
  }
}


function handleAEC() {
 if (audioTrackConfig.aec) {
  audioTrackConfig.aec = false;
  showPopup("AEC false");
  $("#aec").text("AEC Off");
  initDevices();
 } else {
  audioTrackConfig.aec = true;
  showPopup("AEC true");
  $("#aec").text("AEC On");
  initDevices();
 }
}

function handleAGC() {
  if (audioTrackConfig.agc) {
    audioTrackConfig.agc = false;
    showPopup("AGC false");
    $("#agc").text("AGC Off");
    initDevices();
   } else {
    audioTrackConfig.agc = true;
    showPopup("AGC true");
    $("#agc").text("AGC On");
    initDevices();
   }
}

function handleANS() {
  if (audioTrackConfig.ans) {
    audioTrackConfig.ans = false;
    showPopup("ANS false");
    $("#ans").text("ANS Off");
    initDevices();
   } else {
    audioTrackConfig.ans = true;
    showPopup("ANS true");
    $("#ans").text("ANS On");
    initDevices();
   }
}

function handleGoogFilter() {
  if (audioTrackConfig.googFilter) {
    audioTrackConfig.googFilter = false;
    showPopup("googHighPass false");
    $("#googFilter").text("googHighPass Off");
    initDevices();
   } else {
    audioTrackConfig.googFilter = true;
    showPopup("googHighPass true");
    $("#googFilter").text("googHighPass On");
    initDevices();
   }}


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
  setTimeout(function(){ $(`#popup-${newPopup}`).remove(); popups--;}, 10000);
}

function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

async function createMicTrack() {
  localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({bypassWebAudio:false});
}

//AINS
let denoiser = null;
let processor = null;
let processorEnable = true;
const pipeAIDenosier = (audioTrack, processor) => {
  audioTrack.pipe(processor).pipe(audioTrack.processorDestination);
};
$("#enableAiDenoiser").click(async e => {
  e.preventDefault();
  //await createMicTrack();
  $("#agc").attr("disabled", true);
  $("#aec").attr("disabled", true);
  $("#ans").attr("disabled", true);
  $("#googFilter").attr("disabled", true);
  $("#webAudio").attr("disabled", true);
  denoiser = denoiser || (() => {
    let denoiser = new AIDenoiser.AIDenoiserExtension({
      assetsPath: './aiDenoiserExtension/external'
    });
    AgoraRTC.registerExtensions([denoiser]);
    denoiser.onloaderror = e => {
      console.error(e);
      processor = null;
    };
    return denoiser;
  })();
  processor = processor || (() => {
    let processor = denoiser.createProcessor();
    processor.onoverload = async () => {
      console.log("overload!!!");
      try {
        await processor.disable();
        $("#enableAiDenoiser").text("Disable AIDenoiser");
        processorEnable = true;
      } catch (error) {
        console.error("disable AIDenoiser failure");
      } finally {
        $("#enableAiDenoiser").attr("disabled", false);
      }
    };
    return processor;
  })();
  pipeAIDenosier(localTracks.audioTrack, processor);

  if (processorEnable) {
    try {
      await processor.enable();
      $("#enableAiDenoiser").text("Disable AIDenoiser");
      showPopup("AINS enabled");
      processorEnable = false;
      await processor.setMode("STATIONARY_NS");
      await processor.setLevel("AGGRESSIVE");
    } catch (e) {
      console.error("enable AIDenoiser failure");
    } finally {
      $("#enableAiDenoiser").attr("disabled", false);
    }
  } else {
    try {
      await processor.disable();
      $("#enableAiDenoiser").text("Enable AIDenoiser");
      processorEnable = true;
      showPopup("AINS disabled");
    } catch (e) {
      console.error("disable AIDenoiser failure");
    } finally {
      $("#enableAiDenoiser").attr("disabled", false);
    }
  }
});