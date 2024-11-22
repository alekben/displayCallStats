var popups = 0;

google.charts.load('current', {packages: ['corechart', 'line']});
var chart;
var chartArray = [];

let statsInterval;

AgoraRTC.enableLogUpload();
AgoraRTC.setParameter("ENABLE_SVC",true);
//AgoraRTC.setArea("NORTH_AMERICA");
//AgoraRTC.setArea("EUROPE");
//AgoraRTC.setParameter("ENABLE_INSTANT_VIDEO", true);

var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp9"
});

var client2 = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp9"
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
  token: null
};

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

$(() => {
  initModes();
  $(".proxy-list").delegate("a", "click", function (e) {
    changeModes(this.getAttribute("label"));
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
});

$("#mute").click(function (e) {
  if (!localTrackState.audioTrackMuted) {
    muteAudio();
  } else {
    unmuteAudio();
  }
});

async function join() {
  //client.on("user-published", handleUserPublished);
  //client.on("user-unpublished", handleUserUnpublished);
  client.on("is-using-cloud-proxy", reportProxyUsed);
  client.on("join-fallback-to-proxy", reportAutoFallback);
  client.on("stream-type-changed", reportStreamTypeChanged)
  client.on("connection-state-change", handleConnectionState);
  client.on("network-quality", handleNetworkQuality);
  client2.on("user-published", handleUserPublished2);
  client2.on("user-unpublished", handleUserUnpublished2);
  client2.on("network-quality", handleNetworkQuality2);
  client2.on("connection-state-change", handleConnectionState2);
  
  const value = Number(mode.value);
  if ([3, 5].includes(value)) {
    client.startProxyServer(value);
    client2.startProxyServer(value);
  }
  if (value === 0) {
    client.stopProxyServer();
    client2.stopProxyServer();
  }

  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  options.uid2 = await client2.join(options.appid, options.channel, options.token || null, null);

  if (!localTracks.videoTrack) {
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
  }

  await localTracks.videoTrack.setEncoderConfiguration("720p_2");
  localTracks.videoTrack.play("local-player");
  $("#joined-setup").css("display", "flex");

  await client.publish(localTracks.videoTrack);
  console.log("publish cam success");

  showPopup(`Joined to channel ${options.channel} with UID ${options.uid}`);
  chart = new google.visualization.LineChart(document.getElementById('chart-div'));
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
  await client.leave();
  await client2.leave();
  
  chart.clearChart();
  chartArray.length = 0;
  loopback = false;
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#mute").text("Mute Mic Track");
  $("#mute").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  console.log("client leaves channel success");
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
    description: "Host Count",
    value: clientStats.UserCount,
    unit: ""
  }, {
    description: "Joined Duration",
    value: clientStats.Duration,
    unit: "s"
  }, {
    description: "Bitrate receive",
    value: (Number(clientStats2.RecvBitrate) * 0.000001).toFixed(4),
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
    value: local2NetQuality.downlink,
    unit: ""
  }, {
    description: "Link Status",
    value: status,
    unit: ""
  }];
  $("#client-stats").html(`
    ${clientStatsList.map(stat => `<class="stats-row">${stat.description}: ${stat.value} ${stat.unit}<br>`).join("")}
  `);
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