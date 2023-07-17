
var popups = 0;

var client;
AgoraRTC.enableLogUpload();

var connectionState = {
  isJoined: null,
  mediaReceived: null,
  isProxy: null,
  isTURN: null
}

var localTracks = {
  videoTrack: null,
  audioTrack: null
};

var localTrackState = {
  audioTrackMuted: false,
  audioTrackEnabled: false,
  audioTrackPublished: false,
  audioTrackCreated: false
};


var specialJoinUDP = false;
var specialJoinTCP = false;

var remoteUsers = {};
var remotesArray = [];


var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

var modes = [{
  label: "Close",
  detail: "Disable Forced Cloud Proxy, direct and auto only.",
  value: "0"
}, {
  label: "UDP Mode",
  detail: "Force Cloud Proxy via UDP protocol",
  value: "3"
}, {
  label: "TCP Mode",
  detail: "Force Cloud Proxy via TCP/TLS port 443",
  value: "5"
}, {
  label: "Auto + Force UDP",
  detail: "Try direct, then Auto TCP Cloud Proxy, then Forced UDP 443",
  value: "6"
}, {
  label: "Auto + Force TCP",
  detail: "Try direct, then Auto TCP Cloud Proxy, then Forced TCP 443",
  value: "7"
}];

var mode;


var videoProfiles = [{
  label: "360p_7",
  detail: "480×360, 15fps, 320Kbps",
  value: "360p_7"
}, {
  label: "360p_8",
  detail: "480×360, 30fps, 490Kbps",
  value: "360p_8"
}, {
  label: "480p_1",
  detail: "640×480, 15fps, 500Kbps",
  value: "480p_1"
}, {
  label: "480p_2",
  detail: "640×480, 30fps, 1000Kbps",
  value: "480p_2"
}, {
  label: "720p_1",
  detail: "1280×720, 15fps, 1130Kbps",
  value: "720p_1"
}, {
  label: "720p_2",
  detail: "1280×720, 30fps, 2000Kbps",
  value: "720p_2"
}, {
  label: "1080p_1",
  detail: "1920×1080, 15fps, 2080Kbps",
  value: "1080p_1"
}, {
  label: "1080p_2",
  detail: "1920×1080, 30fps, 3000Kbps",
  value: "1080p_2"
}];
var curVideoProfile;
AgoraRTC.onAutoplayFailed = () => {
  alert("click to start autoplay!");
};
AgoraRTC.onMicrophoneChanged = async changedDevice => {
  // When plugging in a device, switch to a device that is newly plugged in.
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
      encoderConfig: "music_standard"
    });
    localTrackState.audioTrackCreated = true;
    localTrackState.audioTrackMuted = false;
    localTrackState.audioTrackEnabled = true;
    localTrackState.audioTrackPublished = false;
  }
  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: curVideoProfile.value
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
  curVideoProfile = videoProfiles.find(item => item.label == '480p_1');
  $(".profile-input").val(`${curVideoProfile.detail}`);
}
async function changeVideoProfile(label) {
  curVideoProfile = videoProfiles.find(profile => profile.label === label);
  $(".profile-input").val(`${curVideoProfile.detail}`);
  // change the local video track`s encoder configuration
  localTracks.videoTrack && (await localTracks.videoTrack.setEncoderConfiguration(curVideoProfile.value));
}

