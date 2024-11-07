//modal stuff

const modal = document.querySelector("[data-modal]")
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

//token server url

const localTokenUrls = {
  host: "https://18-118-241-12.nip.io",
  endpoint: "getToken"
}

//create RTC client variables on script load
var rtcClient = AgoraRTC.createClient({
  mode: "rtc",
  codec: "vp9"
});


const { RTM } = AgoraRTM;
var rtmClient;

var rtmConfig = {
  //2.1.x or below
  //token : null,
  presenceTimeout : 30,
  logUpload : true,
  logLevel : "debug",
  cloudProxy : false,
  useStringUserId : false,
  //encryptionMode: "AES_128_GCM",
  //cipherKey: "",
  //salt: ""
};

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}


//Options shared by RTC and RTM TODO add Token Support
var options = {
  appid: null,
  channel: null,
  uid: 0,
  uid2: getRandomInt(10000),
  name: null,
  rtcToken: null,
  rtmToken: null,
  streamToken: null,
  streamChannel: "",
  host: false,
  debug: 0,
  nostream: false
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
var localInbox = "";
var tokensReturned = false;
var streamChannel;
var streamChannelJoined = false;

//Pull URL parameters to join

$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.uid = urlParams.get("uid");
  options.rtcToken = urlParams.get("rtcToken");
  options.rtmToken = urlParams.get("rtmToken");
  options.host = urlParams.get("host");
  options.name = urlParams.get("name");
  options.debug = urlParams.get("debug");
  options.nostream = urlParams.get("nostream");
  options.notoken = urlParams.get("")
  if (options.host == null) {
    options.host = false;
  } else {
    options.host = true;
  }
  if (options.name == null) {
    options.name = options.uid.toString();
  }
  if (options.rtcToken != null) {
  options.rtcToken = options.rtcToken.replace(/ /g,'+');
  }
  if (options.rtmToken != null) {
    options.rtmToken = options.rtmToken.replace(/ /g,'+');
  }
  if (!options.debug) {
    options.debug = 0;
  }
  if (!options.nostream) {
    options.nostream = false;
  }

  if (options.appid == null ) {showPopup(`URL: =&appid param missing in URL!`, false); ready = false;}
  if (options.channel == null ) {showPopup(`URL: =&channel param missing in URL!`, false); ready = false}
  if (options.uid == null ) {showPopup(`URL: =&uid missing in URL!`, false); ready = false}
  if (ready) {  
    $.when(getTokens()).then(function(){
      loginRtm();
  })
};
})

