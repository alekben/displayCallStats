function generateRandomString(length) {
  const characters = '0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}

//vb
let vb = null;
let processor = null;
const pipeProcessor = (track, processor) => {
    track.pipe(processor).pipe(track.processorDestination);
};
processorOn = false;

//svc
svcOn = true;

//proxy
proxy = false;

AgoraRTC.setParameter('WEBAUDIO_INIT_OPTIONS',
  { latencyHint: 0.03, sampleRate: 48000, }
  );
AgoraRTC.setParameter('ENABLE_SVC', true);
//AgoraRTC.setParameter('SVC_EXTENDED', ["VP9"]);

// create Agora client
var client = AgoraRTC.createClient({
  mode: "live",
  codec: "vp9",
  role: "host"
});

var screenClient = AgoraRTC.createClient({
  mode: "live",
  codec: "vp8",
  role: "host"
});

AgoraRTC.enableLogUpload();

var localTracks = {
  videoTrack: null,
  screenTrack: null,
  audioTrack: null
};

var localTrackState = {
  audioTrackMuted: false,
  audioTrackEnabled: false,
  videoTrackMuted: false,
  videoTrackEnabled: false
}

var joined = false;
var screenJoined = false;

var remoteUsers = {};
var userCount = 0;

// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  screenUid: null
};

AgoraRTC.onAutoplayFailed = () => {
  alert("click to start autoplay!");
};

