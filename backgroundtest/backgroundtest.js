
//
let dual = false;
//vb
let vb = null;
let processor = null;
let processorIsDisable = true;
const pipeProcessor = (track, processor) => {
  track.pipe(processor).pipe(track.processorDestination);
};

//ains
let denoiser = null;
let processor_ains = null;
let processorEnable = true;
const pipeAIDenosier = (audioTrack, processor_ains) => {
  audioTrack.pipe(processor_ains).pipe(audioTrack.processorDestination);
};

//misc
var popups = 0;
var joined = false;
var remoteUsers = {};
var remotesArray = [];
var userCount = 0;
var localNetQuality = {uplink: 0, downlink: 0};
var host = true;
var bigRemote = 0;
var remoteFocus = 0;
var dumbTempFix = "Selected";


// create Agora client early
var client = AgoraRTC.createClient({
  mode: "live",
  codec: "vp9"
});
AgoraRTC.enableLogUpload();
//client.startProxyServer(5);
client.enableDualStream();

var screenClient;

var localTracks = {
  videoTrack: null,
  videoTrack2: null,
  audioTrack: null,
  screenTrack: null
};

var localTrackState = {
  audioTrackMuted: false,
  audioTrackEnabled: false,
  audioTrackPublished: false,
  screenTrackPublished: false
};

// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  screenUid: null,
  token: null,
  screenToken: null
};

var videoProfiles = [{
  label: "480p_vp9",
  detail: "640×480, 30fps, 200Kbps",
  value: `{"width":640, "height":480, "frameRate":30, "bitrateMin":100, "bitrateMax":200}`
}, {
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
  if (joined) {
    if (!localTracks.audioTrack) {
      localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: curMicProfile.value, "AEC": true, "ANS": true, "AGC": true
      });
    } else {
      console.log("mic track already exists, replacing.");
      if (localTrackState.audioTrackPublished) {
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
        localTrackState.audioTrackPublished = true;
      } else {
        await localTracks.audioTrack.stop();
        await localTracks.audioTrack.close();
        localTracks.audioTrack = undefined;
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: curMicProfile.value, "AEC": true, "ANS": true, "AGC": true
        });;
        $("#setMuted").attr("disabled", false);
        $("#setEnabled").attr("disabled", false);
        $("#setMuted").text("Mute Mic Track");
        $("#setEnabled").text("Disable Mic Track");
        localTrackState.audioTrackEnabled = true;
        localTrackState.audioTrackMuted = false;
        localTrackState.audioTrackPublished = false;
      }
      }

      if (!localTracks.videoTrack) {
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: curVideoProfile.value
        });
      } else {
        console.log("cam track already exists, replacing.");
        await client.unpublish(localTracks.videoTrack);
        await localTracks.videoTrack.stop();
        await localTracks.videoTrack.close();
        localTracks.videoTrack = undefined;
        localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: curVideoProfile.value
        });
        await client.publish(localTracks.videoTrack);
        localTracks.videoTrack.play("local-player");
        localTrackState.videoTrackEnabled = true;
        localTrackState.videoTrackMuted = false;
      }
    }

  if (localTracks.audioTrack) {
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

  if (localTracks.videoTrack) {
    //get cams
    cams = await AgoraRTC.getCameras();
    const videoTrackLabel = localTracks.videoTrack.getTrackLabel();
    currentCam = cams.find(item => item.label === videoTrackLabel);
    $(".cam-input").val(currentCam.label);
    $(".cam-list").empty();
    cams.forEach(cam => {
      $(".cam-list").append(`<a class="dropdown-item" href="#">${cam.label}</a>`);
    });
  }
}

async function switchCamera(label) {
  currentCam = cams.find(cam => cam.label === label);
  $(".cam-input").val(currentCam.label);
  // switch device of local video track.
  console.log(`Setting cam device to ${currentCam.device} ${currentCam.deviceId}`);
  await localTracks.videoTrack.setDevice(currentCam.deviceId);
}

