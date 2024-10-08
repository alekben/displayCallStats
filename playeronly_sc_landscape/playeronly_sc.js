var audioTrackPresent = false;
var remoteUID = 0;

const extension = new SuperClarityExtension();
AgoraRTC.registerExtensions([extension]);

const context = {
  uid: undefined,
  //client: undefined,
  track: undefined,
  processor: undefined,
};

// create Agora client
var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});


var joined = false;
var remoteJoined = false;
var remoteUsers = {};
var remotePlayed = false;


// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
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
  options.token = urlParams.get("token");
  options.uid = urlParams.get("uid");
  if (options.token != null) {
    options.token = options.token.replace(/ /g,'+');
    }
  joinChannel();
});

async function joinChannel() {
  try {
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "rtc",
        codec: "vp8"
      });
    }
    await join();
  } catch (error) {
    console.error(error);
  } finally {
    joined = true;
  }
};

async function join() {
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null );

  initStats();
}

async function handleTrackUpdated(track) {
  console.log(`track-updated fired for ${track.id}`);
}

function handleVideoStateChanged(vState) {
  console.log(`video-state-changed fired ${vState}`);
  if (vState == 1) {
    console.log(`v state 1`);
  } else if (vState == 2) {
    if (!remotePlayed) {
        console.log(`v state 2 setting remoteplayed true`);
        remotePlayed = true;
      } else {
        console.log(`v state 2 after playing, unblurring`);
        $(`#player-${remoteUID}`).css("filter", "");
        $(`#blurText`).text("");
      }
  } else if (vState == 3) {
    console.log(`v state 3 blurring`);
    $(`#player-${remoteUID}`).css("filter", "blur(10px)")
    $(`#blurText`).text("BLURRING ACTIVATED");
  }
}

async function handleFirstFrameDecoded() {
  console.log(`first-frame-decoded`);
}


async function subscribe(user, mediaType) {
  const uid = user.uid;
  remoteUID = uid;
  if (mediaType === 'video') {
    context.track = await client.subscribe(user, mediaType);
    const player = $(`
      <div id="player-wrapper-${uid}">
        <div class="player-with-stats">
          <div id="player-${uid}" class="remotePlayerLarge"></div>
          <div class="track-stats remoteStats"></div>
          <div class="blurActive" id="blurText"></div>
        </div>
      </div>
  `);
  $("#remote-playerlist-row1").append(player);
  // add track listeners for video
    user.videoTrack.on("track-updated", handleTrackUpdated);
    user.videoTrack.on("video-state-changed", handleVideoStateChanged);
    user.videoTrack.on("first-frame-decoded", handleFirstFrameDecoded);
    //user.videoTrack.play(`player-${uid}`);
  } else {
    await client.subscribe(user, mediaType);
    audioTrackPresent = true;
    //user.audioTrack.play();
  }
}


async function handleUserPublished(user, mediaType) {
  const id = user.uid;
  if (mediaType === 'video') {
    if (remoteJoined) {
      console.log("Remote user already here.");
    } else {
      remoteUsers[id] = user;
      context.uid = user.uid;
      await subscribe(user, mediaType);
      context.processor = extension.createProcessor();
      context.processor.on("first-video-frame", (stats) => {
      console.log("plugin have first video frame, stats:", stats);
    });
      context.processor.on("error", (msg) => {
      console.log("plugin error:", msg);
    });
      //context.processor.on("stats", (stats) => {
      //console.log("plugin stats:", Date.now(), stats);
    //});
      context.track.pipe(context.processor).pipe(context.track.processorDestination);
      await context.processor.enable();
      context.track.play(`player-${id}`);
      //subscribe(user, mediaType);
      remoteJoined = true;
    }
  } else {
    remoteUsers[id] = user;
    subscribe(user, mediaType);
  }
}

async function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    const id = user.uid;
    delete remoteUsers[id];
    context.processor.unpipe();
    context.track.unpipe();
    await context.processor.release();
    context.processor = undefined;
    context.track.stop();
    //user.videoTrack.stop(`player-${id}`)
    context.track = undefined;
    $(`#player-wrapper-${id}`).remove();
    remoteJoined = false;
    remotePlayed = false;
  } else {
    audioTrackPresent = false;
  }
}

function initStats() {
  statsInterval = setInterval(flushStats, 1000);
}

function flushStats() {


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


