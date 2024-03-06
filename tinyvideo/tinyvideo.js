//modal stuff

const modal = document.querySelector("[data-modal]")
const modalMesssage = document.querySelector("[data-modal-chat]")
const approveButton = document.querySelector("[data-approve-modal]")
const denyButton = document.querySelector("[data-deny-modal]")
const sendButton = document.querySelector("[data-send-modal]")
const cancelButton = document.querySelector("[data-cancel-modal]")

approveButton.addEventListener("click", () => {
  //const sendId = $('#guestID')[0].outerText;
  sendPeerMessage("approve join", remote_uid);
  modal.close();
})

denyButton.addEventListener("click", () => {
  //const sendId = document.querySelector("guestId");
  sendPeerMessage(`Denied joining by ${options.uid}`, remote_uid);
  modal.close();
})

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
  name: null,
  token: null,
  host: false
};

var localAttributesMapping = {};

//Agora WebSDK RTC functions
//AgoraRTC.setLogLevel(4);
AgoraRTC.enableLogUpload();

var videoTrack;
var muted = false;
var remote_joined = false;
var remote_published = false;
var remote_name = "";
var ready = true;
var remote_uid = 0;

//Pull URL parameters to join

$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.uid = urlParams.get("uid");
  options.token = urlParams.get("token");
  options.host = urlParams.get("host");
  options.name = urlParams.get("name");
  if (options.host == null) {
    options.host = false;
  } else {
    options.host = true;
  }
  if (options.name == null) {
    options.name = options.uid.toString();
  }
  if (options.token != null) {
  options.token = options.token.replace(/ /g,'+');
  }
  if (options.appid == null ) {showPopup(`appid missing in URL`); ready = false;}
  if (options.channel == null ) {showPopup(`channel missing in URL`); ready = false}
  if (options.uid == null ) {showPopup(`uid missing in URL`); ready = false}
  if (ready) {  
    loginRtm();
    if (options.host) {
      joinChannelAsHost();
    } else {
      startCamera();
    }
  }
});

$("#local").click(function (e) {
  if (muted) {
    videoTrack.setEnabled(true); 
    $("#local_video").css("display", "block"); 
    muted = false;
    showPopup(`Local Camera Unmuted`);
    sendLocalMuteMessage();
  } else {
    videoTrack.setEnabled(false); 
    muted = true;
    $("#local_video").css("display", "none");
    showPopup(`Local Camera Muted`);
    sendLocalMuteMessage();
  }
});


async function startCamera() {
  videoTrack = await AgoraRTC.createCameraVideoTrack({encoderConfig: "720p_2"});
  $("#local").css("display", "block");
  videoTrack.play("local_video");
  $("#local_id").text(`Local ID: ${options.name}`);
  $("#local_id").css("display", "block");
}



async function joinChannel() {
  rtcClient.on("user-published", handleUserPublished);
  rtcClient.on("user-unpublished", handleUserUnpublished);
  rtcClient.on("user-joined", handleUserJoined);
  rtcClient.on("user-left", handleUserLeft);
  options.uid = await rtcClient.join(options.appid, options.channel, options.token || null, options.uid);
  showPopup(`Joined to RTC Channel ${options.channel} as ${options.uid}`);
  await rtcClient.publish(videoTrack);
  showPopup(`Published local camera`);
  //add keystroke listeners
  window.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) {
      return; // Do nothing if the event was already processed
    }
    switch (event.key) {
      case "m":
        // mute remote camera.
        event.preventDefault();
        if (remote_joined) {
            showPopup(`Toggle mute for ${remote_name}'s camera`);
            sendMessage("m")
          } else {
            showPopup(`Remote not joined`);
          }
        break;
      case "s":
        // show stats.
        event.preventDefault();
        if (remote_joined && remote_published) {
          showPopup(`Pressed s`);
          sendMessage("s")
        }
        break;
      case "c":
        // start mouse cursor capture.
        event.preventDefault();
        if (remote_joined) {
          showPopup(`Pressed c`);
          sendMessage("c")
        }
        break;
      case "e":
        // end meeting.
        event.preventDefault();
        showPopup(`Pressed e`);
        sendMessage("e");
        leaveChannel();
        break;
      default:
        return; // Quit when this doesn't handle the key event.
    }

    console.log(`Key "${event.key}" pressed`);
  }, true);
};

