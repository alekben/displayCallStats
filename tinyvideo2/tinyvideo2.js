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

//token server url

const localTokenUrls = {
  host: "http://ec2-3-140-200-204.us-east-2.compute.amazonaws.com",
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
  token : null,
  presenceTimeout : 300,
  logUpload : false,
  logLevel : "debug",
  cloudProxy : false,
  useStringUserId : false
};


//Options shared by RTC and RTM TODO add Token Support
var options = {
  appid: null,
  channel: null,
  uid: 0,
  name: null,
  rtcToken: null,
  rtmToken: null,
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
var localInbox = "";

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
    rtmConfig.token = options.rtmToken;
  }

  if (options.appid == null ) {showPopup(`appid missing in URL`); ready = false;}
  if (options.channel == null ) {showPopup(`channel missing in URL`); ready = false}
  if (options.uid == null ) {showPopup(`uid missing in URL`); ready = false}
  if (ready) {  
    getTokens();
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
  options.uid = await rtcClient.join(options.appid, options.channel, options.rtcToken || null, options.uid);
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
  options.uid = await rtcClient.join(options.appid, options.channel, options.rtcToken || null, options.uid);
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
    const result = await rtmClient.storage.removeChannelMetadata(channel, "CLEARMETADATA");
    console.log(result);
} catch (status) {
    console.log(status);
}
}