let statsInterval;

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.uid = urlParams.get("uid");
  if (options.appid && options.channel) {
    $("#uid").val(options.uid);
    $("#appid").val(options.appid);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
});
$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    if (!client) {
      client = await AgoraRTC.createClient({
        mode: "live",
        codec: "vp9",
        role: "host"
      });
    }
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    options.screenUid = Number(generateRandomString(6));
    options.appid = $("#appid").val();
    
    await join();
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      $("#success-alert").css("display", "block");

  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
    $("#createTrack").attr("disabled", false);
    $("#publishTrack").attr("disabled", true);
    $("#setMuted").attr("disabled", true);
    $("#setEnabled").attr("disabled", true);
    $("#setMutedCam").attr("disabled", false);
    $("#setEnabledCam").attr("disabled", false);
    $("#screenShare").attr("disabled", false);
    $("#vb").attr("disabled", false);
    $("#svc").attr("disabled", true);
    $("#proxy").attr("disabled", true);
    joined = true;
    if (!vb) {
      vb = vb || (() => {
      let vb = new VirtualBackgroundExtension();
      AgoraRTC.registerExtensions([vb]);
      return vb;
    })();
    processor = processor || (await (async () => {
      let processor = vb.createProcessor();
      processor.eventBus.on("PERFORMANCE_WARNING", () => {
        console.warn("Performance warning!!!!!!!!!!!!!!!!!");
      });
      processor.eventBus.on("cost", (cost) => {
          console.log(`cost of vb is ${cost}`);
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
    };
    pipeProcessor(localTracks.videoTrack, processor);
    processor.setOptions({type: 'blur', blurDegree: 3});
    await processor.enable();
    processorOn = true;
  }
});
$("#leave").click(function (e) {
  leave();
});

$("#createTrack").click(function (e) {
  createMicTrack();
  localTrackState.audioTrackEnabled = true;
  localTrackState.audioTrackMuted = false;
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

$("#setMutedCam").click(function (e) {
  if (!localTrackState.videoTrackMuted) {
    muteVideo();
  } else {
    unmuteVideo();
  }
});

$("#setEnabledCam").click(function (e) {
  if (localTrackState.videoTrackEnabled) {
    disableVideo();
  } else {
    enableVideo();
  }
});

$("#screenShare").click(function (e) {
  if (screenJoined) {
    stopScreenShare();
  } else {
    startScreenShare();
  }
});

$("#vb").click(function (e) {
  if (processorOn) {
    processor.disable();
    processorOn = false;
  } else {
    processor.enable();
    processorOn = true;
  }
});

$("#svc").click(function (e) {
  if (svcOn) {
    AgoraRTC.setParameter('ENABLE_SVC', false);
    svcOn = false;
    $("#svc").text("SVC is OFF");
  } else {
    AgoraRTC.setParameter('ENABLE_SVC', true);
    svcOn = true;
    $("#svc").text("SVC is ON");
  }
});

$("#proxy").click(function (e) {
  if (proxy) {
    client.startProxyServer(0);
    screenClient.startProxyServer(0);
    proxy = false;
    $("#proxy").text("Proxy3 is OFF");
  } else {
    client.startProxyServer(3);
    screenClient.startProxyServer(3);
    proxy = true;
    $("#proxy").text("Proxy3 is ON");
  }
});

async function createMicTrack() {
  localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({encoderConfig: "music_standard", "AEC": true, "ANS": true, "AGC": true});
}

async function startScreenShare() {
  options.screenUid = await screenClient.join(options.appid, options.channel, null, options.screenUid);
  screenJoined = true;
  localTracks.screenTrack = await AgoraRTC.createScreenVideoTrack({encoderConfig: {"width":1920,"height":1080,"frameRate":30,"bitrateMin":2500,"bitrateMax":3200}, optimizationMode :"detail"}, "disabled");
  screenClient.publish(localTracks.screenTrack);
  localTracks.screenTrack.play("local-screen-player");
  localTracks.screenTrack.on("track-ended", () => {
      stopScreenShare();
    });
  $("#screenShare").text("Stop Screen Share");
}

async function stopScreenShare() {
  localTracks.screenTrack.stop();
  localTracks.screenTrack.close();
  screenClient.leave();
  screenJoined = false;
  $("#screenShare").text("Start Screen Share");
}

async function publishMic() {
    await client.publish(localTracks.audioTrack);
    console.log("Published mic track");
    localTrackState.audioTrackMuted = false;
    localTrackState.audioTrackEnabled = true;
}

async function muteAudio() {
  if (!localTracks.audioTrack) return;
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
  await localTracks.audioTrack.setEnabled(false);
  localTrackState.audioTrackEnabled = false;
  $("#setEnabled").text("Enable Mic Track");
  $("#setMuted").attr("disabled", true);
}

async function enableAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setEnabled(true);
  localTrackState.audioTrackEnabled = true;
  $("#setEnabled").text("Disable Mic Track");
  $("#setMuted").attr("disabled", false);
}

async function muteVideo() {
  if (!localTracks.videoTrack) return;
  await localTracks.videoTrack.setMuted(true);
  localTrackState.videoTrackMuted = true;
  $("#setMutedCam").text("Unmute Cam Track");
}

async function unmuteVideo() {
  if (!localTracks.videoTrack) return;
  await localTracks.videoTrack.setMuted(false);
  localTrackState.videoTrackMuted = false;
  $("#setMutedCam").text("Mute Cam Track");
}

async function disableVideo() {
  if (!localTracks.videoTrack) return;
  await localTracks.videoTrack.setEnabled(false);
  localTrackState.videoTrackEnabled = false;
  $("#setEnabledCam").text("Enable Cam Track");
  $("#setMutedCam").attr("disabled", true);
}

async function enableVideo() {
  if (!localTracks.videoTrack) return;
  await localTracks.videoTrack.setEnabled(true);
  localTrackState.videoTrackEnabled = true;
  $("#setEnabledCam").text("Disable Cam Track");
  $("#setMutedCam").attr("disabled", false);
}

async function join() {
  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join the channel
  options.uid = await client.join(options.appid, options.channel, null, options.uid || null);

  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {width:848, height:480, bitrateMax:768, bitrateMin:512, frameRate:24}, optimizationMode: "detail"});
  }
  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#joined-setup").css("display", "flex");

  // publish local tracks to channel
  await client.publish(localTracks.videoTrack);
  console.log("publish cam success");
  localTrackState.videoTrackEnabled = true;
  localTrackState.videoTrackMuted = false;
  initStats();
}
async function leave() {
  await processor.disable();

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
  screenJoined = false;

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
  $("#setMuted").text("Mute Mic Track");
  $("#setEnabled").text("Disable Mic Track");
  $("#setMuted").attr("disabled", true);
  $("#setEnabled").attr("disabled", true);
  $("#setMutedCam").text("Mute Cam Track");
  $("#setEnabledCam").text("Disable Cam Track");
  $("#setMuted").attr("disabled", true);
  $("#setEnabled").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  $("#screenShare").attr("disabled", true);
  $("#screenShare").text("Start Screen Share");
  $("#vb").attr("disabled", true);
  $("#svc").attr("disabled", false);
  $("#proxy").attr("disabled", false);
  processorOn = false;
  localTrackState.audioTrackEnabled = false;
  localTrackState.audioTrackMuted = false;
  localTrackState.videoTrackEnabled = false;
  localTrackState.videoTrackMuted = false;
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
    if (id === options.screenUid) {
      console.log("This is my screenshare ignoring");
    } else {
      remoteUsers[id] = user;
      if (mediaType === 'video') {
        userCount = getRemoteCount(remoteUsers);
        console.log(`Remote User Video Count now: ${userCount}`);
      }
      subscribe(user, mediaType);
    }
  }
}

function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    const id = user.uid;
    if (id === options.screenUid) {
      console.log("Ignorning, this is my screenshare");
    } else {
      delete remoteUsers[id];
      $(`#player-wrapper-${id}`).remove();
    }
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
  $("#local-screen-stats").html("");
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

// if screen client is active:
if (screenJoined) {
  const localStats = {
    video: screenClient.getLocalVideoStats(),
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
  $("#local-screen-stats").html(`
  ${localStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
  `);
}



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
