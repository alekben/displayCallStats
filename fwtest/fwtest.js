

// create Agora client
var client = AgoraRTC.createClient({
  mode: "live",
  codec: "vp8"
});


var joined = false;
var remoteJoined = false;
var remoteUsers = {};


// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null
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
    //client.setClientRole("audience");
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
  options.uid = await client.join(options.appid, options.channel, null, null);

  initStats();
}


async function subscribe(user, mediaType) {
  const uid = user.uid;
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <div class="player-with-stats">
          <div id="player-${uid}" class="remotePlayerLarge"></div>
          <div class="track-stats remoteStats"></div>
        </div>
      </div>
  `);
  $("#remote-playerlist-row1").append(player);
    user.videoTrack.play(`player-${uid}`);
  } else {
    user.audioTrack.play();
  }
}


function handleUserPublished(user, mediaType) {
  const id = user.uid;
  if (mediaType === 'video') {
    if (remoteJoined) {
      console.log("Remote user already here.");
    } else {
      remoteUsers[id] = user;
      subscribe(user, mediaType);
      remoteJoined = true;
    }
  } else {
    remoteUsers[id] = user;
    subscribe(user, mediaType);
  }
}

function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
    remoteJoined = false;
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


