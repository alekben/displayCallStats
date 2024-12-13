var popups = 0;
let settingsHide = true;

google.charts.load('current', {packages: ['corechart', 'line']});
var chart;
var chartArray = [];

var chartJitter;
var chartArrayJitter = [];

var chartFPS;
var chartArrayFPS = [];

let statsInterval;

AgoraRTC.enableLogUpload();
//AgoraRTC.setArea("NORTH_AMERICA");
//AgoraRTC.setArea("EUROPE");
//AgoraRTC.setParameter("ENABLE_INSTANT_VIDEO", true);

var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});

var client2 = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});

var localTracks = {
  videoTrack: null,
  audioTrack: null
};

var localTrackState = {
  audioTrackMuted: false,
  audioTrackPublished: false
};

var connectionState = {
  isJoined: null,
  mediaReceived: null,
  isProxy: null,
  isTURN: null
};

var localNetQuality = {uplink: 0, downlink: 0};
var local2NetQuality = {uplink: 0, downlink: 0};

var remoteUsers = {};
let loopback = false;


var options = {
  appid: null,
  channel: null,
  uid: null,
  uid2: null,
  token: null,
};

//dual
let dual = false;
let lowStream = false;

//proxy modes
var modes = [{
  label: "Close",
  detail: "Disable Cloud Proxy",
  value: "0"
}, {
  label: "UDP Mode",
  detail: "Enable Cloud Proxy via UDP protocol",
  value: "3"
}, {
  label: "TCP Mode",
  detail: "Enable Cloud Proxy via TCP/TLS port 443",
  value: "5"
}];
var mode;

//areas
var areas = [{
  label: "AFRICA",
  detail: "AFRICA",
  value: "AFRICA"
}, {
  label: "ASIA",
  detail: "ASIA",
  value: "ASIA"
}, {
  label: "CHINA",
  detail: "CHINA",
  value: "CHINA"
}, {
  label: "EUROPE",
  detail: "EUROPE",
  value: "EUROPE"
}, {
  label: "GLOBAL",
  detail: "GLOBAL",
  value: "GLOBAL"
}, {
  label: "INDIA",
  detail: "INDIA",
  value: "INDIA"
}, {
  label: "JAPAN",
  detail: "JAPAN",
  value: "JAPAN"
}, {
  label: "KOREA",
  detail: "KOREA",
  value: "KOREA"
}, {
  label: "NORTH AMERICA",
  detail: "NORTH AMERICA",
  value: "NORTH_AMERICA"
}, {
  label: "OVERSEA",
  detail: "OVERSEA",
  value: "OVERSEA"
}, {
  label: "US",
  detail: "US",
  value: "US"
}];
var area;

//video profiles
var videoProfiles = [{
  label: "360p_1",
  detail: "640x360, 15fps, 400Kbps",
  value: "360p_1"
}, {
  label: "360p_4",
  detail: "640x360, 30fps, 600Kbps",
  value: "360p_4"
}, {
  label: "480p_8",
  detail: "848×480, 15fps, 610Kbps",
  value: "480p_8"
}, {
  label: "480p_9",
  detail: "848×480, 30fps, 930Kbps",
  value: "480p_9"
}, {
  label: "720p_1",
  detail: "1280×720, 15fps, 1130Kbps",
  value: "720p_1"
}, {
  label: "720p_2",
  detail: "1280×720, 30fps, 2000Kbps",
  value: "720p_2"
}, {
  label: "720p_auto",
  detail: "1280×720, 30fps, 3000Kbps",
  value: "720p_auto"
}, {
  label: "1080p_1",
  detail: "1920×1080, 15fps, 2080Kbps",
  value: "1080p_1"
}, {
  label: "1080p_2",
  detail: "1920×1080, 30fps, 3000Kbps",
  value: "1080p_2"
}, {
  label: "1080p_5",
  detail: "1920×1080, 60fps, 4780Kbps",
  value: "1080p_5"
}];
var curVideoProfile;
var curCam;

