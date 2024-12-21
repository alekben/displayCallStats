var popups = 0;
let settingsHide = true;

google.charts.load('current', {packages: ['corechart', 'line']});
var chart;
var chartArray = [];

var chartJitter;
var chartArrayJitter = [];

var chartFPS;
var chartArrayFPS = [];

var chartBWE;
var chartArrayBWE = [];


let statsInterval;

AgoraRTC.enableLogUpload();
AgoraRTC.setParameter("ENABLE_INSTANT_VIDEO", true);

var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp9"
});

var client2 = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});

var localTracks = {
  screenTrack: null
};

var connectionState = {
  isJoined: null,
  mediaReceived: null,
  isProxy: null,
  isTURN: null,
  sc: false,
  optMode: "detail"
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

//random
let leftOnce = false;
var timeStart = 0;
var timeTaken = 0;
var bigAlready = false;
var player2;


//dual
let dual = true;
let lowStream = false;

//superclarity
const extension = new SuperClarityExtension();
AgoraRTC.registerExtensions([extension]);

const context = {
  uid: undefined,
  track: undefined,
  processor: undefined,
};

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
  label: "720p",
  detail: "1280×720, 5fps",
  value: "720p"
}, {
  label: "720p_1",
  detail: "1280×720, 5fps",
  value: "720p_1"
}, {
  label: "720p_3",
  detail: "1280×720, 15fps",
  value: "720p_3"
}, {
  label: "720p_2",
  detail: "1280×720, 30fps",
  value: "720p_2"
}, {
  label: "1080p",
  detail: "1920×1080, 5fps",
  value: "1080p"
}, {
  label: "1080p_1",
  detail: "1920×1080, 5fps",
  value: "1080p_1"
}, {
  label: "1080p_3",
  detail: "1920×1080, 15fps",
  value: "1080p_3"
}, {
  label: "1080p_2",
  detail: "1920×1080, 30fps",
  value: "1080p_2"
}, {
  label: "Custom",
  detail: "1920x1080, 10fps, 1Mbps",
  value: {
    width: 1920,
    height: 1080,
    frameRate: 10,
    bitrateMax: 1000,
    bitrateMin: 100
  }
}];
var curVideoProfile;