$("#local").click(function (e) {
  if (muted) {
    videoTrack.setEnabled(true); 
    $("#local_video").css("display", "block"); 
    muted = false;
    showPopup(`RTC: Local Camera Unmuted`, false);
    sendLocalMuteMessage();
  } else {
    videoTrack.setEnabled(false); 
    muted = true;
    $("#local_video").css("display", "none");
    showPopup(`RTC: Local Camera Muted`, false);
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
  options.uid = await rtcClient.join(options.appid, options.channel, options.rtcToken || null, Number(options.uid));
  showPopup(`RTC: Joined to ${options.channel} as ${options.uid}`, false);
  await rtcClient.publish(videoTrack);
  showPopup(`RTC: Published local camera`, true);

  window.addEventListener("unload", function () {
    leaveChannel();
  });

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
            showPopup(`KEYPRESS: Toggle mute for ${remote_name}'s camera`, true);
            sendMessage("m")
          } else {
            showPopup(`KEYPRESS: Remote not joined`, true);
          }
        break;
      case "s":
        // start stream channel.
        event.preventDefault();
          showPopup(`KEYPRESS: Pressed s`, true);
          options.streamChannel = options.channel + "_stream"
          if (!streamChannel) {
            streamChannel = rtmClient.createStreamChannel(options.streamChannel);
            showPopup(`Creating new stream channel`);
          }
          if (streamChannelJoined == false) {
            joinStreamChannel(options.streamChannel);
          } else {
            leaveStreamChannel();
          }
          if (remote_joined) {
            sendMessage("s");
          }
        break;
      case "t":
        // send topic message.
        event.preventDefault();
          showPopup(`KEYPRESS: Pressed t`, true);
          if (streamChannelJoined == false) {
            console.log(`SIGNALING: Not in Stream Channel, not sending topic message`);
          } else {
            sendTopicMessage("Test Topic Message");
          }
        break;
      case "c":
        // start mouse cursor capture.
        event.preventDefault();
        if (remote_joined) {
          showPopup(`KEYPRESS: Pressed c`, true);
          sendMessage("c")
        }
        break;
      case "e":
        // end meeting.
        event.preventDefault();
        remote_joined ? sendMessage("e") : leaveChannel();
        break;
      case "ArrowLeft":
          event.preventDefault();
          showPopup(`KEYPRESS: Pan remote camera left`, true);
          sendMessage("Pan camera left");
          break;
      case "ArrowRight":
          event.preventDefault();
          showPopup(`KEYPRESS: Pan remote camera right`, true);
          sendMessage("Pan camera right");
          break;
      case "ArrowUp":
          event.preventDefault();
          showPopup(`KEYPRESS: Pan remote camera up`, true);
          sendMessage("Pan camera up");
          break;
      case "ArrowDown":
          event.preventDefault();
          showPopup(`KEYPRESS: Pan remote camera down`, true);
          sendMessage("Pan camera down");
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
  options.uid = await rtcClient.join(options.appid, options.channel, options.rtcToken || null, Number(options.uid));
  showPopup(`RTC: Joined to ${options.channel} as ${options.uid}`, false);
  await rtcClient.publish(videoTrack);
  showPopup(`RTC: Published local camera`, true);

  window.addEventListener("unload", function () {
    leaveChannel();
  });

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
            showPopup(`KEYPRESS: Toggle mute for ${remote_name}'s camera`, true);
            sendMessage("m")
          } else {
            showPopup(`KEYPRESS: Remote not joined`, true);
          }
        break;
      case "s":
        // join stream channel
        event.preventDefault();
          showPopup(`KEYPRESS: Pressed s`, true);
            options.streamChannel = options.channel + "_stream"
            if (!streamChannel) {
              streamChannel = rtmClient.createStreamChannel(options.streamChannel);
              showPopup(`Creating new stream channel`);
            }
            if (streamChannelJoined == false) {
              joinStreamChannel(options.streamChannel);
            } else {
              leaveStreamChannel();
            }
            if (remote_joined) {
              sendMessage("s");
            }
        break;
      case "t":
          // send topic message.
          event.preventDefault();
            showPopup(`KEYPRESS: Pressed t`, true);
            if (streamChannelJoined == false) {
              console.log(`SIGNALING: Not in Stream Channel, not sending topic message`);
            } else {
              sendTopicMessage("Test Topic Message");
            }
          break;
      case "c":
        // start mouse cursor capture.
        event.preventDefault();
        if (remote_joined) {
          showPopup(`KEYPRESS: Pressed c`, true);
          sendMessage("c")
        }
        break;
      case "e":
        // end meeting.
        event.preventDefault();
        showPopup(`KEYPRESS: Pressed e`, true);
        remote_joined ? sendMessage("e") : leaveChannel();
        break;
      case "ArrowLeft":
        event.preventDefault();
        showPopup(`KEYPRESS: Pan remote camera left`, true);
        sendMessage("Pan camera left");
        break;
      case "ArrowRight":
        event.preventDefault();
        showPopup(`KEYPRESS: Pan remote camera right`, true);
        sendMessage("Pan camera right");
        break;
      case "ArrowUp":
        event.preventDefault();
        showPopup(`KEYPRESS: Pan remote camera up`, true);
        sendMessage("Pan camera up");
        break;
      case "ArrowDown":
        event.preventDefault();
        showPopup(`KEYPRESS: Pan remote camera down`, true);
        sendMessage("Pan camera down");
        break;
      default:
        return; // Quit when this doesn't handle the key event.
    }

    console.log(`Key "${event.key}" pressed`);
  }, true);
};

async function unsubChannel(channel) {
  try {
    const result = await rtmClient.unsubscribe(channel);
    console.log(result);
} catch (status) {
    console.log(status);
}
}

async function clearMetadata(channel) {
  try {
    const result = await rtmClient.storage.removeChannelMetadata(channel, "MESSAGE");
    console.log(result);
} catch (status) {
    console.log(status);
}
}

async function leaveChannel() {
  videoTrack.stop();
  videoTrack.close();
  await rtcClient.leave();
  await clearMetadata(options.channel);
  await unsubChannel(options.channel);
  localAttributesMapping = {};
  await rtmClient.logout();
  $(`#remote`).remove();
  $("#ended").css("display", "block");
  showPopup(`Ending meeting!`, false);
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
      showPopup(`RTC: Remote User ${remote_name} has published ${mediaType}`, true);
      remote_published = true;
}

