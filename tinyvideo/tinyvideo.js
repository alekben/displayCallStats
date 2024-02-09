AgoraRTC.setLogLevel(4);
var client = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp9"
});

AgoraRTC.onAutoplayFailed = () => {
  alert("click to start autoplay!");
};

var options = {
  appid: null,
  channel: null,
  uid: 0
};

var videoTrack;
var muted = false;
var remote_joined = false;


$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.uid = urlParams.get("uid");
  joinChannel();
});

$("#local").click(function (e) {
  if (muted) {
    videoTrack.setEnabled(true); 
    $("#local_video").css("display", "block"); 
    muted = false} 
    else 
    {videoTrack.setEnabled(false); 
    muted = true;
    $("#local_video").css("display", "none");}
});

async function joinChannel() {
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-left", handleUserLeft);
    videoTrack = await AgoraRTC.createCameraVideoTrack({encoderConfig: "720p_2"});
    options.uid = await client.join(options.appid, options.channel, null, options.uid);
    $("#local").css("display", "block");
    videoTrack.play("local_video");
    $("#local_id").text(`Local ID: ${options.uid}`);
    $("#local_id").css("display", "block");
    await client.publish(videoTrack);

};

async function handleUserPublished(user, mediaType) {
      await client.subscribe(user, mediaType);
      user.videoTrack.play(`remote`);
      $("#remote_id").text(`Remote ID: ${user.uid}`);
      $("#remote_id").css("display", "block");
      remote_joined = true;
}

async function handleUserUnpublished(user, mediaType) {
  $("#remote").css({"background-image":"url(mute.jpg)", "background-size":"cover"});
}

async function handleUserLeft(user) {
  videoTrack.stop();
  videoTrack.close();
  await client.leave();
  $(`#remote`).remove();
  $("#ended").css("display", "block");
}