$(() => {
  initModes();
  initAreas();
  initProfiles();
  initCams();
  $(".proxy-list").delegate("a", "click", function (e) {
    changeModes(this.getAttribute("label"));
  });
  $(".area-list").delegate("a", "click", function (e) {
    changeArea(this.getAttribute("label"));
  });
  $(".cam-list").delegate("a", "click", function (e) {
    switchCamera(this.text);
  });
  $(".profile-list").delegate("a", "click", function (e) {
    changeProfiles(this.getAttribute("label"));
  });

  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.uid = urlParams.get("uid");
  if (options.channel == null) {
    options.channel = generateRandomString(10);
    $("#channel").val(options.channel);
  };
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
    $("#channelSettings").css("display", "none");
    $("#mute").text("Unmute Mic Track");
    $("#mute").attr("disabled", false);
    $("#dual").attr("disabled", false);
    $("#showSettings").attr("disabled", false);
    $("#settings").css("display", "none");
    if (!localTracks.audioTrack) {
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: "music_standard", "AEC": true, "ANS": true, "AGC": true
    });
    };
    localTrackState.audioTrackMuted = true;
    localTrackState.audioTrackPublished = false;
  }
});

$("#leave").click(function (e) {
  leave();
  $("#channelSettings").css("display", "");
  $("#settings").css("display", "");
});

$("#showSettings").click(function (e) {
  if (settingsHide) {
    $("#settings").css("display", "");
    settingsHide = false;
  } else {
    $("#settings").css("display", "none");
    settingsHide = true;
  }
  
});

$("#mute").click(function (e) {
  if (!localTrackState.audioTrackMuted) {
    muteAudio();
  } else {
    unmuteAudio();
  }
});

$("#dual").click(function (e) {
  changeDual();
});

$("#dualSwitch").click(function (e) {
  changeRemoteStream();
});

async function join() {
  //client.on("user-published", handleUserPublished);
  //client.on("user-unpublished", handleUserUnpublished);
  client.on("is-using-cloud-proxy", reportProxyUsed);
  client.on("join-fallback-to-proxy", reportAutoFallback);
  client2.on("stream-type-changed", reportStreamTypeChanged)
  client.on("connection-state-change", handleConnectionState);
  client.on("network-quality", handleNetworkQuality);
  client2.on("user-published", handleUserPublished2);
  client2.on("user-unpublished", handleUserUnpublished2);
  client2.on("network-quality", handleNetworkQuality2);
  client2.on("connection-state-change", handleConnectionState2);

  AgoraRTC.setArea(area.value);
  showPopup(`Area Code set to ${area.label}.`);
  
  const value = Number(mode.value);
  if ([3, 5].includes(value)) {
    client.startProxyServer(value);
    client2.startProxyServer(value);
  }
  if (value === 0) {
    client.stopProxyServer();
    client2.stopProxyServer();
  }

  if (dual) {
    client.enableDualStream();
    $("#dualSwitch").attr("disabled", false);
  }

  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  options.uid2 = await client2.join(options.appid, options.channel, options.token || null, null);

  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({encoderConfig: curVideoProfile.value, cameraId: curCam.deviceId, optimizationMode: "detail"});
  }
  //await localTracks.videoTrack.setEncoderConfiguration(curVideoProfile.value);

  localTracks.videoTrack.play("local-player");
  $("#joined-setup").css("display", "flex");
  await client.publish(localTracks.videoTrack);
  console.log("publish cam success");
  showPopup(`Joined to channel ${options.channel} with UID ${options.uid}`);
  chart = new google.visualization.LineChart(document.getElementById('chart-div'));
  chartJitter = new google.visualization.LineChart(document.getElementById('chart-div-jitter'));
  chartFPS = new google.visualization.LineChart(document.getElementById('chart-div-fps'));
  initStats();
}

async function leave() {
  destructStats();
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }
  remoteUsers = {};
  if (dual) {
    await client.disableDualStream();
  };
  await client.leave();
  await client2.leave();
  chart.clearChart();
  chartJitter.clearChart();
  chartFPS.clearChart();
  chartArray.length = 0;
  chartArrayJitter.length = 0;
  chartArrayFPS.length = 0;
  loopback = false;
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#mute").text("Mute Mic Track");
  $("#mute").attr("disabled", true);
  $("#dual").attr("disabled", false);
  $("#dual").text("Enable Dual Stream");
  $("#dualSwitch").attr("disabled", true);
  $("#showSettings").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  console.log("client leaves channel success");
}