async function handleUserUnpublished(user, mediaType) {
      $("#remote").css({"background-image":"url(mute.jpg)", "background-size":"cover"});
      showPopup(`RTC: Remote User ${remote_name} unpublished ${mediaType}, meeting still active`, true);
      remote_published = false;
}

async function handleUserJoined(user) {
  remote_name = localAttributesMapping[user.uid].value;
  showPopup(`RTC: Remote User ${remote_name} has joined, starting meeting!`, false);
}

async function handleUserLeft(user) {
  videoTrack.stop();
  videoTrack.close();
  await rtcClient.leave();  
  await clearMetadata(options.channel);
  await unsubChannel(options.channel);
  localAttributesMapping = {};
  await rtmClient.logout();
  $(`#remote`).remove();
  $("#ended").css("display", "block");
  showPopup(`RTC: Remote User ${user.uid} left, ending meeting!`, false );
  remote_name = "";
  remote_uid = 0;
}

//Agora RTM functions

async function loginRtm() {
  try {
    rtmClient = new RTM(options.appid, options.uid, rtmConfig); // Initialize the client instance
  } catch (status) {
    console.log(status); 
  }

  // Message
  rtmClient.addEventListener("message", event => {
    handleRtmChannelMessage(event);
  });
  rtmClient.addEventListener("topic", event => {
    handleRtmTopicEvent(event)
  });
  // Presence
  rtmClient.addEventListener("presence", event => {
    handleRtmPresenceEvent(event);
  });
  // Storage
  rtmClient.addEventListener("storage", event => {
    handleRtmStorageEvent(event);
  });
  // Connection State Change
  rtmClient.addEventListener("status", event => {
    showPopup(`SIGNALING: State changed To: ${event.state} Reason: ${event.reason}`, true)
  });
  // Token Privilege Will Expire
  rtmClient.addEventListener("tokenPrivilegeWillExpire", (channelName) => {
    showPopup(`SIGNALING: Token will expire for ${channelName}`, false);
  });

  try {
    //2.1.x or below
    //const result = await rtmClient.login();
    //2.2.0
    const result = await rtmClient.login({token: options.rtmToken});
    console.log(result);
  } catch (status) {
    console.log(status);
  }

    //RTM 2 setup of local inbox for emulated peer-to-peer messaging
    localInbox = "inbox_" + options.uid;
    try {
      const result = await rtmClient.subscribe(localInbox, {
        withMessage: true,
        withPresence: false, 
        withMetadata: true,
        withLock: false,
      });
      console.log("SIGNALING: Local inbox sub result: ",result.channelName);
      showPopup(`SIGNALING: Local inbox sub result: ${result.channelName}`, false)
    } catch (status) {
      console.log(status);
    }

    //RTM 2 setup of shared channel
    try {
      const result = await rtmClient.subscribe(options.channel, {
        withMessage: true,
        withPresence: true, 
        withMetadata: true,
        withLock: false,
      });
      console.log("SIGNALING: rtm channel sub result: ",result.channelName);
      showPopup(`SIGNALING: Shared Channel sub result: ${result.channelName}`, false)
    } catch (status) {
      console.log(status);
    }
  
    const channelMetadataOptions = {
      majorRevision: -1,
      addTimeStamp: true,
      addUserId: true,
    };

    let attributeMapping = [];
    const myUid = options.uid;
    let role = options.host ? "Host" : "Guest";
    if (options.host) {
      attributeMapping = [
        {
          key: "hostIn",
          value: "true",
          revision: -1
        },
        {
          key: "hostID",
          value: myUid,
          revision: -1
        },
        {
          key: myUid,
          value: `${options.name} (${role})`,
          revision: -1
        }
      ];
    } else {
      attributeMapping = [
        {
          key: myUid,
          value: `${options.name} (${role})`,
          revision: -1
        }];
    }

    try {
      const result = await rtmClient.storage.setChannelMetadata(options.channel, "MESSAGE", attributeMapping, channelMetadataOptions);
      console.log("SIGNALING: rtm channel metadata result:",result.channelName);
      showPopup(`SIGNALING: Shared Cannel metadata result: ${result.channelName}`, true);
    } catch (status) {
      console.log("SIGNALING: Error setting channel metadata:", status.reason);
      showPopup(`SIGNALING ERROR: Error setting channel metadata: ${status.reason}`, false);
    }

    if (options.host) {
      joinChannelAsHost();
    } else {
      startCamera();
    }
}

