/*
 *  These procedures use Agora Video Call SDK for Web to enable local and remote
 *  users to join and leave a Video Call channel managed by Agora Platform.
 */

/*
 *  Create an {@link https://docs.agora.io/en/Video/API%20Reference/web_ng/interfaces/iagorartcclient.html|AgoraRTCClient} instance.
 *
 * @param {string} mode - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/clientconfig.html#mode| streaming algorithm} used by Agora SDK.
 * @param  {string} codec - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/clientconfig.html#codec| client codec} used by the browser.
 */
var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp8"
});

var videoContainerSizes = {
  "sm": {
    height: 320,
    width: 480
  },
  "lg": {
    height: 480,
    width: 720
  }
};

/*
 * Clear the video and audio tracks used by `client` on initiation.
 */
var localTracks = {
  videoTrack: null,
  audioTrack: null
};

/*
 * On initiation no users are connected.
 */
var remoteUsers = {};

/*
 * On initiation. `client` is not attached to any project or channel for any specific user.
 */
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

/*
 * When this page is called with parameters in the URL, this procedure
 * attempts to join a Video Call channel using those parameters.
 */
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
  initializeCanvasCustomVideoTrack();
});

/*
 * When a user clicks Join or Leave in the HTML form, this procedure gathers the information
 * entered in the form and calls join asynchronously. The UI is updated to match the options entered
 * by the user.
 */
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
  }
});

/*
 * Called when a user clicks Leave in order to exit a channel.
 */
$("#leave").click(function (e) {
  leave();
});

$("#resizelocal").click(() => handleVideoContainerResizeLocal())

/*
 * Join a channel, then create local video and audio tracks and publish them to the channel.
 */
async function join() {
  // Add an event listener to play remote tracks when remote user publishes.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // Join the channel.
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);

  // Create video track to custom canvas element.
  localTracks.videoTrack = await getCanvasCustomVideoTrack();
  localTracks.videoTrack.play("local-player");

  // Publish the local video and audio tracks to the channel.
  await client.publish(localTracks.videoTrack);
  console.log("publish success");
}

//initialize canvas elements
function initializeCanvasCustomVideoTrack() {
  const canvasElement = document.querySelector("#customCanvasElement");
  const ctx = canvasElement.getContext('2d');
  canvasElement.height = canvasElement.clientHeight;
  canvasElement.width = canvasElement.clientWidth;
  setInterval(() => {
    ctx.clearRect(0, 0, canvasElement.clientWidth, canvasElement.clientHeight);
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(10, 10, 130, 130);
    var path = new Path2D();
    path.arc(75, 75, 50, 0, Math.PI * 2, true);
    path.moveTo(110, 75);
    path.arc(75, 75, 35, 0, Math.PI, false);
    path.moveTo(65, 65);
    path.arc(60, 65, 5, 0, Math.PI * 2, true);
    path.moveTo(95, 65);
    path.arc(90, 65, 5, 0, Math.PI * 2, true);
    ctx.strokeStyle = '#0000ff';
    ctx.stroke(path);
  }, 17);
}

//get video track from canvas elements
function getCanvasCustomVideoTrack() {
  const canvasElement = document.querySelector("#customCanvasElement");
  const stream = canvasElement.captureStream(30);
  const [videoTrack] = stream.getVideoTracks();
  return AgoraRTC.createCustomVideoTrack({
    mediaStreamTrack: videoTrack
  });
}

/*
 * Stop all local and remote tracks then leave the channel.
 */
async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // Remove remote users and player views.
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
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
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

/*
 * Remove the user specified from the channel in the local interface.
 *
 * @param  {string} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to remove.
 */
function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
  }
}

function handleVideoContainerResizeLocal() {
  const videoContainer = $(`#local-player`);
  const sizeVariant = videoContainer.attr('data-size-variant');

  if (sizeVariant === "sm") {
      const sizes = videoContainerSizes["lg"];

      videoContainer.css('width', sizes.width);
      videoContainer.css('height', sizes.height);
      videoContainer.attr('data-size-variant', 'lg');
  } else {
      const sizes = videoContainerSizes["sm"];

      videoContainer.css('width', sizes.width);
      videoContainer.css('height', sizes.height);
      videoContainer.attr('data-size-variant', 'sm');
  }
}