$(() => {
  initModes();
  initAreas();
  initProfiles();
  $(".proxy-list").delegate("a", "click", function (e) {
    changeModes(this.getAttribute("label"));
  });
  $(".area-list").delegate("a", "click", function (e) {
    changeArea(this.getAttribute("label"));
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
    $("#local-player").css("display", "inline-block");
    $("#remote-player").css("display", "inline-block");
    await join();
    if (options.token) {
      $("#success-alert-with-token").css("display", "block");
    } else {
      $("#success-alert a").attr("href", `https://unique-salamander-6d2c93.netlify.app/playeronly_sc_no_audio/index.html?appid=${options.appid}&channel=${options.channel}`);
      $("#success-alert").css("display", "block");
    }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
    $("#channelSettings").css("display", "none");
    $("#dual").attr("disabled", false);
    $("#showSettings").attr("disabled", false);
    $("#sc").attr("disabled", false);
    $("#settings").css("display", "none");
  }
});

$("#leave").click(function (e) {
  leave();
  $("#channelSettings").css("display", "");
  $("#settings").css("display", "");
  $("#sc").attr("disabled", true);
  settingsHide = true;
  bigAlready = false;
  $("#local-player").css("display", "none");
  $("#remote-player").css("display", "none");
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

$("#dual").click(function (e) {
  changeDual();
});

$("#dualSwitch").click(function (e) {
  changeRemoteStream();
});

$("#sc").click(function (e) {
  toggleSC();
});

$("#opt").click(function (e) {
  toggleOpt();
});

async function join() {
  client.on("is-using-cloud-proxy", reportProxyUsed);
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

  client.setLowStreamParameter({bitrate: 500, framerate: 10, height: 720, width: 1280});
  //optimizationMode starts detail
  localTracks.screenTrack = await AgoraRTC.createScreenVideoTrack({encoderConfig: curVideoProfile.value, displaySurface: "monitor", optimizationMode: connectionState.optMode, selfBrowserSurface: "exclude", systemAudio: "exclude"}, "disabled");

  if (dual) {
    client.enableDualStream();
    $("#dualSwitch").attr("disabled", false);
  }

  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  options.uid2 = await client2.join(options.appid, options.channel, options.token || null, null);

  localTracks.screenTrack.play("local-player");
  document.getElementById('local-player').addEventListener('click', function() {
    toggleClass('local-player', 'local', 'playerSm', 'playerLg');
  });


  $("#joined-setup").css("display", "flex");
  await client.publish(localTracks.screenTrack);
  console.log("publish cam success");
  showPopup(`Joined to channel ${options.channel} with UID ${options.uid}`);
  if (leftOnce == true) {
    destructStats();
    chart.clearChart();
    chartJitter.clearChart();
    chartFPS.clearChart();
    chartBWE.clearChart();
    chartArray.length = 0;
    chartArrayJitter.length = 0;
    chartArrayFPS.length = 0;
    chartArrayBWE.length = 0;
  }
  chart = new google.visualization.LineChart(document.getElementById('chart-div'));
  chartJitter = new google.visualization.LineChart(document.getElementById('chart-div-jitter'));
  chartFPS = new google.visualization.LineChart(document.getElementById('chart-div-fps'));
  chartBWE = new google.visualization.LineChart(document.getElementById('chart-div-bwe'));
  initStats();
}

async function leave() {
  leftOnce = true;
  clearInterval(statsInterval);
  //destructStats();
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
  connectionState.isJoined = false;
  connectionState.mediaReceived = false;
  connectionState.isProxy = false;
  connectionState.isTURN = false;
  //chart.clearChart();
  //chartJitter.clearChart();
  //chartFPS.clearChart();
  //chartBWE.clearChart();
  //chartArray.length = 0;
  //chartArrayJitter.length = 0;
  //chartArrayFPS.length = 0;
  //chartArrayBWE.length = 0;
  loopback = false;
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#dual").attr("disabled", false);
  //$("#dual").text("Enable Dual Stream");
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
    client.setLowStreamParameter({bitrate: 500, framerate: 10, height: 720, width: 1280});
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

async function toggleSC() {
  if (connectionState.sc == false) {
    context.processor.enable();
    $("#sc").text("Disable SuperClarity");
    connectionState.sc = true;
  } else {
    context.processor.disable();
    $("#sc").text("Enable SuperClarity");
    connectionState.sc = false;
  }
}

async function toggleOpt() {
  if (connectionState.optMode == "detail") {
    if (localTracks.screenTrack) {
      localTracks.screenTrack.setOptimizationMode("motion");
    }
    connectionState.optMode = "motion";
    $("#opt").text("Maintatin FPS Set");
  } else {
    if (localTracks.screenTrack) {
      localTracks.screenTrack.setOptimizationMode("detail");
    }
    connectionState.optMode = "detail";
    $("#opt").text("Maintatin Resolution Set");
  }
}

async function subscribe2(user, mediaType) {
  const uid = user.uid;
  const d = new Date();
  timeStart = d.getTime();
  context.track = await client2.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    context.uid = uid;
    context.processor = extension.createProcessor();
    context.processor.on("first-video-frame", (stats) => {
      console.log("plugin have first video frame, stats:", stats);
    });
    context.processor.on("error", (msg) => {
      console.log("plugin error:", msg);
    });
    context.processor.on("stats", (stats) => {
      console.log("plugin stats:", Date.now(), stats);
    });
    context.track.pipe(context.processor).pipe(context.track.processorDestination);
    //await context.processor.enable();
    context.track.play('remote-player', {fit: "contain"});
    remoteUsers[uid]._videoTrack._player.videoElement.addEventListener("playing", function () {
      const d = new Date();
      const time2 = d.getTime();
      //console.log(`cloned track for ${uid} playing at ${time2}`);
      timeTaken = time2 - timeStart;
      //console.log(`cloned track for ${uid} took ${timeTaken} to render`);
      showPopup(`Render of Remote Stream took ${timeTaken}`);
      $(`#agora-video-player-${player2}`).css("background-color", "black");
      //$(`#renderTime-${uid}-cloned`).text(`Time to render: ${timeTaken}ms`);
    });
    document.getElementById('remote-player').addEventListener('click', function() {
      toggleClass('remote-player', 'remote', 'playerSm', 'playerLg');
    });
    player2 = remoteUsers[uid]._videoTrack._player.trackId;
    $(`#agora-video-player-${player2}`).css("background-color", "red");
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
      context.processor.unpipe();
      context.track.unpipe();
      if (connectionState.sc == true) {
        context.processor.disable();
      };
      context.processor.release();
      context.processor = undefined;
      context.track.stop();
      context.track = undefined;
      delete remoteUsers[id];
      loopback = false;
    }
  } else {
    console.log('some other user ignoring');
  }
}

function reportStreamTypeChanged(uid, streamType) {
    console.log(`Receive Stream for remote UID ${uid} changed to ${streamType}`);
    showPopup(`Receive Stream for remote UID ${uid} changed to ${streamType}`);
}

function reportProxyUsed(isProxyUsed) {
  let ms = Date.now();
  console.log(`${ms} - is-cloud-proxy-used reports: ${isProxyUsed}`);
  showPopup(`is-cloud-proxy-used reports: ${isProxyUsed}`);
  connectionState.isProxy = true;
  connectionState.isTURN = true;
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
      if (client._p2pChannel.connection.iceConnectionState == "connected") {
        showPopup(`Sender: ICE State: ${client._p2pChannel.connection.iceConnectionState}`);
      }
    };
  } else {
    console.log(`Sender: connection-state-changed: Current: ${cur}, Previous: ${prev}`);
    //showPopup(`Sender: Connection State: ${cur}`);
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
        if (client2._p2pChannel.connection.iceConnectionState == "connected") {
          showPopup(`Receiver: ICE State: ${client2._p2pChannel.connection.iceConnectionState}`);
          connectionState.mediaReceived = true;
        }
      };
    } else {
      console.log(`Receiver: connection-state-changed: Current: ${cur}, Previous: ${prev}`);
      //showPopup(`Receiver: Connection State: ${cur}`);
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
    localTracks.screenTrack.setEncoderConfiguration(curVideoProfile.value);
  }
}

