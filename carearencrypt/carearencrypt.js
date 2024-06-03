// create Agora client
var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});

var audioContext;

var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};


// the demo can auto join channel with params in url
$(() => {
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
    $("#setEnabled").attr("disabled", false);
  }
});
$("#setEnabled").click(async function (e) {
  switchSetEnabled();
});
$("#leave").click(async function (e) {
  leave();
});

async function switchSetEnabled() {
  await localTracks.audioTrack.setEnabled(!options.audioEnabled);
  options.audioEnabled = !options.audioEnabled;
}

async function join() {

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  AgoraRTC.setArea({
    areaCode: "GLOBAL",
    excludedArea: "CHINA"
  });
  AgoraRTC.setParameter("MEDIA_DEVICE_CONSTRAINTS", { audio: { googHighpassFilter: { exact: true } } });

  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [options.uid, localTracks.videoTrack, localTracks.audioTrack] = await Promise.all([
  // join the channel
  client.join(options.appid, options.channel, options.token || null, options.uid || null),
  // create local tracks, using microphone and camera
  AgoraRTC.createCameraVideoTrack(),
  AgoraRTC.createMicrophoneAudioTrack({ "AEC": true, "ANS": true, "AGC": true })]);

  // play local video track
  localTracks.audioTrack.setVolume(0);
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);

  try {
    await client.unpublish()
  } catch (error) {
    console.error(error)
  }

  try {
    await client.publish(Object.values(localTracks));
  } catch (error) {
    console.error(error)
  }

  await localTracks.videoTrack.setEnabled(false)


  console.log("publish success");
}

async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = null;
    }
  }
  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#setEnabled").attr("disabled", true);
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
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
    const audioNode = audioContext.createMediaStreamSource(new MediaStream([user.audioTrack.getMediaStreamTrack()]));
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1;
    audioNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
  }
}
function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}
function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
  }
}

// calculate the MM:SS format from millisecond
function toMMSS(second) {
  // const second = millisecond / 1000;
  let MM = parseInt(second / 60);
  let SS = parseInt(second % 60);
  MM = MM < 10 ? "0" + MM : MM;
  SS = SS < 10 ? "0" + SS : SS;
  return `${MM}:${SS}`;
}