async function changeDual() {
  if (dual) {
    dual = false;
    $("#dual").text("Enable Dual Stream");
  } else {
    dual = true;
    $("#dual").text("Disable Dual Stream");
    client.setLowStreamParameter({bitrate: 250, framerate: 15, height: 240, width: 320});
  }
}

async function changeRemoteStream() {
  if (lowStream) {
    lowStream = false;
    client2.setRemoteVideoStreamType(Number(options.uid), 0);
  } else {
    lowStream = true;
    client2.setRemoteVideoStreamType(Number(options.uid), 1);
  }
}

async function muteAudio() {
  if (!localTracks.audioTrack) return;
  await localTracks.audioTrack.setMuted(true);
  localTrackState.audioTrackMuted = true;
  $("#mute").text("Unmute Mic Track");
  showPopup("Mic Track Muted");
}

async function unmuteAudio() {
  if (!localTracks.audioTrack) return;
  if (!localTrackState.audioTrackPublished) {
    await client.publish(localTracks.audioTrack);
    console.log("publish mic success");
    localTrackState.audioTrackPublished = true;
  }
  await localTracks.audioTrack.setMuted(false);
  localTrackState.audioTrackMuted = false;
  $("#mute").text("Mute Mic Track");
  showPopup("Mic Track Unmuted");
}

async function subscribe2(user, mediaType) {
  const uid = user.uid;
  await client2.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-player").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
    user.audioTrack.setVolume(0);
  }
}

function handleUserPublished2(user, mediaType) {
  if (user.uid = options.uid) {
      const id = user.uid;
      remoteUsers[id] = user;
      subscribe2(user, mediaType);
      loopback = true;
  } else {
    console.log('some other user ignoring');
  }
}

function handleUserUnpublished2(user, mediaType) {
  if (user.uid = options.uid) {
    if (mediaType === 'video') {
      const id = user.uid;
      delete remoteUsers[id];
      $(`#player-wrapper-${id}`).remove();
      loopback = false;
    }
  } else {
    console.log('some other user ignoring');
  }
}

function reportStreamTypeChanged(uid, streamType) {
    console.log(`Receive Stream for remote UID ${uid} changed to ${streamType}`);
}

function reportAutoFallback(proxyServer) {
  console.log(`AutoFallback proxy being used detected, server is: ${proxyServer}`);
}

function reportProxyUsed(isProxyUsed) {
  let ms = Date.now();
  console.log(`${ms} - is-cloud-proxy-used reports: ${isProxyUsed}`);
  showPopup(`is-cloud-proxy-used reports: ${isProxyUsed}`);
}

function handleNetworkQuality(stats) {
  localNetQuality.uplink = stats.uplinkNetworkQuality;
  localNetQuality.downlink = stats.downlinkNetworkQuality;
}

function handleNetworkQuality2(stats) {
  local2NetQuality.uplink = stats.uplinkNetworkQuality;
  local2NetQuality.downlink = stats.downlinkNetworkQuality;
}

function handleConnectionState(cur, prev, reason) {
  if (cur == "DISCONNECTED") {
    console.log(`Sender: connection-state-changed: Current: ${cur}, Previous: ${prev}, Reason: ${reason}`);
    showPopup(`Sender: Connection State: ${cur}, Reason: ${reason}`)
    if (reason == "FALLBACK") {
      console.log(`Sender: Autofallback TCP Proxy being attempted.`);
      showPopup(`Sender: Autofallback TCP Proxy Attempted`);
    }
  } else if (cur == "CONNECTED") {
    console.log(`Sender: connection-state-changed: Current: ${cur}, Previous: ${prev}`);
    showPopup(`Sender: Connection State: ${cur}`);
    connectionState.isJoined = true;
    client._p2pChannel.connection.onICEConnectionStateChange = () => {
      console.log(`Sender: ice state changed: ${client._p2pChannel.connection.iceConnectionState}`);
      showPopup(`Sender: ICE State: ${client._p2pChannel.connection.iceConnectionState}`);
    };
  } else {
    console.log(`Sender: connection-state-changed: Current: ${cur}, Previous: ${prev}`);
    showPopup(`Sender: Connection State: ${cur}`);
    connectionState.isJoined = false;
  }
  }

  function handleConnectionState2(cur, prev, reason) {
    if (cur == "DISCONNECTED") {
      console.log(`Receiver: connection-state-changed: Current: ${cur}, Previous: ${prev}, Reason: ${reason}`);
      showPopup(`Receiver: Connection State: ${cur}, Reason: ${reason}`)
      if (reason == "FALLBACK") {
        console.log(`Receiver: Autofallback TCP Proxy being attempted.`);
        showPopup(`Receiver: Autofallback TCP Proxy Attempted`);
      }
    } else if (cur == "CONNECTED") {
      console.log(`Receiver: connection-state-changed: Current: ${cur}, Previous: ${prev}`);
      showPopup(`Receiver: Connection State: ${cur}`);
      connectionState.isJoined = true;
      client2._p2pChannel.connection.onICEConnectionStateChange = () => {
        console.log(`Receiver: ice state changed: ${client2._p2pChannel.connection.iceConnectionState}`);
        showPopup(`Receiver: ICE State: ${client2._p2pChannel.connection.iceConnectionState}`);
      };
    } else {
      console.log(`Receiver: connection-state-changed: Current: ${cur}, Previous: ${prev}`);
      showPopup(`Receiver: Connection State: ${cur}`);
      connectionState.isJoined = false;
    }
    }