async function leaveChannel() {
  videoTrack.stop();
  videoTrack.close();
  await rtcClient.leave();
  await unsubChannel(options.channel);
  await clearMetadata(options.channel);
  //await rtmClient.clearChannelAttributes(options.channel);
  localAttributesMapping = {};
  //await channel.leave();
  await rtmClient.logout();
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
  await unsubChannel(options.channel);
  await clearMetadata(options.channel);
  //await rtmClient.clearChannelAttributes(options.channel);
  localAttributesMapping = {};
  //await channel.leave();
  await rtmClient.logout();
  $(`#remote`).remove();
  $("#ended").css("display", "block");
  showPopup(`Remote User ${user.uid} left, ending meeting`);
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

  rtmClient.addEventListener("message", event => {
    handleRtmChannelMessage(event);
  });
    // Presence
  rtmClient.addEventListener("presence", event => {
    handleRtmPresenceEvent(event);
  });
  // Topic
  rtmClient.addEventListener("topic", event => {
    const action = event.eventType; // The action. Should be one of 'SNAPSHOT'、'JOIN'、'LEAVE'.
    const channelName = event.channelName; // The channel this event came from
    const publisher = event.userId; // Who triggered this event
    const topicInfos = event.topicInfos; // Topic information payload
    const totalTopics = event.totalTopics; // How many topics
  });
  // Storage
  rtmClient.addEventListener("storage", event => {
    handleRtmStorageEvent(event);
  });
  // Lock
  rtmClient.addEventListener("lock", event => {
    const channelType = event.channelType; // The channel type. Should be "STREAM" or "MESSAGE" .
    const channelName = event.channelName; // The channel this event came from
    const publisher = event.publisher; // Who triggered this event
    const action = event.evenType; // The action. Should be one of 'SET'、'REMOVED'、'ACQUIRED'、'RELEASED'、'EXPIRED'、'SNAPSHOT'
    const lockName = event.lockName; // Which lock it affected
    const ttl = event.ttl; // The ttl of this lock
    const snapshot = event.snapshot; // Snapshot payload
  });
  // Connection State Change
  rtmClient.addEventListener("status", event => {
    showPopup(`RTM State changed To: ${event.state} Reason: ${event.reason}`)
  });
  // Token Privilege Will Expire
  rtmClient.addEventListener("tokenPrivilegeWillExpire", (channelName) => {
    showPopup(`Token will expire for ${channelName}`);
  });

  try {
    const result = await rtmClient.login();
    console.log(result);
  } catch (status) {
    console.log(status);
  }

  //rtmClient = AgoraRTM.createInstance(options.appid, { enableLogUpload: true, logFilter: AgoraRTM.LOG_FILTER_OFF});
  //const rtmOptions = {uid: options.uid, token: options.token};
  //await rtmClient.login(rtmOptions);
  // Client Event listeners
  // Display connection state changes
  // rtmClient.on('ConnectionStateChanged', function (state, reason) {
  //  showPopup(`RTM State changed To: ${state} Reason: ${reason}`)
  //  })

    //RTM 2 setup of local inbox for emulated peer-to-peer messaging

    const subscribeOptions = {
      withMessage: true,
      withPresence: true, 
      withMetadata: true,
      withLock: false,
    };
    localInbox = "inbox_" + options.uid;
    try {
      const result = await rtmClient.subscribe(localInbox, subscribeOptions);
      console.log(`local inbox sub result: ${result}`);
      showPopup(`local inbox sub result: ${result}`)
    } catch (status) {
      console.log(status);
    }

    //RTM 2 setup of shared channel

    const rtmChannel = options.channel;
    try {
      const result = await rtmClient.subscribe(rtmChannel, subscribeOptions);
      console.log(`rtm channel sub result: ${result}`);
      showPopup(`rtm channel sub result: ${result}`)
    } catch (status) {
      console.log(status);
    }
  
    //channel = await rtmClient.createChannel(`${options.channel}`);
    //await channel.join().then (() => {
    //  showPopup(`Joined to RTM channel ${options.channel} as UID ${options.uid}`)
    //})

    const channelMetadataOptions = {
      majorRevision: -1, // Use this field to enable version number verification of the entire set of channel attributes.
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
      console.log(`rtm channel metadata result: ${result}`);
      showPopup(`rtm channel metadata result: ${result}`);
    } catch (status) {
      showPopup(`Error setting channel metadata: ${status.reason}`);
      console.log(`Error setting channel metadata: ${status.reason}`);
    }

    //await rtmClient.addOrUpdateChannelAttributes(options.channel, attributeMapping, //{enableNotificationToChannelMembers: true}).then (() => {
    //  showPopup(`Setting Channel Attribute as ${role} for UID ${options.uid}`);
    //})

    //channel.on('ChannelMessage', function (message, memberId) {
    //showPopup(`RTM Message received from: ${memberId}: "${message.text}"`);
    //if (message.text == "m") {
    //  showPopup(`Mute state toggeled by ${memberId}`);
    //  if (muted) {
    //    videoTrack.setEnabled(true); 
    //    $("#local_video").css("display", "block"); 
    //    showPopup(`Local Camera Unmuted`);
    //    muted = false;
    //  } else {
    //    videoTrack.setEnabled(false); 
    //    muted = true;
    //    $("#local_video").css("display", "none");
    //    showPopup(`Local Camera Muted`);
    //  }
    //}
    //})

    //rtmClient.on('MessageFromPeer', function (message, memberId, props) {
    //  showPopup(`RTM Peer Message received from: ${memberId}: "${message.text}"`);
    //  if (message.text == "req join") {
    //    showPopup(`${memberId} requesting to join`);
    //    remote_name = localAttributesMapping[memberId].value;
    //    $("#guestID span").text(`${remote_name}`);
    //    modal.showModal();
    //  }
    //  if (message.text == `approve join`) {
    //    const host_name = localAttributesMapping["hostID"].value;
    //    showPopup(`${host_name} has approved joining`);
    //    joinChannel();
    //  }
    //  })

    // Display channel member stats
    //channel.on('MemberJoined', function (memberId) {
    //showPopup(`${memberId} joined the RTM channel`);
    //remote_uid = memberId;
    //})
    // Display channel member stats
    //channel.on('MemberLeft', function (memberId) {
    //showPopup(`${memberId} left the RTM channel`)
    //})

    /* Report and Update on Channel Attributes to local object
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
   */
}
  
async function sendLocalMuteMessage () {
      if (rtmClient != null) {
        let channelMessage = "";
        if (muted) {channelMessage = "Remote User Muted their Camera"}
        else {channelMessage = "Remote User Unmuted their Camera"}
        try {
          const result = await rtmClient.publish(options.channel, channelMessage);
          console.log(result);
          showPopup(`RTM Local Cam Mute Message Sent`)
        } catch (status) {
          console.log(status);
        }
      } else {
        showPopup(`No RTM client"`);
      }
}

async function sendMessage (message) {
  if (!message) {
      showPopup(`No message passed to send`);
  }
  else {
    if (rtmClient != null) {
      let channelMessage = message;
      try {
        const result = await rtmClient.publish(options.channel, channelMessage);
        console.log(result);
        showPopup(`RTM Channel message sent: "${channelMessage}"`)
      } catch (status) {
        console.log(status);
      }
    } else {
      showPopup(`No RTM client`)};
  }  
}