async function joinChannelAsHost() {
  videoTrack = await AgoraRTC.createCameraVideoTrack({encoderConfig: "720p_2"});
  $("#local").css("display", "block");
  videoTrack.play("local_video");
  $("#local_id").text(`Local ID: ${options.name}`);
  $("#local_id").css("display", "block");
  rtcClient.on("user-published", handleUserPublished);
  rtcClient.on("user-unpublished", handleUserUnpublished);
  rtcClient.on("user-joined", handleUserJoined);
  rtcClient.on("user-left", handleUserLeft);
  options.uid = await rtcClient.join(options.appid, options.channel, options.token || null, options.uid);
  showPopup(`Joined to RTC Channel ${options.channel} as ${options.uid}`);
  await rtcClient.publish(videoTrack);
  showPopup(`Published local camera`);
  //add keystroke listeners
  window.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) {
      return; // Do nothing if the event was already processed
    }
    switch (event.key) {
      case "m":
        // mute remote camera.
        event.preventDefault();
        if (remote_joined) {
            showPopup(`Toggle mute for ${remote_name}'s camera`);
            sendMessage("m")
          } else {
            showPopup(`Remote not joined`);
          }
        break;
      case "s":
        // show stats.
        event.preventDefault();
        if (remote_joined && remote_published) {
          showPopup(`Pressed s`);
          sendMessage("s")
        }
        break;
      case "c":
        // start mouse cursor capture.
        event.preventDefault();
        if (remote_joined) {
          showPopup(`Pressed c`);
          sendMessage("c")
        }
        break;
      case "e":
        // end meeting.
        event.preventDefault();
        showPopup(`Pressed e`);
        sendMessage("e");
        break;
      case "ArrowLeft":
        // end meeting.
        event.preventDefault();
        showPopup(`Pan remote camera left`);
        sendMessage("Pan camera left");
        break;
      case "ArrowRight":
        // end meeting.
        event.preventDefault();
        showPopup(`Pan remote camera right`);
        sendMessage("Pan camera right");
        break;
      case "ArrowUp":
        // end meeting.
        event.preventDefault();
        showPopup(`Pan remote camera up`);
        sendMessage("Pan camera up");
        break;
      case "ArrowDown":
        // end meeting.
        event.preventDefault();
        showPopup(`Pan remote camera down`);
        sendMessage("Pan camera down");
        break;
      default:
        return; // Quit when this doesn't handle the key event.
    }

    console.log(`Key "${event.key}" pressed`);
  }, true);
};

async function leaveChannel() {
  videoTrack.stop();
  videoTrack.close();
  await rtcClient.leave();
  await rtmClient.clearChannelAttributes(options.channel);
  localAttributesMapping = {};
  await channel.leave();
  await rtmClient.logout()
  $(`#remote`).remove();
  $("#ended").css("display", "block");
  showPopup(`Ending meeting.`);
  remote_name = "";
  remote_uid = 0;
}

async function handleUserPublished(user, mediaType) {
      await rtcClient.subscribe(user, mediaType);
      user.videoTrack.play(`remote`);
      remote_name = localAttributesMapping[user.uid].value;
      $("#remote_id").text(`Remote ID: ${remote_name}`);
      $("#remote_id").css("display", "block");
      remote_joined = true;
      showPopup(`Remote User ${remote_name} has published ${mediaType}`);
      remote_published = true;
}

async function handleUserUnpublished(user, mediaType) {
      $("#remote").css({"background-image":"url(mute.jpg)", "background-size":"cover"});
      showPopup(`Remote User ${remote_name} unpublished ${mediaType}, meeting still active`);
      remote_published = false;
}

async function handleUserJoined(user) {
  remote_name = localAttributesMapping[user.uid].value;
  showPopup(`Remote User ${remote_name} has joined, starting meeting`);
}