async function sendLocalMuteMessage () {
      if (rtmClient != null) {
        let channelMessage = "";
        if (muted) {channelMessage = "Remote User Muted their Camera"}
        else {channelMessage = "Remote User Unmuted their Camera"}
        try {
          const result = await rtmClient.publish(options.channel, channelMessage);
          console.log(result);
          showPopup(`SIGNALING: Local Cam Mute Message Sent`, true)
        } catch (status) {
          console.log(status);
        }
      } else {
        showPopup(`SIGNALING ERROR: No RTM client!"`, false);
      }
}

async function sendMessage (message) {
  if (!message) {
      showPopup(`SIGNALING ERROR: No message passed to send`, false);
  }
  else {
    if (rtmClient != null) {
      let channelMessage = message;
      try {
        const result = await rtmClient.publish(options.channel, channelMessage);
        console.log(result);
        showPopup(`SIGNALING: Sending to ${options.channel}: "${channelMessage}"`, true)
      } catch (status) {
        console.log(status);
      }
    } else {
      showPopup(`SIGNALING ERROR: No RTM client!`, false)};
  }  
}

async function sendPeerMessage (message, peerId) {
  if (!message) {
      showPopup(`SIGNALING ERROR: No message passed to peer send`, false);
  } else { 
    if (peerId != null) {
      let peerMessage = message;
      let peerInbox = "inbox_" + peerId;
      try {
        const result = await rtmClient.publish(peerInbox, peerMessage);
        console.log(result);
        showPopup(`SIGNALING: Peer message sent to ${peerId}: "${peerMessage}"`, true)
      } catch (status) {
        console.log(status);
      }
  } else {
    showPopup(`SIGNALING ERROR: No peerid passed`, false);
  }
}  
}

function handleRtmStorageEvent(event) {
  const channelType = event.channelType; // The channel type. Should be "STREAM" or "MESSAGE" .
  const channelName = event.channelName; // The channel this event came from
  const publisher = event.publisher; // Who triggered this event
  const storageType = event.storageType; // Which category the event is, should be 'USER'、'CHANNEL'
  const action = event.eventType; // The action. Should be one of "SNAPSHOT"、"SET"、"REMOVE"、"UPDATE" or "NONE"
  const data = event.data; // 'USER_METADATA' or 'CHANNEL_METADATA' payload
  if (channelType == "MESSAGE" && storageType == "CHANNEL" && (action == "UPDATE" || action == "SET" || action == "SNAPSHOT")) {
    if (data.totalCount != 0) {
      localAttributesMapping = data.metadata;
      showPopup(`SIGNALING: Channel Attributes ${action} for ${options.channel}`, true);
      if (localAttributesMapping["hostIn"].value == "true" && !options.host) {
        hostID = localAttributesMapping["hostID"].value;
        showPopup(`SIGNALING: Host ${hostID} in channel, sending join request`, false);
        sendPeerMessage("req join", hostID);
      }
      } else {
        console.log(`SIGNALING ERROR - Channel metadata empty`);
      }
    } else {
    showPopup(`${channelType} ${channelName} ${storageType} by ${publisher}`, true);
  }
}

function handleRtmTopicEvent(event) {
  const action = event.eventType; // The action. Should be one of 'SNAPSHOT'、'JOIN'、'LEAVE'.
  const channelName = event.channelName; // The channel this event came from
  const publisher = event.publisher; // Who triggered this event
  const topicInfos = event.topicInfos; // Topic information payload
  if (channelName == options.streamChannel) {
    const publisherArray = [publisher];
    const options = {
      users: publisherArray
    };
    switch (action) {
      case "REMOTE_JOIN":
        console.log(`REMOTE_JOIN action for stream channel topic ${topicInfos[0].topicName} of user ${publisher}`);
        showPopup(`Remote user ${publisher} published into topic ${topicInfos[0].topicName}, subscribing.`)
        streamChannel.subscribeTopic("data-stream", options);
        break;
      case "REMOTE_LEAVE":
        console.log(`LEAVE action for stream channel topic ${topicInfos[0].topicName} of user ${publisher}`);
        showPopup(`Remote user ${publisher} unpublished from topic ${topicInfos[0].topicName}, unsubscribing.`)
        streamChannel.unsubscribeTopic("data-stream", options);
        break;
      default:
        return;
    }
  } else {
    console.log(`topic event received for unexpected stream channel`)
  }
};