async function changeTargetUID(label) {
  $(".uid-input").val(`${label}`);
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


/*
 * When this page is called with parameters in the URL, this procedure
 * attempts to join a Video Call channel using those parameters.
 */
$(() => {
  initVideoProfiles();
  $(".profile-list").delegate("a", "click", function (e) {
    changeVideoProfile(this.getAttribute("label"));
  });
  initModes();
  $(".proxy-list").delegate("a", "click", function (e) {
    changeModes(this.getAttribute("label"));
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
  $("#subscribe").attr("disabled", false);
  $("#unsubscribe").attr("disabled", false);
  $("#setEnabled").attr("disabled", false);
  try {
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "live",
        codec: getCodec()
      });
    }
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    client.setClientRole("host");  
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

/*
 * Called when a user clicks Leave in order to exit a channel.
 */
$("#leave").click(function (e) {
  leave();
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
$(".uid-list").delegate("a", "click", function (e) {
  changeTargetUID(this.getAttribute("label"));
});
$("#subscribe").click(function (e) {
  manualSub();
});
$("#unsubscribe").click(function (e) {
  manualUnsub();
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

  await localTracks.audioTrack.setEnabled(false);
  localTrackState.audioTrackEnabled = false;
  $("#setEnabled").text("Enable Mic Track");
  $("#setMuted").attr("disabled", true);
  showPopup("Mic Track Disabled");
}

async function enableAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(true);
  localTrackState.audioTrackEnabled = true;
  if (!localTrackState.audioTrackPublished) {
    await client.publish(localTracks.audioTrack);
    localTrackState.audioTrackPublished = true;
  }
  $("#setEnabled").text("Disable Mic Track");
  $("#setMuted").attr("disabled", false);
  showPopup("Mic Track Enabled");
}

async function manualSub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  await subscribe(user, "video");
  await subscribe(user, "audio");
  showPopup(`Subscribing to ${id}`);
}

async function manualUnsub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  await client.unsubscribe(user, "");
  $(`#player-wrapper-${id}`).remove();
  showPopup(`Unsubscribing from ${id}`);
}
/*
 * Join a channel, then create local video and audio tracks and publish them to the channel.
 */
async function join() {
  // Add an event listener to play remote tracks when remote user publishes.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  client.on("is-using-cloud-proxy", reportProxyUsed);
  client.on("join-fallback-to-proxy", reportAutoFallback);
  client.on("stream-type-changed", reportStreamTypeChanged);
  client.on("connection-state-change", reportConnectionState);

  // Enable Cloud Proxy according to setting
  const value = Number(mode.value);
  if ([3, 5].includes(value)) {
    client.startProxyServer(value);
  }
  if (value === 6) {
    specialJoinUDP = true;
    specialJoinTCP = false;
  }
  if (value === 7) {
    specialJoinUDP = false;
    specialJoinTCP = true;
  }
  if (value === 0) {
    client.stopProxyServer();
    specialJoinUDP = false;
    specialJoinTCP = false;
  }


  // Join the channel with mode 0,3,5, nothing special required.
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);

  // Join the channel with mode 6, try direct first, then auto for additional 3 seconds, then force UDP, give up after 15 seconds
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);

  // Join the channel with mode 7, try direct first, then auto for additional 3 seconds, then force TCP, give up after 15 seconds
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);

  if (!localTracks.audioTrack) {
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: "music_standard"
    });
    localTrackState.audioTrackCreated = true;
    localTrackState.audioTrackMuted = false;
    localTrackState.audioTrackEnabled = false;
    localTrackState.audioTrackPublished = false;
  } else {
    localTrackState.audioTrackCreated = true;
    if (localTracks.audioTrack.enabled == "true") {
      localTrackState.audioTrackEnabled = true;
    } else {
      localTrackState.audioTrackEnabled = false;
    }
    if (localTracks.audioTrack.muted == "true") {
      localTrackState.audioTrackMuted = true;
    } else {
      localTrackState.audioTrackMuted = false;
    }
  }

  localTrackState.audioTrackPublished = false;
  localTracks.audioTrack.setEnabled(false);
  localTrackState.audioTrackEnabled = false;

  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: curVideoProfile.value
    });
  }

  //[localTracks.audioTrack, localTracks.videoTrack ] = await 
  //  AgoraRTC.createMicrophoneAndCameraTracks(
//{AEC: true,  AGC: false,  ANS: true, encoderConfig: 'standard_stereo' },
//{encoderConfig: {width: { max: 848, min: 640 }, height: { max: 480, min: 480 }, frameRate: 30, //bitrateMax: 1000, bitrateMin:750,}}
 //   );


  //mic track isn't publishe and starts disabled
  // publish local tracks to channel
  await client.publish(localTracks.videoTrack);
  console.log("publish success");

  // Play the local video track to the local browser and update the UI with the user ID.
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);
  $("#joined-setup").css("display", "flex");


  // Publish the local video and audio tracks to the channel.
  //await client.publish(Object.values(localTracks));
  //console.log("publish success");
}

/*
 * Stop all local and remote tracks then leave the channel.
 */
