

//create RTC and RTM client variables on script load
var rtcClient = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp9"
});
var rtmClient;

//Options shared by RTC and RTM TODO add Token Support
var options = {
  appid: null,
  channel: null,
  uid: 0,
  token: null
};

//Agora WebSDK RTC functions
AgoraRTC.setLogLevel(4);
AgoraRTC.enableLogUpload();

var videoTrack;
var muted = false;
var remote_joined = false;

//Pull URL parameters to join

$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.uid = urlParams.get("uid");
  options.token = urlParams.get("token");
  if (options.token != null) {
  options.tokens = options.token.replace(/ /g,'+');
  }
  joinChannel();
  loginRtm();
});

$("#local").click(function (e) {
  if (muted) {
    videoTrack.setEnabled(true); 
    $("#local_video").css("display", "block"); 
    muted = false;
    showPopup(`Local Camera Unmuted`);
    sendMessageOnMute();
  } else {
    videoTrack.setEnabled(false); 
    muted = true;
    $("#local_video").css("display", "none");
    showPopup(`Local Camera Muted`);
    sendMessageOnMute();
  }
});

async function joinChannel() {
    rtcClient.on("user-published", handleUserPublished);
    rtcClient.on("user-unpublished", handleUserUnpublished);
    rtcClient.on("user-joined", handleUserJoined);
    rtcClient.on("user-left", handleUserLeft);
    videoTrack = await AgoraRTC.createCameraVideoTrack({encoderConfig: "720p_2"});
    options.uid = await rtcClient.join(options.appid, options.channel, options.token || null, options.uid);
    showPopup(`Joined to RTC Channel ${options.channel} as ${options.uid}`);
    $("#local").css("display", "block");
    videoTrack.play("local_video");
    $("#local_id").text(`Local ID: ${options.uid}`);
    $("#local_id").css("display", "block");
    await rtcClient.publish(videoTrack);
    showPopup(`Published local camera`);

};

async function handleUserPublished(user, mediaType) {
      await rtcClient.subscribe(user, mediaType);
      user.videoTrack.play(`remote`);
      $("#remote_id").text(`Remote ID: ${user.uid}`);
      $("#remote_id").css("display", "block");
      remote_joined = true;
      showPopup(`Remote User ${user.uid} has published ${mediaType}`);
}

async function handleUserUnpublished(user, mediaType) {
  $("#remote").css({"background-image":"url(mute.jpg)", "background-size":"cover"});
  showPopup(`Remote User ${user.uid} unpublished ${mediaType}, meeting still active`);
}

async function handleUserJoined(user) {
  showPopup(`Remote User ${user.uid} has joined, starting meeting`);
}

async function handleUserLeft(user) {
  videoTrack.stop();
  videoTrack.close();
  await rtcClient.leave();
  await channel.leave();
  await rtmClient.logout()
  $(`#remote`).remove();
  $("#ended").css("display", "block");
  showPopup(`Remote User ${user.uid} left, ending meeting`);
}

//Agora RTM functions

async function loginRtm() {
  rtmClient = await AgoraRTM.createInstance(options.appid, { enableLogUpload: true, logFilter: AgoraRTM.LOG_FILTER_OFF});
  const rtmOptions = {uid: options.uid, token: options.token};
  await rtmClient.login(rtmOptions);
    // Client Event listeners
  // Display connection state changes
  rtmClient.on('ConnectionStateChanged', function (state, reason) {
    showPopup(`RTM State changed To: ${state} Reason: ${reason}`)
    })
  
    channel = await rtmClient.createChannel(`${options.channel}`);
    await channel.join().then (() => {
      showPopup(`Joined to RTM channel ${options.channel} as UID ${options.uid}`)
    })
    channel.on('ChannelMessage', function (message, memberId) {
    showPopup(`RTM Message received from: ${memberId}: "${message.text}"`)
    })
    // Display channel member stats
    channel.on('MemberJoined', function (memberId) {
    showPopup(`${memberId} joined the RTM channel`)
    })
    // Display channel member stats
    channel.on('MemberLeft', function (memberId) {
    showPopup(`${memberId} left the RTM channel`)
    })
}
  
async function sendMessageOnMute (message) {
    if (!message) {
      if (channel != null) {
        let channelMessage = "";
        if (muted) {channelMessage = "Remote User Muted their Camera"}
        else {channelMessage = "Remote User Unmuted their Camera"}
        await channel.sendMessage({ text: channelMessage }).then(() => {
          showPopup(`RTM Channel message sent: "${channelMessage}"`)
        })
    } else {
      if (channel != null) {
        await channel.sendMessage({ text: message }).then(() => {
          showPopup(`RTM Channel message sent : "${message}"`)
        })
    }}}
}

//Popup functions

var popups = 0;

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