//proxy functions
async function changeModes(label) {
  mode = modes.find(profile => profile.label === label);
  $(".proxy-input").val(`${mode.detail}`);
  if (connectionState.isJoined) {
    await leave();
    await join();
    $("#join").attr("disabled", true);
    $("#leave").attr("disabled", false);
  }
}

function initModes() {
  modes.forEach(profile => {
    $(".proxy-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  mode = modes[0];
  $(".proxy-input").val(`${mode.detail}`);
}

//areas
function initAreas() {
  areas.forEach(area => {
    $(".area-list").append(`<a class="dropdown-item" label="${area.label}" href="#">${area.label}</a>`);
  });
  area = areas[4];
  $(".area-input").val(`${area.detail}`);
}

async function changeArea(label) {
  area = areas.find(areas => areas.label === label);
  $(".area-input").val(`${area.detail}`);
  if (connectionState.isJoined) {
    showPopup("Already joined so no effect until next join!");
  }
}

//video encoder functions

async function changeProfiles(label) {
  curVideoProfile = videoProfiles.find(profile => profile.label === label);
  $(".profile-input").val(`${curVideoProfile.detail}`);
  if (connectionState.isJoined) {
    localTracks.videoTrack.setEncoderConfiguration(curVideoProfile.value);
  }
}

function initProfiles() {
  videoProfiles.forEach(profile => {
    $(".profile-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  curVideoProfile = videoProfiles[5];
  $(".profile-input").val(`${curVideoProfile.detail}`);
}

//device functions
async function initCams() {
  cams = await AgoraRTC.getCameras();
  curCam = cams[0];
  $(".cam-input").val(curCam.label);
  $(".cam-list").empty();
  cams.forEach(cam => {
    $(".cam-list").append(`<a class="dropdown-item" href="#">${cam.label}</a>`);
  });
}

async function switchCamera(label) {
  curCam = cams.find(cam => cam.label === label);
  $(".cam-input").val(curCam.label);
  if (connectionState.isJoined) {
    await localTracks.videoTrack.setDevice(curCam.deviceId);
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
  setTimeout(function(){ $(`#popup-${newPopup}`).remove(); popups--;}, 5000);
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

async function drawCurveTypesJitter(array) {
  var data = new google.visualization.DataTable();
  data.addColumn('number', 'X');
  data.addColumn('number', 'Send');
  data.addColumn('number', 'Receive');

  data.addRows(array);

  var options = {
    hAxis: {
      title: 'Time (sec)'
    },
    vAxis: {
      title: 'Jitter'
    },
    //series: {
    //  1: {curveType: 'function'}
    //}
  };

  chartJitter.draw(data, options);
};

async function drawCurveTypesFPS(array) {
  var data = new google.visualization.DataTable();
  data.addColumn('number', 'X');
  data.addColumn('number', 'Send');
  data.addColumn('number', 'Render');

  data.addRows(array);

  var options = {
    hAxis: {
      title: 'Time (sec)'
    },
    vAxis: {
      title: 'FPS'
    },
    //series: {
    //  1: {curveType: 'function'}
    //}
  };

  chartFPS.draw(data, options);
};

function initStats() {
  statsInterval = setInterval(flushStats, 1000);
}

function destructStats() {
  clearInterval(statsInterval);
  $("#client-stats").html("");
  $("#local-stats").html("");
  $("#remote-player").html("");
  //not a good way to do this it's hack but works
  const rStats = $(`
    <div id="remote-stats" class="stream-stats stats"></div>
  `);
  $("#remote-player").append(rStats);
}

function flushStats() {
  // get the client stats message
  const clientStats = client.getRTCStats();
  const clientStats2 = client2.getRTCStats();
  const status = navigator.onLine;
  const clientStatsList = [
  {
    description: "Local UID",
    value: options.uid,
    unit: ""
  }, {
    description: "Channel",
    value: options.channel,
    unit: ""
  }, {
    description: "Joined Duration",
    value: clientStats.Duration,
    unit: "s"
  }, {
    description: "Bitrate recv",
    value: (Number(clientStats2.RecvBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
  }, {
    description: "Bitrate sent",
    value: (Number(clientStats.SendBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
  }, {
    description: "BWE",
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
    value: local2NetQuality.downlink,
    unit: ""
  }, {
    description: "Link Status",
    value: status,
    unit: ""
  }];
  $("#client-stats").html(`
    ${clientStatsList
        .map(
            (stat) =>
                `<div class="stat-item">${stat.description}: ${stat.value} ${stat.unit}</div>`,
        )
        .join("")}
`);

  console.log(`pushing bitrate values ${clientStats.Duration}, ${clientStats.SendBitrate}, ${clientStats2.RecvBitrate}`);
  chartArray.push([clientStats.Duration, clientStats.SendBitrate, clientStats2.RecvBitrate]);
  drawCurveTypes(chartArray);
  
  const localStats = {
    video: client.getLocalVideoStats()
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
    value: (Number(localStats.video.sendBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
    }, {
    description: "Send Jitter",
    value: (Number(localStats.video.sendJitterMs)),
    unit: "ms"
    }, {
    description: "Send RTT",
    value: (Number(localStats.video.sendRttMs)),
    unit: "ms"
    }, {
    description: "Video packet loss rate",
    value: Number(localStats.video.currentPacketLossRate).toFixed(3),
    unit: "%"
  }];
  $("#local-stats").html(`
    ${localStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
  `);

  const remoteTracksStats = {
    video: client2.getRemoteVideoStats()[options.uid]
  };
  const remoteTracksStatsList = [
  {
    description: "Receive FPS",
    value: remoteTracksStats.video.receiveFrameRate,
    unit: ""
  }, {
    description: "Decode FPS",
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
    description: "Recv video bitrate",
    value: (Number(remoteTracksStats.video.receiveBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
  }, {
    description: "Video receive delay",
    value: Number(remoteTracksStats.video.receiveDelay).toFixed(0),
    unit: "ms"
  }, {
    description: "Video packets lost",
    value: remoteTracksStats.video.receivePacketsLost,
    unit: ""
  }, {
    description: "E2E Delay",
    value: remoteTracksStats.video.end2EndDelay,
    unit: ""
  }, {
    description: "Transport Delay",
    value: remoteTracksStats.video.transportDelay,
    unit: ""
  },{
    description: "Freeze Rate",
    value: Number(remoteTracksStats.video.freezeRate).toFixed(3),
    unit: "%"
  }, {
    description: "Total video freeze time",
    value: remoteTracksStats.video.totalFreezeTime,
    unit: "s"
  }];
  $(`#remote-stats`).html(`
    ${remoteTracksStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
  `);
  console.log(`pushing fps values ${clientStats.Duration}, ${localStats.video.sendFrameRate}, ${remoteTracksStats.video.renderFrameRate}`);
  chartArrayFPS.push([clientStats.Duration, localStats.video.sendFrameRate, remoteTracksStats.video.renderFrameRate]);
  drawCurveTypesFPS(chartArrayFPS);
  console.log(`pushing jitter values ${clientStats.Duration}, ${localStats.video.sendJitterMs}, ${remoteTracksStats.video.receiveDelay}`);
  chartArrayJitter.push([clientStats.Duration, localStats.video.sendJitterMs, remoteTracksStats.video.receiveDelay]);
  drawCurveTypesJitter(chartArrayJitter);
}

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  return result;
}