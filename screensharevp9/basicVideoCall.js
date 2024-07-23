


var client;
var scrClient;
AgoraRTC.enableLogUpload();
const extension = new VirtualBackgroundExtension();
AgoraRTC.registerExtensions([extension]);
let processor = null;

/*
 * Clear the video and audio tracks used by `client` on initiation.
 */
var localTracks = {
  videoTrack: null,
  audioTrack: null,
  screenTrack: null
};

var localTrackState = {
  audioTrackMuted: false,
  audioTrackEnabled: false,
  audioPublished: false,
  camPublished: false,
  screenPublished: false
};

/*
 * On initiation no users are connected.
 */
var remoteUsers = {};
var remotesArray = [];

/*
 * On initiation. `client` is not attached to any project or channel for any specific user.
 */
var options = {
  appid: null,
  channel: null,
  uid: null,
  scrUid: null,
  token: null
};


// you can find all the agora preset video profiles here https://docs.agora.io/en/Voice/API%20Reference/web_ng/globals.html#videoencoderconfigurationpreset

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

var screenProfiles = [{
  label: "720p_1",
  detail: "1280×720, 5fps",
  value: {width:1280, height:720, frameRate:5, bitrateMin:120, bitrateMax:500}
}, {
  label: "720p_2",
  detail: "1280x720, 15fps",
  value: {width:1280, height:720, frameRate:15, bitrateMin:240, bitrateMax:1000}
}, {
  label: "720p_3",
  detail: "1280x720, 30fps",
  value: {width:1280, height:720, frameRate:30, bitrateMin:360, bitrateMax:1250}
}, {
  label: "1080p_1",
  detail: "1920x1080, 5fps",
  value: {width:1920, height:1080, frameRate:5, bitrateMin:360, bitrateMax:750}
}, {
  label: "1080p_2",
  detail: "1920x1080, 15fps",
  value: {width:1920, height:1080, frameRate:15, bitrateMin:540, bitrateMax:1500}
}, {
  label: "1080p_3",
  detail: "1920x1080, 30fps",
  value: {width:1920, height:1080, frameRate:30, bitrateMin:360, bitrateMax:2000}
}];
var curScreenProfile;



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
  curVideoProfile = videoProfiles.find(item => item.label == '720p_2');
  $(".profile-input").val(`${curVideoProfile.detail}`);
  screenProfiles.forEach(profile => {
    $(".profile-screen-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  curScreenProfile = screenProfiles.find(item => item.label == '1080p_3');
  $(".profile-screen-input").val(`${curScreenProfile.detail}`);
}

async function changeVideoProfile(label) {
  curVideoProfile = videoProfiles.find(profile => profile.label === label);
  $(".profile-input").val(`${curVideoProfile.detail}`);
  // change the local video track`s encoder configuration
  localTracks.videoTrack && (await localTracks.videoTrack.setEncoderConfiguration(curVideoProfile.value));
}

async function changeScreenProfile(label) {
  curScreenProfile = screenProfiles.find(profile => profile.label === label);
  $(".profile-screen-input").val(`${curScreenProfile.detail}`);
  // change the local video track`s encoder configuration
  localTracks.screenTrack && (await localTracks.screenTrack.setEncoderConfiguration(curScreenProfile.value));
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
  $(".profile-screen-list").delegate("a", "click", function (e) {
    changeScreenProfile(this.getAttribute("label"));
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

/*
 * When a user clicks Join or Leave in the HTML form, this procedure gathers the information
 * entered in the form and calls join asynchronously. The UI is updated to match the options entered
 * by the user.
 */
$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  $("#subscribe").attr("disabled", false);
  $("#unsubscribe").attr("disabled", false);
  $("#publishTrack").attr("disabled", false);
  $("#setMuted").attr("disabled", false);
  $("#setEnabled").attr("disabled", false);
  $("#screenOrCam").attr("disabled", false);
  try {
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "rtc",
        codec: getCamCodec()
      });
    }
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    await join();
    await publishCam();
    await publishScreen();
    await startVB();
    processor.setOptions({type: 'blur', blurDegree: 2});
    await processor.enable();
    localTrackState.audioTrackMuted = false;
    localTrackState.audioTrackEnabled = false;
    localTrackState.audioPublished = false;
    localTrackState.camPublished = true;
    localTrackState.screenPublished = true;
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
$("#publishTrack").click(function (e) {
  publishMic();
  $("#publishTrack").attr("disabled", false);
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


async function publishMic() {
  if (localTrackState.audioPublished == true) {
    unpublishMic();
  } else {

  if (!localTracks.audioTrack) {
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: curMicProfile.value, "AEC": true, "ANS": true, "AGC": true
    });
  }
    await client.publish(localTracks.audioTrack);
    console.log("Published mic track");
    //localTrackState.audioTrackMuted = false;
    //localTrackState.audioTrackEnabled = true;
    localTrackState.audioPublished = true;
    $("#publishTrack").text("Unpublish Mic Track");
    var x = document.getElementById("popup");
    $("#popup").text(`Mic Published`);
    x.className = "show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}
}

async function unpublishMic() {
    await client.unpublish(localTracks.audioTrack);
    console.log("Unpublished mic track");
    //localTrackState.audioTrackMuted = false;
    //localTrackState.audioTrackEnabled = true;
    localTrackState.audioPublished = false;
    $("#publishTrack").text("Publish Mic Track");
    var x = document.getElementById("popup");
    $("#popup").text(`Mic Unpublished`);
    x.className = "show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
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
  var x = document.getElementById("popup");
  $("#popup").text(`Mic Track Muted`);
  x.className = "show";
  setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}

async function unmuteAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setMuted(false);
  localTrackState.audioTrackMuted = false;
  $("#setMuted").text("Mute Mic Track");
  var x = document.getElementById("popup");
  $("#popup").text(`Mic Track Unmuted`);
  x.className = "show";
  setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
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
  var x = document.getElementById("popup");
  $("#popup").text(`Mic Track Disabled`);
  x.className = "show";
  setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}

async function enableAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(true);
  localTrackState.audioTrackEnabled = true;
  $("#setEnabled").text("Disable Mic Track");
  var x = document.getElementById("popup");
  $("#popup").text(`Mic Track Enabled`);
  x.className = "show";
  setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
}

async function manualSub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  await subscribe(user, "video");
  await subscribe(user, "audio");
}

async function manualUnsub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  await client.unsubscribe(user, "");
  $(`#player-wrapper-${id}`).remove();
}
/*
 * Join a channel, then create local video and audio tracks and publish them to the channel.
 */