function handleRtmPresenceEvent(event) {
  const action = event.eventType; // The action. Should be one of 'SNAPSHOT'、'INTERVAL'、'JOIN'、'LEAVE'、'TIMEOUT、'STATE_CHANGED'、'OUT_OF_SERVICE'.
  const channelType = event.channelType; // The channel type. Should be "STREAM" or "MESSAGE" .
  const channelName = event.channelName; // The channel this event came from
  const publisher = event.publisher; // Who triggered this event
  const states = event.stateChanged; // User state payload
  const interval = event.interval; // Interval payload
  const snapshot = event.snapshot; // Snapshot payload
  if (channelType == "MESSAGE" && channelName != localInbox) {
    switch (action) {
      case "SNAPSHOT":
        console.log(`CHANNEL: ${action} received`);
        showPopup(`SIGNALING: Snapshot received for ${channelName}`, true);
        for (var i = 0; i < snapshot.length; i++) {
          if (snapshot[i].userId != options.uid) {
            remote_uid = snapshot[i].userId;
          }
        }
        break;
      case "INTERVAL":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        break;
      case "JOIN":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        showPopup(`SIGNALING: ${publisher} joined channel ${channelName}`, true);
        if (publisher == options.uid) {
          console.log("ignoring");
        } else {
          remote_uid = publisher;
        }
        break;
      case "LEAVE":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        showPopup(`SIGNALING: ${publisher} left channel ${channelName}`, true);
        break;
      case "TIMEOUT":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        break;
      case "STATE_CHANGED":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        break;
      case "ERROR_OUT_OF_SERVICE":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        break;
      default:
        return; // 
    }
  } else {
    switch (action) {
      case "SNAPSHOT":
        console.log(`STREAM: ${action} for ${publisher}`);
        break;
      case "INTERVAL":
        console.log(`STREAM: ${action} for ${publisher}`);
        break;
      case "JOIN":
        console.log(`STREAM: ${action} for ${publisher}`);
        showPopup(`SIGNALING: ${publisher} joined Stream channel ${channelName}`, true);
        //remote_uid = publisher;
        break;
      case "LEAVE":
        console.log(`STREAM: ${action} for ${publisher}`);
        showPopup(`SIGNALING: ${publisher} left the RTM channel ${channelName}`, true);
        break;
      case "TIMEOUT":
        console.log(`STREAM: ${action} for ${publisher}`);
        break;
      case "STATE_CHANGED":
        console.log(`STREAM: ${action} for ${publisher}`);
        break;
      case "ERROR_OUT_OF_SERVICE":
        console.log(`STREAM: ${action} for ${publisher}`);
        break;
      default:
        return; // 
  }}
}

function handleRtmChannelMessage(event) {
  const channelType = event.channelType; // The channel type. Should be "STREAM" or "MESSAGE" .
  const channelName = event.channelName; // The channel this message comes from
  const topic = event.topicName; // The Topic this message comes from, it is valid when the channelType is "STREAM".
  const messageType = event.messageType; // The message type. Should be "sting" or "binary" .
  const customType = event.customType; // User defined type
  const publisher = event.publisher; // Message publisher
  const message = event.message; // Message payload
  const pubTime = event.publishTime; // Message publisher timestamp
  if (channelType == "MESSAGE") {
    if (channelName == localInbox) {
      showPopup(`SIGNALING: Peer Message received from: ${publisher}: "${message}"`, true);
      if (message == "req join") {
        showPopup(`SIGNALING: ${publisher} requesting to join`, false);
        remote_name = localAttributesMapping[publisher]?.value;
        remote_uid = publisher;
        $("#guestID span").text(`${remote_name}`);
        modal.showModal();
      }
      if (message == `approve join`) {
        const host_name = localAttributesMapping["hostID"].value;
        showPopup(`SIGNALING: ${host_name} has approved joining`, false);
        joinChannel();
      }
    } else {
      showPopup(`SIGNALING: Channel Message received from: ${publisher}: "${message}"`, true);
      if (message == "m") {
        showPopup(`SIGNALING: Mute state toggeled by ${publisher}`, false);
        if (muted) {
          videoTrack.setEnabled(true); 
          $("#local_video").css("display", "block"); 
          showPopup(`RTC: Local Camera Unmuted`, true);
          muted = false;
        } else {
          videoTrack.setEnabled(false); 
          muted = true;
          $("#local_video").css("display", "none");
          showPopup(`RTC: Local Camera Muted`, true);
        }
      }
      if (message == "e") {
        showPopup(`SIGNALING: Meeting ended by ${publisher}`, false);
        leaveChannel();
      }
      if (message == "s" ) {
        showPopup(`s received, joining streamchannel`, true);
        options.streamChannel = options.channel + "_stream"
        if (!streamChannel) {
          streamChannel = rtmClient.createStreamChannel(options.streamChannel);
          showPopup(`Creating new stream channel`);
        }
        if (streamChannelJoined) {
          leaveStreamChannel();
        } else {
          joinStreamChannel(options.streamChannel);
        }           
      }
    }
  } else {
    showPopup(`SIGNALING: Stream Channel Message received from: ${publisher}: "${message}"`, false);
  }
};