async function switchMicrophone(label) {
  currentMic = mics.find(mic => mic.label === label);
  $(".mic-input").val(currentMic.label);
  // switch device of local audio track.
  console.log(`Setting mic device to ${currentMic.device} ${currentMic.deviceId}`);
  await localTracks.audioTrack.setDevice(currentMic.deviceId);
}

function initMicProfiles() {
  audioProfiles.forEach(profile => {
    $(".profile-mic-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  curMicProfile = audioProfiles.find(item => item.label == 'music_standard');
  $(".profile-mic-input").val(`${curMicProfile.detail}`);
}

async function changeMicProfile(label) {
  curMicProfile = audioProfiles.find(profile => profile.label === label);
  $(".profile-mic-input").val(`${curMicProfile.detail}`);
  // change the local audio track`s encoder configuration
  initDevices();
}

function initVideoProfiles() {
  videoProfiles.forEach(profile => {
    $(".profile-cam-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  curVideoProfile = videoProfiles.find(item => item.label == '1080p_2');
  $(".profile-cam-input").val(`${curVideoProfile.detail}`);
}
async function changeVideoProfile(label) {
  curVideoProfile = videoProfiles.find(profile => profile.label === label);
  $(".profile-cam-input").val(`${curVideoProfile.detail}`);
  // change the local video track`s encoder configuration
  localTracks.videoTrack && (await localTracks.videoTrack.setEncoderConfiguration(curVideoProfile.value));
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
  $(".profile-mic-list").delegate("a", "click", function (e) {
    changeMicProfile(this.getAttribute("label"));
  });
  initVideoProfiles();
  $(".profile-cam-list").delegate("a", "click", function (e) {
    changeVideoProfile(this.getAttribute("label"));
  });
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.uid = urlParams.get("uid");
  options.uid = urlParams.get("screenUid");
  options.uid = urlParams.get("screenToken");
  if (options.token != null) {
    options.token = options.token.replace(/ /g,'+');
    }
  if (options.screenToken != null) {
      options.screenToken = options.screenToken.replace(/ /g,'+');
    }
  if (options.appid && options.channel) {
    $("#uid").val(options.uid);
    $("#uidScreen").val(options.screenUid);
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#tokenScreen").val(options.screenToken);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
  $('#agora-collapse').collapse('toggle');
});
$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "live",
        codec: "vp9"
      });
    }
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    if (host) {
      client.setClientRole("host");
    } else {
      client.setClientRole("audience");
    }
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
    $("#role").attr("disabled", true);
    //$("#ains").attr("disabled", false);
    $("#vb").attr("disabled", false);
    $("#createTrack").attr("disabled", false);
    $("#publishTrack").attr("disabled", true);
    $("#setMuted").attr("disabled", true);
    $("#setEnabled").attr("disabled", true);
    $("#subscribe").attr("disabled", false);
    $("#unsubscribe").attr("disabled", false);
    $("#biggerView").attr("disabled", false);
    $("#screen").attr("disabled", false);
    joined = true;
  }
});
$("#leave").click(function (e) {
  leave();
});

$("#screen").click(function (e) {
  shareScreen();
});

$(".uid-list").delegate("a", "click", function (e) {
  changeTargetUID(this.getAttribute("label"));
});


$("#createTrack").click(function (e) {
  initDevices();
  $("#createTrack").attr("disabled", true);
  $("#publishTrack").attr("disabled", false);
  $("#ains").attr("disabled", false);
});