async function join() {
  // Add an event listener to play remote tracks when remote user publishes.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  // Join the channel.
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);

  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
      encoderConfig: curVideoProfile.value
    });
  }

  if (!localTracks.screenTrack) {
    localTracks.screenTrack = await AgoraRTC.createScreenVideoTrack({encoderConfig: curScreenProfile.value}, "auto");
  }

  try {
    if (!scrClient) {
      scrClient = AgoraRTC.createClient({
        mode: "rtc",
        codec: getScreenCodec()
      });
    }
    options.scrUid = await scrClient.join(options.appid, options.channel, options.token || null, options.scrUid || null);
  } catch (error) {
    console.error(error);
  }
}

async function publishCam() {
  await client.publish(localTracks.videoTrack);
  console.log("publish cam success");
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);
}

async function publishScreen() {
  await scrClient.publish(localTracks.screenTrack);
  console.log("publish screen success");
  localTracks.screenTrack.play("local-player-screen");
  $("#local-player-screen-name").text(`localVideo(${options.scrUid})`);
}

async function startVB() {
    if (!processor && localTracks.videoTrack) {
      processor = extension.createProcessor();
        try {
          await processor.init("./assets/wasms");
          } catch(e) {
            console.log("Fail to load WASM resource!");return null;
            }
      localTracks.videoTrack.pipe(processor).pipe(localTracks.videoTrack.processorDestination);
    }
    return processor;
}


async function leave() {
  await processor.disable();
  localTracks.videoTrack.unpipe();
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
    audioPublished: false
  };

  // Remove remote users and player views.
  remoteUsers = {};
  $("#remote-playerlist").html("");

  remotesArray = [];
  $(".uid-list").empty();
  $(".uid-input").val(``);

  // leave the channel
  await client.leave();
  await scrClient.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  $("#subscribe").attr("disabled", true);
  $("#unsubscribe").attr("disabled", true);
  $("#publishTrack").text("Publish Mic Track");
  $("#publishTrack").attr("disabled", true);
  $("#setMuted").text("Mute Mic Track");
  $("#setMuted").attr("disabled", true);
  $("#setEnabled").text("Disable Mic Track");
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
    <div class="container-controls">
      <p class="player-name">remoteUser(${uid})</p>
    </div> 
    <div id="player-${uid}" data-size-variant="sm" class="player2"></div>
  </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === "audio") {
    user.audioTrack.play();
  }
}

/*
 * Add a user who has subscribed to the live channel to the local interface.
 *
 * @param  {IAgoraRTCRemoteUser} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to add.
 * @param {trackMediaType - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/itrack.html#trackmediatype | media type} to add.
 */
function handleUserPublished(user, mediaType) {
  const id = user.uid;
  if (id == options.uid || id == options.scrUid) {
    console.log("My own stuff, don't sub");
  } else {
    updateUIDs(id, "add");
    remoteUsers[id] = user;
    subscribe(user, mediaType);
  }
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
  }
}

function getCamCodec() {
  var radios = document.getElementsByName("radios");
  var value;
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].checked) {
      value = radios[i].value;
    }
  }
  return value;
}

function getScreenCodec() {
  var radios = document.getElementsByName("screenRadios");
  var value;
  for (var i = 0; i < radios.length; i++) {
    if (radios[i].checked) {
      value = radios[i].value;
    }
  }
  return value;
}


function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