//Popup functions

var popups = 0;

function showPopup(message, debug) {
if (debug == true && options.debug == 1) {
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
} else if (debug == true && options.debug == 0) {
  return;
} else {
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
}

//Token getters
async function getTokens() {

  if (options.rtcToken == null) {
    try {
      const res = await fetch(
        localTokenUrls.host + "/" + localTokenUrls.endpoint, {
          method: "POST",
          headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
            "tokenType": "rtc",
            "channel": options.channel,
            "role": "publisher",  // "publisher" or "subscriber"
            "uid": options.uid,
            "expire": 3600 // optional: expiration time in seconds (default: 3600)})
            })});
      const response = await res.json();
      console.log("RTC token fetched from server: ", response.token);
      options.rtcToken = response.token;
    } catch (err) {
      console.log(err);
    }
  }

  if (options.rtmToken == null) {
    try {
      const res = await fetch(
        localTokenUrls.host + "/" + localTokenUrls.endpoint, {
          method: "POST",
          headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
            "tokenType": "rtm",
            "uid": options.uid,
            "channel": "*", // optional: passing channel gives streamchannel. wildcard "*" is an option.
            "expire": 3600 // optional: expiration time in seconds (default: 3600)})
            })});
      const response = await res.json();
      console.log("RTM token fetched from server: ", response.token);
      options.rtmToken = response.token;
    } catch (err) {
      console.log(err);
    }
  }

if (options.nostream = false) {
    try {
      const res = await fetch(
        localTokenUrls.host + "/" + localTokenUrls.endpoint, {
          method: "POST",
          headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
            "tokenType": "rtm",
            "uid": options.uid,
            "channel": options.channel + "_stream", // optional: passing channel gives streamchannel. wildcard "*" is an option.
            "expire": 3600 // optional: expiration time in seconds (default: 3600)})
            })});
      const response = await res.json();
      console.log("StreamChannel RTC token fetched from server: ", response.token);
      options.streamToken = response.token;
    } catch (err) {
      console.log(err);
    }
  };
  tokensReturned = true;
};


async function joinStreamChannel(channel) {
  try {
    const result = await streamChannel.join({token: options.streamToken, withPresence: true});
    console.log(result);
    showPopup(`SIGNALING: Joined Stream Channel "${channel}"`, false);
  } catch (status) {
    console.log(status);
  }

  try {
    const result = await streamChannel.joinTopic("data-stream");
    console.log(result);
    showPopup(`SIGNALING: Joined Topic "data-stream" in Stream Channel "${channel}"`, false);
    streamChannelJoined = true;
  } catch (status) {
    console.log(status);
  }
};

async function leaveStreamChannel() {
  try {
    //await streamChannel.unsubscribeTopic("data-stream");
    const result = await streamChannel.leaveTopic("data-stream");
    console.log(result);
    showPopup(`SIGNALING: Left topic "data-stream"`, false);
  } catch (status) {
    console.log(status);
  }

  try {
    const result = await streamChannel.leave();
    console.log(result);
    showPopup(`SIGNALING: Left Stream Channel`, false);
    streamChannelJoined = false;
  } catch (status) {
    console.log(status);
  }
};

function sendTopicMessage(message) {
  if (message == "" || streamChannelJoined === false) {
    console.log(
      "Not sending topic message, not joined to stream channel."
    );
    showPopup(`SIGNALING: Failed to send topic message.`);
    return;
  }
  streamChannel.publishTopicMessage("data-stream", message).then((response) => {
    console.log(response);
    showPopup(`SIGNALING: Topic Message ${message} sent to Stream Channel "data-stream`);
  });
};