$("#publishTrack").click(function (e) {
  publishMic();
  $("#publishTrack").attr("disabled", true);
  $("#setMuted").attr("disabled", false);
  $("#setEnabled").attr("disabled", false);
  $("#local-player").css("border", "7px solid yellowgreen");
  $("#local-player").css("border-radius", "10px");
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

$('#agora-collapse').on('show.bs.collapse	', function () {
  initDevices();
});
$(".mic-list").delegate("a", "click", function (e) {
  switchMicrophone(this.text);
});
$(".cam-list").delegate("a", "click", function (e) {
  switchCamera(this.text);
});

$("#biggerView").click(function (e) {
  handleExpand();
});

$("#ains").click(async e => {
    e.preventDefault();
    denoiser = denoiser || (() => {
      let denoiser = new AIDenoiser.AIDenoiserExtension({
        assetsPath: '../audiotrackconfig/aiDenoiserExtension/external'
      });
      AgoraRTC.registerExtensions([denoiser]);
      denoiser.onloaderror = e => {
        console.error(e);
        processor_ains = null;
      };
      return denoiser;
    })();
    processor_ains = processor_ains || (() => {
      let processor_ains = denoiser.createProcessor();
      processor_ains.onoverload = async (elapsedTimeInMs) => {
        console.log(`"overload!!! elapsed: ${elapsedTimeInMs}`);
        try {
          await processor_ains.disable();
          processorEnable = true;
        } catch (error) {
          console.error("disable AIDenoiser failure");
        } finally {
          $("#ains").text("AINS Off");
        }
      };
      return processor_ains;
    })();
    pipeAIDenosier(localTracks.audioTrack, processor_ains);
  
    if (processorEnable) {
      try {
        await processor_ains.enable();
        showPopup("AINS enabled");
        processorEnable = false;
        //await processor_ains.setMode("STATIONARY_NS");
        await processor_ains.setLevel("AGGRESSIVE");
      } catch (e) {
        console.error("enable AIDenoiser failure");
      } finally {
        $("#ains").text("AINS Off");
      }
    } else {
      try {
        await processor_ains.disable();
        processorEnable = true;
        showPopup("AINS disabled");
      } catch (e) {
        console.error("disable AIDenoiser failure");
      } finally {
        $("#ains").text("AINS On");
      }
  }
});

$("#vb").click(async e => {
  e.preventDefault();
  vb = vb || (() => {
    let vb = new VirtualBackgroundExtension();
    AgoraRTC.registerExtensions([vb]);
    return vb;
  })();
  processor = processor || (await (async () => {
    let processor = vb.createProcessor();
    processor.eventBus.on("PERFORMANCE_WARNING", () => {
      console.warn("Performance warning!!!!!!!!!!!!!!!!!");
      showPopup("VirtualBackground performance warning!");
    });
    processor.eventBus.on("cost", (cost) => {
      console.warn(`cost of vb is ${cost}`);
    });
    processor.onoverload = async () => {
      console.log("overload!!!");
    };
    try {
      await processor.init("not_needed");
    } catch (error) {
      console.error(error);
      processor = null;
    }
    return processor;
  })());
  pipeProcessor(localTracks.videoTrack, processor);
  processor.setOptions({type: 'blur', blurDegree: 3});
  if (processorIsDisable) {
    try {
      await processor.enable();
      $("#vb").val("VB Off");
      processorIsDisable = false;
    } catch (e) {
      console.error("enable VirtualBackground failure", e);
    } finally {
      showPopup("VirtualBackground On!");
    }
  } else {
    try {
      await processor.disable();
      $("#vb").val("VB On");
      processorIsDisable = true;
    } catch (e) {
      console.error("disable VirtualBackground failure", e);
    } finally {
      showPopup("VirtualBackground Off!");
    }
  }
});

$("#role").click(function (e) {
  if (host) {
    host = false;
    $("#role").text("Role: Audience");
  } else {
    host = true;
    $("#role").text("Role: Host");
  }
});


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
    localTrackState.audioTrackPublished = true;
    $("#local-player").css("border", "7px solid yellowgreen");
    $("#local-player").css("border-radius", "10px");
}

async function muteAudio() {
  if (!localTracks.audioTrack) return;
  /**
   * After calling setMuted to mute an audio or video track, the SDK stops sending the audio or video stream. Users whose tracks are muted are not counted as users sending streams.
   * Calling setEnabled to disable a track, the SDK stops audio or video capture
   */
  await localTracks.audioTrack.setMuted(true);
  localTrackState.audioTrackMuted = true;
  localTrackState.audioTrackPublished = false;
  $("#setMuted").text("Unmute Mic Track");
  showPopup("Mic Track Muted");
  $("#local-player").css("border", "7px solid grey");
  $("#local-player").css("border-radius", "10px");
}

async function unmuteAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setMuted(false);
  localTrackState.audioTrackMuted = false;
  localTrackState.audioTrackPublished = true;
  $("#setMuted").text("Mute Mic Track");
  showPopup("Mic Track Unmuted");
  $("#local-player").css("border", "7px solid yellowgreen");
  $("#local-player").css("border-radius", "10px");
}