async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  localTrackState = {
    audioTrackMuted: false,
    audioTrackEnabled: false,
    audioTrackPublished: false
  };

  connectionState = {
    isJoined: false,
    isProxy: false,
    isTURN: false,
    mediaReceived: false
  }

  // Remove remote users and player views.
  remoteUsers = {};
  $("#remote-playerlist").html("");

  remotesArray = [];
  $(".uid-list").empty();
  $(".uid-input").val(``);

  // leave the channel
  await client.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  $("#subscribe").attr("disabled", true);
  $("#unsubscribe").attr("disabled", true);
  $("#setMuted").text("Mute Mic Track");
  $("#setMuted").attr("disabled", true);
  $("#setEnabled").text("Enable Mic Track");
  $("#setEnabled").attr("disabled", true);
  console.log("client leaves channel success");
}

/*
 * Add the local use to a remote channel.
 *
 * @param  {IAgoraRTCRemoteUser} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to add.
 * @param {trackMediaType - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/itrack.html#trackmediatype | media type} to add.
 */
async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === "video") {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === "audio") {
    user.audioTrack.play();
  }
}


function handleUserPublished(user, mediaType) {
  const id = user.uid;
  updateUIDs(id, "add");
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

/*
 * Remove the user specified from the channel in the local interface.
 *
 * @param  {string} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to remove.
 */
function handleUserUnpublished(user, mediaType) {
  if (mediaType === "video") {
    const id = user.uid;
    removeItemOnce(remotesArray, id);
    updateUIDs(id, "remove");
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
    showPopup(`UID ${id} unpublished video`);
  }
  showPopup(`UID ${id} unpublished audio`);
}

function handleUserJoined(user) {
  const id = user.uid;
  updateUIDs(id, "add");
  showPopup(`UID ${id} Joined as Host`);
}

function handleUserLeft(user) {
  const id = user.uid;
  removeItemOnce(remotesArray, id);
  updateUIDs(id, "remove");
  showPopup(`UID ${id} Offline`);
}

function handleUserInfoUpdated(uid, message) {
  console.log(`User Info Updated for ${uid}, new state is: ${message}`);
  showPopup(`UID ${uid} new state: ${message}`);
}

function reportStreamTypeChanged(uid, streamType) {
  console.log(`Receive Stream for remote UID ${uid} changed to ${streamType}`);
}

function reportAutoFallback(proxyServer) {
console.log(`AutoFallback proxy being used detected, server is: ${proxyServer}`);
showPopup(`AutoFallback proxy being used detected, server is: ${proxyServer}`);
connectionState.isProxy = true;
}

function reportProxyUsed(isProxyUsed) {
console.log(`is-cloud-proxy-used reports: ${isProxyUsed}`);
connectionState.isTURN = true;
}

function reportConnectionState(cur, prev, reason) {
  if (cur == "DISCONNECTED") {
    console.log(`connection-state-changed: Current: ${cur}, Previous: ${prev}, Reason: ${reason}`);
    showPopup(`Connection State: ${cur}, Reason: ${reason}`)
    if (reason == "FALLBACK") {
      console.log(`Autofallback TCP Proxy being attempted.`);
      showPopup(`Autofallback TCP Proxy Attempted`);
    }
  } else if (cur == "CONNECTED") {
    console.log(`connection-state-changed: Current: ${cur}, Previous: ${prev}`);
    showPopup(`Connection State: ${cur}`);
    connectionState.isJoined = true;
  } else {
    console.log(`connection-state-changed: Current: ${cur}, Previous: ${prev}`);
    showPopup(`Connection State: ${cur}`);
    connectionState.isJoined = false;
  }
  }

async function changeModes(label) {
  mode = modes.find(profile => profile.label === label);
  $(".proxy-input").val(`${mode.detail}`);
}
function initModes() {
  modes.forEach(profile => {
    $(".proxy-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  mode = modes[0];
  $(".proxy-input").val(`${mode.detail}`);
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

function showPopup(message) {
  const newPopup = popups + 1;
  console.log(`Popup count: ${newPopup}`);
  const y = $(`<div id="popup-${newPopup}" class="popupHidden">${message}</div>`);
  $("#popup-section").append(y);
  //$("#popup").text(`UID ${id} Offline`);
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