function initProfiles() {
  videoProfiles.forEach(profile => {
    $(".profile-list").append(`<a class="dropdown-item" label="${profile.label}" href="#">${profile.label}: ${profile.detail}</a>`);
  });
  curVideoProfile = videoProfiles[8];
  $(".profile-input").val(`${curVideoProfile.detail}`);
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
      title: 'Ms'
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

async function drawCurveTypesBWE(array) {
  var data = new google.visualization.DataTable();
  data.addColumn('number', 'X');
  data.addColumn('number', 'Available Tx');


  data.addRows(array);

  var options = {
    hAxis: {
      title: 'Time (sec)'
    },
    vAxis: {
      title: 'Mbits/s'
    },
    //series: {
    //  1: {curveType: 'function'}
    //}
  };

  chartBWE.draw(data, options);
};

function initStats() {
  statsInterval = setInterval(flushStats, 1000);
}

function destructStats() {
  //clearInterval(statsInterval);
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
    description: "Bitrate sent",
    value: (Number(clientStats.SendBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
  }, {
    description: "Bitrate recv",
    value: (Number(clientStats2.RecvBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
  }, {
    description: "BWE",
    value: Number((clientStats.OutgoingAvailableBandwidth) * 0.001).toFixed(4),
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

  //console.log(`pushing bitrate values ${clientStats.Duration}, ${clientStats.SendBitrate}, ${clientStats2.RecvBitrate}`);
  chartArray.push([clientStats.Duration, clientStats.SendBitrate, clientStats2.RecvBitrate]);
  drawCurveTypes(chartArray);
  
  const localStats = {
    video: client.getLocalVideoStats()
  };
  const localStatsList = [{
    description: "Type",
    value: "Local Track",
    unit: ""
    }, {
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
    }, {
    description: "Send video bitrate",
    value: (Number(localStats.video.sendBitrate) * 0.000001).toFixed(4),
    unit: "Mbps"
    }, {
    description: "Target video bitrate",
    value: (Number(localStats.video.targetSendBitrate) * 0.000001).toFixed(4),
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
    description: "Video packetloss rate",
    value: Number(localStats.video.currentPacketLossRate).toFixed(3),
    unit: "%"
  }];
  $("#local-stats").html(`
    ${localStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
  `);

  const remoteTracksStats = {
    video: client2.getRemoteVideoStats()[options.uid]
  };
  const remoteTracksStatsList = [{
    description: "Type",
    value: "Remote Track",
    unit: ""
  }, {
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
  }, {
    description: "Time Taken to Render",
    value: timeTaken,
    unit: "ms"
  }];
  $(`#remote-stats`).html(`
    ${remoteTracksStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
  `);
  //console.log(`pushing bwe value ${clientStats.Duration}, ${clientStatsList[5].value}`);
  chartArrayBWE.push([clientStats.Duration, (clientStats.OutgoingAvailableBandwidth * 0.001)]);
  drawCurveTypesBWE(chartArrayBWE);
  //console.log(`pushing jitter values ${clientStats.Duration}, ${localStats.video.sendJitterMs}, ${remoteTracksStats.video.receiveDelay}`);
  chartArrayJitter.push([clientStats.Duration, localStats.video.sendJitterMs, remoteTracksStats.video.receiveDelay]);
  drawCurveTypesJitter(chartArrayJitter);
  //console.log(`pushing fps values ${clientStats.Duration}, ${localStats.video.sendFrameRate}, ${remoteTracksStats.video.renderFrameRate}`);
  chartArrayFPS.push([clientStats.Duration, localStats.video.sendFrameRate, remoteTracksStats.video.renderFrameRate]);
  drawCurveTypesFPS(chartArrayFPS);

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

function toggleClass(elementId, type, classToRemove, classToAdd) {
  const element = document.getElementById(elementId);
  if (element) {
    if (bigAlready) {
      $(".playerLg").removeClass("playerLg").addClass("playerSm");
      $("#local-player").css("display", "inline-block");
      $("#remote-player").css("display", "inline-block");   
      bigAlready = false;
    } else {
      $(".playerLg").removeClass("playerLg").addClass("playerSm");
      if (type == "local") {
        $("#remote-player").css("display", "none");
      } else {
        $("#local-player").css("display", "none");
      }
      element.classList.remove(classToRemove);
      element.classList.add(classToAdd);
      bigAlready = true;
    }
  }
}