async function disableAudio() {
  if (!localTracks.audioTrack) return;
  /**
   * After calling setMuted to mute an audio or video track, the SDK stops sending the audio or video stream. Users whose tracks are muted are not counted as users sending streams.
   * Calling setEnabled to disable a track, the SDK stops audio or video capture
   */
  await localTracks.audioTrack.setEnabled(false);
  localTrackState.audioTrackEnabled = false;
  localTrackState.audioTrackPublished = false;
  showPopup("Mic Track Disabled");
  $("#setEnabled").text("Enable Mic Track");
  $("#local-player").css("border", "7px solid grey");
  $("#local-player").css("border-radius", "10px");
}

async function enableAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(true);
  localTrackState.audioTrackEnabled = true;
  localTrackState.audioTrackPublished = true;
  showPopup("Mic Track Enabled");
  $("#setEnabled").text("Disable Mic Track");
  $("#local-player").css("border", "7px solid yellowgreen");
  $("#local-player").css("border-radius", "10px");
}

async function join() {
  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  client.on("user-joined", handleUserJoined);
  client.on("user-left", handleUserLeft);
  client.on("user-info-updated", handleUserInfoUpdated);
  client.on("exception", handleLowInput);
  //client.on("network-quality", handleNetworkQuality);

  // join the channel
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);

  if (host) {
    if (!localTracks.videoTrack) {
      localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: curVideoProfile.value
      });
    }

    //localTracks.videoTrack.contentHint = "ptz";
    // play local video track
    localTracks.videoTrack.play("local-player");
    $("#local-player").css("border", "7px solid gray");
    $("#local-player").css("border-radius", "10px");
    $("#joined-setup").css("display", "flex");

    // publish local tracks to channel
    await client.publish(localTracks.videoTrack);
    console.log("publish cam success");
    showPopup("Cam Track Published");
  } else {
    $("#joined-setup").css("display", "flex");
  }
  showPopup(`Joined to channel ${options.channel} with UID ${options.uid}`);
  initStats();
  notifyReady();
  $('#agora-collapse').collapse('toggle');
}

async function shareScreen() {
  if (!screenClient) {
    screenClient = AgoraRTC.createClient({
      mode: "live",
      codec: "vp9",
      role: "host"
    });
    //screenClient.startProxyServer(5);
  }
  if (localTrackState.screenTrackPublished) {
    console.log('unpublishing screen track');
    localTrackState.screenTrackPublished = false;
    screenClient.unpublish(localTracks.screenTrack);
    localTracks.screenTrack.stop();
    localTracks.screenTrack.close();
    $("#screen").text("Share Screen");
    screenClient.leave();
  } else {
    console.log('publishing screen track');
    localTracks.screenTrack = await AgoraRTC.createScreenVideoTrack({encoderConfig: "1080p", monitorTypeSurfaces: "exclude"}, "disabled");
    options.screenUid = await screenClient.join(options.appid, options.channel, options.screenToken || null, options.screenUid || null);
    screenClient.publish(localTracks.screenTrack);
    localTrackState.screenTrackPublished = true;
    $("#screen").text("Stop Screen Share");
  }
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
  $("#role").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#createTrack").attr("disabled", true);
  $("#publishTrack").attr("disabled", true);
  $("#setMuted").attr("disabled", true);
  $("#setEnabled").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  $("#subscribe").attr("disabled", true);
  $("#unsubscribe").attr("disabled", true);
  $("#biggerView").attr("disabled", true);
  $("#ains").attr("disabled", true);
  $("#vb").attr("disabled", true);
  $("#screen").attr("disabled", true);
  remoteFocus = 0;
  bigRemote = 0;
  console.log("client leaves channel success");

}

