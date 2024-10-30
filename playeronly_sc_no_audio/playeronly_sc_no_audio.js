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
var remoteUID = 0;
var aspect = 1.7;

// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null,
  sc: "true"
};

//AgoraRTC.onAutoplayFailed = () => {
//  alert("click to start autoplay!");
//};


let statsInterval;

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.uid = urlParams.get("uid");
  options.sc = urlParams.get("sc");
  if (options.token != null) {
    options.token = options.token.replace(/ /g,'+');
    }
  if (options.sc == null) {
      options.sc = "true";
    }
  joinChannel();
});

async function joinChannel() {
  await AgoraRTC.setParameter("ENABLE_INSTANT_VIDEO", true);
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
  options.uid = await client.join(options.appid, options.channel, options.token || null, Number(options.uid) || null );

  initStats();
}

//$("#local-player").css("border", "7px solid yellowgreen");
//$("#local-player").css("border-radius", "10px");

async function subscribe(user, mediaType) {
  const uid = user.uid;
  if (mediaType === 'video') {
    context.track = await client.subscribe(user, mediaType);
    const player = $(`
      <div id="player-wrapper-${uid}">
        <div class="player-with-stats">
          <div id="player" class="remotePlayerLargeL"></div>
          <div class="track-stats remoteStats"></div>
        </div>
      </div>
  `);
  $("#remote-playerlist-row1").append(player);
    user.videoTrack.play(`player`);
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
      if (options.sc == "true") {
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
        await context.processor.enable();
        context.track.play(`player`,  {
          fit: "contain"
        });
      } else {
        user.videoTrack.play(`player`,  {
          fit: "contain"
        });
      }
      remoteJoined = true;
      remoteUID = id;
    }
  } 
}

async function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    const id = user.uid;
    delete remoteUsers[id];
    if (options.sc == "true") {
      context.processor.unpipe();
      context.track.unpipe();
      await context.processor.release();
      context.processor = undefined;
      context.track.stop();
      context.track = undefined;
    }
    //user.videoTrack.stop(`player-${id}`)
    $(`#player-wrapper-${id}`).remove();
    remoteJoined = false;
    remoteUID = 0;
  }
}

function initStats() {
  statsInterval = setInterval(flushStats, 1000);
}

function flushStats() {

//get and adjust resolution
if (remoteUID != 0) {
  const stream = remoteUsers[remoteUID].videoTrack.getMediaStreamTrackSettings();
  aspect = stream.aspectRatio;
  if (aspect > 1) {
    var x = document.getElementById(`player`);
    x.className = "remotePlayerLargeL";
  } else {
    var x = document.getElementById(`player`);
    x.className = "remotePlayerLargeP";
  }
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
  }, {
    description: "Aspect Ratio",
    value: Number(aspect),
    unit: ""
  }];
  $(`#player-wrapper-${uid} .track-stats`).html(`
    ${remoteTracksStatsList.map(stat => `<p class="stats-row">${stat.description}: ${stat.value} ${stat.unit}</p>`).join("")}
  `);
});
}


