//chart stuff
google.charts.load('current', {packages: ['corechart', 'line']});
var chart;
var chartArray = [];

//SVC stuff
var layers = {};

//popup stuff
var popups = 0;

//misc
var bigRemote = 0;
var remoteFocus = 0;
var dumbTempFix = "Selected";


// create Agora client
var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp9"
});


//AgoraRTC.setParameter("DISABLE_WEBAUDIO", true);
AgoraRTC.setParameter("SVC",["vp9"]);
//AgoraRTC.setParameter("ENABLE_SVC", true);
//console.log("Start with Web Audio OFF");
var webAudioOff = false;

AgoraRTC.enableLogUpload();
var localTracks = {
  videoTrack: null,
  audioTrack: null
};

var localTrackState = {
  audioTrackMuted: false,
  audioTrackEnabled: false
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
  host: 1

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
  options.host = urlParams.get("host");
  if (options.host == null) {
    options.host = 1;  
  }
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
        codec: "vp9"
      });
    }
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    //AgoraRTC.setParameter("SVC",["vp9"]);
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
    $("#pickSLayer").attr("disabled", false);
    $("#pickTLayer").attr("disabled", false);
    $("#biggerView").attr("disabled", false);
    joined = true;
  }
});
$("#leave").click(function (e) {
  leave();
});

$(".uid-list").delegate("a", "click", function (e) {
  changeTargetUID(this.getAttribute("label"));
  updateLayersButtons();
});


$("#createTrack").click(function (e) {
  initDevices();
  $("#createTrack").attr("disabled", true);
  $("#publishTrack").attr("disabled", false);
});