async function manualSub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  showPopup(`Manually subscribed video to UID ${id}`);
  await subscribe(user, "video");
  //await subscribe(user, "audio");
}

async function manualUnsub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  await client.unsubscribe(user, "video");
  $(`#player-wrapper-${id}`).remove();
  showPopup(`Manually unsubscribed video from UID ${id}`);
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
    user.videoTrack.on("first-frame-decoded", handleFirstFrame);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
  showPopup(`Subscribing to ${mediaType} of UID ${uid}`);
}

function handleFirstFrame() {
  console.log(`first frame decoded`);
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

function handleNetworkQuality(stats) {
  localNetQuality.uplink = stats.uplinkNetworkQuality;
  localNetQuality.downlink = stats.downlinkNetworkQuality;
  const d = new Date();
  let time = d.getTime();
  console.log(`${time} - ${localNetQuality.downlink}d - ${localNetQuality.uplink}u`);
  client.sendCustomReportMessage({
    reportId: "50", category: "netstats", event: "netstats", label: String("stats"), value: String(`$//{localNetQuality.uplink}u ${localNetQuality.downlink}d`)});
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

function notifyReady() {
  if (typeof window.navigator.notifyReady === 'function')
      window.navigator.notifyReady();
}

function handleLowInput(event) {
  stats = localTracks.audioTrack.getStats();
  if (event.code == 2001 && stats.sendBitrate != 0 ) {
    zeroVolume = true;
    console.log("frank - audio input low trigger while published, starting 10 sec timer");
    showPopup("audio input low trigger while published, starting 10 sec timer");
    $("#local-player").css("border", "7px solid gray");
    $("#local-player").css("border-radius", "10px");
    setTimeout(() => {
      if (zeroVolume) {
        console.log("frank - audio input low trigger not recovered, reseting track");
        showPopup("audio input low trigger not recovered, reseting track");
        localTracks.audioTrack.setEnabled(false).then(() => {
          localTracks.audioTrack.setEnabled(true);
        });
      }
    }, 10000);
  } else if (event.code == 4001) {
    console.log("frank - audio input low trigger recovered, cancel reset");
    showPopup("audio input low trigger recovered, cancel reset");
    $("#local-player").css("border", "7px solid yellowgreen");
    $("#local-player").css("border-radius", "10px");
    zeroVolume = false;
  }
}

// flush stats views
function flushStats() {
  // get the client stats message
  const status = navigator.onLine;
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
  }, {
    description: "Uplink Stat",
    value: localNetQuality.uplink,
    unit: ""
  }, {
    description: "Downlink Stat",
    value: localNetQuality.downlink,
    unit: ""
  }, {
    description: "Link Status",
    value: status,
    unit: ""
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
    net: client.getRemoteNetworkQuality()[uid]
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
    description: "Total video freeze time",
    value: remoteTracksStats.video.totalFreezeTime,
    unit: "s"
  }, {
    description: "Remote Uplink",
    value: remoteTracksStats.net.uplinkNetworkQuality,
    unit: ""
  }, {
    description: "Remote Downlink",
    value: remoteTracksStats.net.downlinkNetworkQuality,
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

