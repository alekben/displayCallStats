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
  uid: null
};

var videoTrack;


$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  joinChannel();
});

async function joinChannel() {
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    videoTrack = await AgoraRTC.createCameraVideoTrack({encoderConfig: "720p_2"});
    options.uid = await client.join(options.appid, options.channel, null, null);
    videoTrack.play("local");
    $("#local-id").text(`Local ID: ${options.uid})`);
};

async function handleUserPublished(user, mediaType) {
  if (mediaType === 'video') {
      await client.subscribe(user, mediaType);
      user.videoTrack.play(`remote`);
      $("#remote-id").text(`Remote ID: ${user.uid})`);
      subscribe(user, mediaType);
  }
}

async function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'video') {
    $(`#remote`).remove();
    $("#remote-id").text(``);
    videoTrack.stop();
    videoTrack.close();
    $("#local-name").text(``);
    client.leave();
    $("#remote").css("display", "none");
  }
}