async function sendPeerMessage (message, peerId) {
  if (!message) {
      showPopup(`No message passed to peer send`);
  } else {
    if (peerId != null) {
      let peerMessage = message;
      let peerInbox = "inbox_" + peerId;
      try {
        const result = await rtmClient.publish(peerInbox, peerMessage);
        console.log(result);
        showPopup(`RTM Peer message sent to ${peerId}: "${peerMessage}"`)
      } catch (status) {
        console.log(status);
      }
      showPopup(`RTM Peer message sent to ${peerId}: "${peerMessage}"`)
  } else {
    showPopup(`no peerid passed`);
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
  if (channelType == "MESSAGE" && storageType == "CHANNEL" && (action == "UPDATE" || action == "SET")) {
    const attributesReceived = data.metadata;
    localAttributesMapping = attributesReceived;
    showPopup(`Channel Attributes ${action}: ${attributesReceived}`);
    if (localAttributesMapping["hostIn"].value = "true" && !options.host) {
      hostID = localAttributesMapping["hostID"].value;
      showPopup(`Host ${hostID} in channel, requesting to join`);
     sendPeerMessage("req join", hostID);
    }
  } else {
    showPopup(`${channelType} ${channelName} ${storageType} ${publisher}`);
  }
}
//RTM2 event handling functions

function handleRtmPresenceEvent(event) {
  const action = event.eventType; // The action. Should be one of 'SNAPSHOT'、'INTERVAL'、'JOIN'、'LEAVE'、'TIMEOUT、'STATE_CHANGED'、'OUT_OF_SERVICE'.
  const channelType = event.channelType; // The channel type. Should be "STREAM" or "MESSAGE" .
  const channelName = event.channelName; // The channel this event came from
  const publisher = event.publisher; // Who triggered this event
  const states = event.stateChanged; // User state payload
  const interval = event.interval; // Interval payload
  const snapshot = event.snapshot; // Snapshot payload
  if (channelType == "MESSAGE") {
    switch (action) {
      case "SNAPSHOT":
        console.log(`CHANNEL: ${action} received`);
        showPopup(`CHANNEL: Snapshot received for ${channelName}`);
        remote_uid = snapshot[1].userId;
        break;
      case "INTERVAL":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        break;
      case "JOIN":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        showPopup(`${publisher} joined RTM channel ${channelName}`);
        if (publisher == options.uid) {
          console.log("ignoring");
        } else {
          remote_uid = publisher;
        }
        break;
      case "LEAVE":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        showPopup(`CHANNEL: ${publisher} left the RTM channel ${channelName}`);
        break;
      case "TIMEOUT":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        break;
      case "STATE_CHANGED":
        console.log(`CHANNEL: ${action} for ${publisher}`);
        break;
      case "OUT_OF_SERVICE":
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
        showPopup(`STREAM: ${publisher} joined RTM Stream channel ${channelName}`);
        //remote_uid = publisher;
        break;
      case "LEAVE":
        console.log(`STREAM: ${action} for ${publisher}`);
        showPopup(`STREAM: ${publisher} left the RTM channel ${channelName}`);
        break;
      case "TIMEOUT":
        console.log(`STREAM: ${action} for ${publisher}`);
        break;
      case "STATE_CHANGED":
        console.log(`STREAM: ${action} for ${publisher}`);
        break;
      case "OUT_OF_SERVICE":
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
      showPopup(`RTM Peer Message received from: ${publisher}: "${message}"`);
      if (message == "req join") {
        showPopup(`${publisher} requesting to join`);
        remote_name = localAttributesMapping[publisher].value;
        $("#guestID span").text(`${remote_name}`);
        modal.showModal();
      }
      if (message == `approve join`) {
        const host_name = localAttributesMapping["hostID"].value;
        showPopup(`${host_name} has approved joining`);
        joinChannel();
      }
    } else {
      showPopup(`RTM Channel Message received from: ${publisher}: "${message}"`);
      if (message == "m") {
        showPopup(`Mute state toggeled by ${publisher}`);
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
    }
  } else {
    showPopup(`RTM Stream Channel Message received from: ${publisher}: "${message}"`);
  }
};


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

//Token getters
async function getTokens() {
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
    rtmConfig.token = response.token;
  } catch (err) {
    console.log(err);
  }
}