$("#publishTrack").click(function (e) {
  publishMic();
  $("#publishTrack").attr("disabled", true);
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

$("#pickSLayer").click(function (e) {
    pickS();
});

$("#pickTLayer").click(function (e) {
    pickT();
});

$("#biggerView").click(function (e) {
  handleExpand();
});


function setSTMin(uid) {
    layers[uid].spatialLayer = 1;
    layers[uid].temporalLayer = 1;
    showPopup(`Setting S${layers[uid].spatialLayer} T${layers[uid].temporalLayer} for UID ${uid}`);
    console.log(`Setting S${layers[uid].spatialLayer} T${layers[uid].temporalLayer} for UID ${uid}`);
    const id = Number(uid);
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
}

function setSTMax(uid) {
    layers[uid].spatialLayer = 3;
    layers[uid].temporalLayer = 3;
    showPopup(`Setting S${layers[uid].spatialLayer} T${layers[uid].temporalLayer} for UID ${uid}`);
    console.log(`Setting S${layers[uid].spatialLayer} T${layers[uid].temporalLayer} for UID ${uid}`);
    const id = Number(uid);
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
}

async function pickS() {
  //get value of of uid-input
  const id = Number($(".uid-input").val());
  if (layers[id].spatialLayer == 3) {
    $("#pickSLayer").text("S2");
    layers[id].spatialLayer = 2;
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
    showPopup(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
    console.log(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
  }
  else if (layers[id].spatialLayer == 2) {
    $("#pickSLayer").text("S1");
    layers[id].spatialLayer = 1;
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
    showPopup(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
    console.log(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
  }
  else if (layers[id].spatialLayer == 1) {
    $("#pickSLayer").text("S0");
    layers[id].spatialLayer = 0;
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
    showPopup(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
    console.log(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
  }
  else if (layers[id].spatialLayer == 0) {
    $("#pickSLayer").text("S3");
    layers[id].spatialLayer = 3;
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
    showPopup(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
    console.log(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
  }
}

async function pickT() {
  //get value of of uid-input
  const id = Number($(".uid-input").val());
  if (layers[id].temporalLayer == 3) {
    $("#pickTLayer").text("T2");
    layers[id].temporalLayer = 2;
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
    showPopup(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
    console.log(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
  }
  else if (layers[id].temporalLayer == 2) {
    $("#pickTLayer").text("T1");
    layers[id].temporalLayer = 1;
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
    showPopup(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
    console.log(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
  }
  else if (layers[id].temporalLayer == 1) {
    $("#pickTLayer").text("T0");
    layers[id].temporalLayer = 0;
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
    showPopup(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
    console.log(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
  }
  else if (layers[id].temporalLayer == 0) {
    $("#pickTLayer").text("T3");
    layers[id].temporalLayer = 3;
    client.pickSVCLayer(id, {spatialLayer: layers[id].spatialLayer, temporalLayer: layers[id].temporalLayer});
    showPopup(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
    console.log(`Setting S${layers[id].spatialLayer} T${layers[id].temporalLayer} for UID ${id}`);
  }
}

async function toggleWebAudio() {
  if (webAudioOff) {
    console.log("Turning WebAudio back ON.");
    webAudioOff = false;
    AgoraRTC.setParameter("DISABLE_WEBAUDIO", false);
    $("#webAudio").text("Disable WebAudio");
    showPopup("WebAudio Enabled");
  } else {
    console.log("Turning WebAudio OFF.");
    webAudioOff = true;
    AgoraRTC.setParameter("DISABLE_WEBAUDIO", true);
    $("#webAudio").text("Enable WebAudio");
    showPopup("WebAudio Disabled");
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
    showPopup("Mic Track Published");
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
  showPopup("Mic Track Muted");
}

async function unmuteAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setMuted(false);
  localTrackState.audioTrackMuted = false;
  $("#setMuted").text("Mute Mic Track");
  showPopup("Mic Track Unmuted");
}

async function disableAudio() {
  if (!localTracks.audioTrack) return;
  /**
   * After calling setMuted to mute an audio or video track, the SDK stops sending the audio or video stream. Users whose tracks are muted are not counted as users sending streams.
   * Calling setEnabled to disable a track, the SDK stops audio or video capture
   */
  await localTracks.audioTrack.setEnabled(false);
  localTrackState.audioTrackEnabled = false;
  showPopup("Mic Track Disabled");
  $("#setEnabled").text("Enable Mic Track");
}

async function enableAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(true);
  localTrackState.audioTrackEnabled = true;
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

  // join the channel
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);

  if (options.host == 1) {
    if (!localTracks.videoTrack) {
      localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({encoderConfig: "720p_3", scalabiltyMode: "3SL3TL"});
    }
    // play local video track
    localTracks.videoTrack.play("local-player");
    $("#joined-setup").css("display", "flex");
  
    // publish local tracks to channel
    await client.publish(localTracks.videoTrack);
    console.log("publish cam success");
    showPopup("Cam Track Published");
  };
  showPopup(`Joined to channel ${options.channel} with UID ${options.uid}`);
  chart = new google.visualization.LineChart(document.getElementById('chart-div'));
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
  layers = {};
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
  $("#pickSLayer").attr("disabled", true);
  $("#pickTLayer").attr("disabled", true);
  $("#pickSLayer").text("S3");
  $("#pickTLayer").text("T3");
  $("#biggerView").attr("disabled", true);
  remoteFocus = 0;
  bigRemote = 0;

  //clear chart
  chart.clearChart();
  chartArray.length = 0;
  console.log("client leaves channel success");

}

async function manualSub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  showPopup(`Manually subscribed to UID ${id}`);
  await subscribe(user, "video");
  await setSTMin(id);
  updateLayersButtons();
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
  if (mediaType == "video") {
    user.videoTrack.on("first-frame-decoded", (track) => {
      console.log(`remote track for ${uid} has decoded`);
    });
  }
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
    setTimeout(handleMin, 500, uid);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
  showPopup(`Subscribing to ${mediaType} of UID ${uid}`);
}

function handleMin(uid) {
  console.log(`Min Interval fired`);
  setSTMin(uid);
  }

  function handleMax(uid) {
  console.log(`Max Interval fired`);
  setSTMax(Number(uid));
  }



function handleUserPublished(user, mediaType) {
  if (userCount >= 8 ) {
    console.log("8 remotes already publishing, not supporting more right now.");
    $("#room-full-alert").css("display", "block");
  } else {
    const id = user.uid;
    remoteUsers[id] = user;
    layers[id] = {uid: id, spatialLayer: 1, temporalLayer: 1};
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
    updateLayersButtons();
    delete remoteUsers[id];
    delete layers[id];
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
  updateLayersButtons();
  showPopup(`UID ${id} user-left`);
}

function handleUserInfoUpdated(uid, message) {
  console.log(`User Info Updated for ${uid}, new state is: ${message}`);
  showPopup(`UID ${uid} new state: ${message}`);
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
  const clientStatsList = [
  {
    description: "Local UID",
    value: options.uid,
    unit: ""
  },
  {
    description: "Host Count",
    value: clientStats.UserCount,
    unit: ""
  }, {
    description: "Joined Duration",
    value: clientStats.Duration,
    unit: "s"
  }, {
    description: "Bitrate receive",
    value: (Number(clientStats.RecvBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
  }, {
    description: "Bitrate sent",
    value: (Number(clientStats.SendBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
  }, {
    description: "Outgoing B/W",
    value: (Number(clientStats.OutgoingAvailableBandwidth) * 0.001).toFixed(4),
    unit: "Mbps"
  }, {
    description: "RTT to SD-RTN Edge",
    value: clientStats.RTT,
    unit: "ms"
  }];
  $("#client-stats").html(`
    ${clientStatsList.map(stat => `<class="stats-row">${stat.description}: ${stat.value} ${stat.unit}<br>`).join("")}
  `);
  chartArray.push([clientStats.Duration, clientStats.SendBitrate, clientStats.RecvBitrate]);
  drawCurveTypes(chartArray);

// get the local track stats message
const localStats = {
  video: client.getLocalVideoStats(),
  //audio: client.getLocalAudioStats()
};
const localStatsList = [{
  description: "Codec",
  value: localStats.video.codecType,
  unit: ""
  }, {
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
  value: (Number(localStats.video.sendBitrate) * 0.000001).toFixed(4),
  unit: "Mbps"
  }, {
  description: "Total video packets loss",
  value: localStats.video.sendPacketsLost,
  unit: ""
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
  const remoteTracksStatsList = [
    {
      description: "UID",
      value: uid,
      unit: ""
    },
    {
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
    description: "Recv video bitrate",
    value: (Number(remoteTracksStats.video.receiveBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
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
    console.log("shrinking");
    setTimeout(handleMin, 500, id);
  } else if (bigRemote == 0) {
    expandRemote(id);
    bigRemote = id;
    console.log("expanding");
    setTimeout(handleMax, 500, id);
  } else {
    shrinkRemote(id);
    expandRemote(id);
    setTimeout(handleMax, 500, id);
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

function updateLayersButtons() {
  const id = $(".uid-input").val();
  const sVal = layers[id].spatialLayer;
  const tVal = layers[id].temporalLayer;
  $("#pickSLayer").text(`S${sVal}`);
  $("#pickTLayer").text(`T${tVal}`);
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
  setTimeout(function(){ $(`#popup-${newPopup}`).remove(); popups--;}, 10000);
}

function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

async function drawCurveTypes(array) {
  var data = new google.visualization.DataTable();
  data.addColumn('number', 'X');
  data.addColumn('number', 'Up');
  data.addColumn('number', 'Down');

  data.addRows(array);

  var options = {
    hAxis: {
      title: 'Time (sec)'
    },
    vAxis: {
      title: 'Kbits/s'
    },
    //series: {
    //  1: {curveType: 'function'}
    //}
  };

  chart.draw(data, options);
};