async function handleUserLeft(user) {
  videoTrack.stop();
  videoTrack.close();
  await rtcClient.leave();
  await rtmClient.clearChannelAttributes(options.channel);
  localAttributesMapping = {};
  await channel.leave();
  await rtmClient.logout()
  $(`#remote`).remove();
  $("#ended").css("display", "block");
  showPopup(`Remote User ${user.uid} left, ending meeting`);
  remote_name = "";
  remote_uid = 0;
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
    let attributeMapping = {};
    const myUid = options.uid;
    let role = options.host ? "Host" : "Guest";
    if (options.host) {
      attributeMapping = {
        hostIn: "true",
        hostID: myUid,
        [myUid]: `${options.name} (${role})`
      }
    } else {
      attributeMapping = {
        [myUid]: `${options.name} (${role})`
      }
    }
    await rtmClient.addOrUpdateChannelAttributes(options.channel, attributeMapping, {enableNotificationToChannelMembers: true}).then (() => {
      showPopup(`Setting Channel Attribute as ${role} for UID ${options.uid}`);
    })

    channel.on('ChannelMessage', function (message, memberId) {
    showPopup(`RTM Message received from: ${memberId}: "${message.text}"`);
    if (message.text == "m") {
      showPopup(`Mute state toggeled by ${memberId}`);
      if (muted) {
        videoTrack.setEnabled(true); 
        $("#local_video").css("display", "block"); 
        showPopup(`Local Camera Unmuted`);
        muted = false;
      } else {
        videoTrack.setEnabled(false); 
        muted = true;
        $("#local_video").css("display", "none");
        showPopup(`Local Camera Muted`);
      }
    }
    })

    rtmClient.on('MessageFromPeer', function (message, memberId, props) {
      showPopup(`RTM Peer Message received from: ${memberId}: "${message.text}"`);
      if (message.text == "req join") {
        showPopup(`${memberId} requesting to join`);
        remote_name = localAttributesMapping[memberId].value;
        $("#guestID span").text(`${remote_name}`);
        modal.showModal();
      }
      if (message.text == `approve join`) {
        const host_name = localAttributesMapping["hostID"].value;
        showPopup(`${host_name} has approved joining`);
        joinChannel();
      }
      })
    // Display channel member stats
    channel.on('MemberJoined', function (memberId) {
    showPopup(`${memberId} joined the RTM channel`);
    remote_uid = memberId;
    })
    // Display channel member stats
    channel.on('MemberLeft', function (memberId) {
    showPopup(`${memberId} left the RTM channel`)
    })
    // Report and Update on Channel Attributes to local object
    channel.on('AttributesUpdated', function (attributes) {
    const attributesReceived = JSON.stringify(attributes);
    localAttributesMapping = attributes;
    showPopup(`Channel Attributes Updated: ${attributesReceived}`);
    if (localAttributesMapping["hostIn"].value = "true" && !options.host) {
      hostID = localAttributesMapping["hostID"].value;
      showPopup(`Host ${hostID} in channel, requesting to join`);
      sendPeerMessage("req join", hostID);
    }
    })
}
  
async function sendLocalMuteMessage () {
      if (channel != null) {
        let channelMessage = "";
        if (muted) {channelMessage = "Remote User Muted their Camera"}
        else {channelMessage = "Remote User Unmuted their Camera"}
        await channel.sendMessage({ text: channelMessage }).then(() => {
          showPopup(`RTM Local Cam Mute Message Sent`)
        })
      } else {
        showPopup(`Not connected to RTM"`);
      }
  }

async function sendMessage (message) {
  if (!message) {
      showPopup(`No message passed to send`);
  }
  else {
    if (channel != null) {
      let channelMessage = message;
      await channel.sendMessage({ text: channelMessage }).then(() => {
        showPopup(`RTM Channel message sent: "${channelMessage}"`)
  })} else {showPopup(`Not connected to a channel`)}}  
}

async function sendPeerMessage (message, peerId) {
  if (!message) {
      showPopup(`No message passed to peer send`);
  } else {
    if (peerId != null) {
      let peerMessage = message;
      await rtmClient.sendMessageToPeer({ text: peerMessage }, peerId.toString()).then(() => {
        showPopup(`RTM Peer message sent to ${peerId}: "${peerMessage}"`)
  })} else {showPopup(`No peerId passed`)}}  
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