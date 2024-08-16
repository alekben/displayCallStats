
//popup stuff
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

var client;
var rttClient;
var rttClientJoined = false;

var remoteUsers = {};
var remotesArray = [];

//modal stuff

const modal = document.querySelector("[data-modal]")
const approveButton = document.querySelector("[data-approve-modal]")

approveButton.addEventListener("click", () => {
  modal.close();
  $("#modal").css("display", "none");
  $('#agora-collapse').collapse('toggle');
  // open the Advanced Settings button
})

// RTC client for host/audience
if (!client) {
  client = AgoraRTC.createClient({
    mode: "live",
    codec: "vp8",
    role: "host"
  });
}

// RTT audience client
if (!rttClient) {
  rttClient = AgoraRTC.createClient({
    mode: "live",
    codec: "vp8",
    role: "audience"
  });
}

/*
 * On initiation. `client` is not attached to any project or channel for any specific user.
 */
var options = {
  appid: null,
  channel: null,
  uid: null,
  rttUid: null,
  token: null,
  rttToken: null
};

let transcribeIndex = 0;
let translateIndex = 0;

async function changeTargetUID(label) {
  $(".uid-input").val(`${label}`);
}

function updateUIDs(id, action) {
  if (remotesArray.length == 0 && action == "remove") {
    $(".uid-list").empty();
    $(".uid-input").val(``);
  } else {
  let i = 0;
  while (i < remotesArray.length) {
    if (remotesArray[i] == id) {
      console.log("UID already in list");
      return;
    }
    i++;
  }

  $(".uid-list").empty();
  remotesArray.push(id);

  //repopulate
  let j = 0;
  while (j < remotesArray.length) {
    $(".uid-list").append(`<a class="dropdown-item" label="${remotesArray[j]}" href="#">${remotesArray[j]}</a>`);
    j++;
  } 
  $(".uid-input").val(`${remotesArray[0]}`);
}
}

$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.rttToken = urlParams.get("token2");
  options.uid = urlParams.get("uid");
  options.rttUid = urlParams.get("rttUid");
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
  $("#captions").attr("disabled", false);
  $("#subscribe").attr("disabled", false);
  $("#unsubscribe").attr("disabled", false);
  $("#start-trans").attr("disabled", false);
  $("#query-trans").attr("disabled", true);
  $("#stop-trans").attr("disabled", true);
  try {
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "live",
        codec: "vp8",
        role: "audience"
      });
    }

    if (!rttClient) {
      rttClient = AgoraRTC.createClient({
        mode: "live",
        codec: "vp8",
        role: "audience"
      });
    }

    options.channel = $("#channel").val();
    options.uid = $("#uid").val();
    if (isNaN(options.uid)) {
      console.log('uid is string');
      options.uid = String(options.uid);
    } else {
      console.log('uid is int');
      options.uid = Number(options.uid);
    }
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.rttToken = $("#token2").val();
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


$("#leave").click(function (e) {
  leave();
});
$(".uid-list").delegate("a", "click", function (e) {
  changeTargetUID(this.getAttribute("label"));
});
$("#subscribe").click(function (e) {
  manualSub();
});
$("#unsubscribe").click(function (e) {
  manualUnsub();
});
$("#captions").click(function (e) {
  switchCaptions();
});
//transcription buttons
$("#start-trans").click(async function (e) {
  e.preventDefault();
  const appId = options.appid;
  const channel = options.channel;
  if (!appId || !channel) {
    $("#rtc-alert").show();
    throw new Error("appid or channel is empty");
  }
  try {
    let response = await startTranscription()
    console.log(response);
  //If I log the output of the start to the console, the button changes below don't work;
    $("#start-trans").attr("disabled", true);
    $("#query-trans").attr("disabled", false);
    $("#stop-trans").attr("disabled", false);
  } catch (err) {
    $("#parameters-alert").show();
  }
});
$("#query-trans").click(function (e) {
  e.preventDefault();
  queryTranscription();
});
$("#stop-trans").click(function (e) {
  e.preventDefault();
  response = stopTranscription();
  $("#start-trans").attr("disabled", false);
  $("#query-trans").attr("disabled", true);
  $("#stop-trans").attr("disabled", true);
});

async function manualSub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  await subscribe(user, "video");
  await subscribe(user, "audio");
}

async function manualUnsub() {
  //get value of of uid-input
  const id = $(".uid-input").val();
  let user = remoteUsers[id];
  await client.unsubscribe(user, "");
  $(`#player-wrapper-${id}`).remove();
}

async function join() {

  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  rttClient.on("stream-message", handleStreammessage);

  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  showPopup(`RTC video/audio client joined to ${options.channel} as ${options.uid}`);

  const videoTrack = await AgoraRTC.createCameraVideoTrack();
  const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
  client.publish([videoTrack, micTrack]);

  options.rttUid = await rttClient.join(options.appid, options.channel, options.token || null, null);
  showPopup(`RTT stream message client joined to ${options.channel} as ${options.rttUid}`);
  rttClientJoined = true;

  localIntUid = client._joinInfo.uid;
  $("#local-player-name").text(`localVideo(String: ${options.uid}, Int: ${localIntUid})`);
  $("#joined-setup").css("display", "flex");
}


function handleStreammessage(msgUid, data) {
  // use protobuf decode data
  const msg = $protobufRoot.lookup("Text").decode(data) || {};
  console.log("handleStreammessage", msg);
  const {
    words,
    data_type,
    trans = [],
    duration_ms,
    uid
  } = msg;
  if (data_type == "transcribe") {
    if (words.length) {
      let isFinal = false;
      let text = "";
      words.forEach(item => {
        if (item.isFinal) {
          isFinal = true;
        }
        text += item?.text;
      });
      addTranscribeItem(uid, text);
      if (isFinal) {
        addToCaptions(text);
        transcribeIndex++;
      }
    }
  } else if (data_type == "translate") {
    if (trans.length) {
      trans.forEach(item => {
        let text = "";
        item?.texts.forEach(v => text += v);
        addTranslateItem(uid, text);
        if (item.isFinal) {
          translateIndex++;
        }
      });
    }
  }
}
function addToCaptions(msg) {
    $("#subtitles").text(msg);
    //$("#remoteCaptions .content").append($item);
  }

function addTranscribeItem(uid, msg) {
  if ($(`#transcribe-${transcribeIndex}`)[0]) {
    $(`#transcribe-${transcribeIndex} .msg`).html(msg);
  } else {
    const $item = $(`<div class="item" id="transcribe-${transcribeIndex}">
    <span class="uid">${uid}</span>:
    <span class="msg">${msg}</span>
  </div>`);
    $("#stt-transcribe .content").prepend($item);
  }
}
function addTranslateItem(uid, msg) {
  if ($(`#translate-${translateIndex}`)[0]) {
    $(`#translate-${translateIndex} .msg`).html(msg);
  } else {
    const $item = $(`<div class="item" id="translate-${translateIndex}">
    <span class="uid">${uid}</span>:
    <span class="msg">${msg}</span>
  </div>`);
    $("#stt-translate .content").append($item);
  }
}


async function leave() {
  remoteUsers = {};
  $("#remote-playerlist").html("");

  remotesArray = [];
  $(".uid-list").empty();
  $(".uid-input").val(``);

  // leave the channel
  await client.leave();
  await rttClient.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#captions").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  $("#subscribe").attr("disabled", true);
  $("#unsubscribe").attr("disabled", true);
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === "video") {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <div class="player-with-rtt">
          <div id="player-${uid}" class="player"></div>
          <div id="remoteCaptions" class="remoteCaptions">
          <p>Remote: ${uid}</p>
          <p id="subtitles"></p>
          <p id="subTranslation"></div>
      </div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === "audio") {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  updateUIDs(id, "add");
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user, mediaType) {
  if (mediaType === "video") {
    const id = user.uid;
    removeItemOnce(remotesArray, id);
    updateUIDs(id, "remove");
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
  }
}

function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

async function switchCaptions() {
 if (rttClientJoined) {
  rttClientJoined = false;
  rttClient.leave();
  $("#remoteCaptions").css("display", "block");
  $("#captions").text(`Show Captions`);
 } else {
  options.rttUid = await rttClient.join(options.appid, options.channel, options.token || null, null);
  rttClientJoined = true;
  showPopup(`RTT stream message client joined to ${options.channel} as ${options.rttUid}`);
  $("#remoteCaptions").css("display", "none");
  $("#captions").text(`Hide Captions`);
 }
};

//STT variables
var gatewayAddress = "https://api.agora.io";
let taskId = '';
let tokenName = '';

function GetAuthorization() {
  const customerKey = $("#key").val();
  const customerSecret = $("#secret").val();
  if (!customerKey || !customerSecret) {
    console.log("empty auth info");
    $("#modalMessage span").text(`Fill in the customerID and secret in the advanced settings, FOO!`);
    $("#modal").css("display", "block");
    modal.showModal();
    return "";
  }
  const authorization = `Basic ` + btoa(`${customerKey}:${customerSecret}`);
  console.log("got auth info")
  return authorization;
}

async function acquireToken() {
  const url = `${gatewayAddress}/v1/projects/${options.appid}/rtsc/speech-to-text/builderTokens`;
  const data = {
    instanceId: options.channel
  };
  let res = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Authorization": GetAuthorization()
    },
    body: JSON.stringify(data)
  });
  if (res.status == 200) {
    res = await res.json();
    console.log()
    return res;
  } else {
    // status: 504
    // please enable the realtime transcription service for this appid
    console.error(res.status, res);
    throw new Error(res);
  }
}
async function startTranscription() {
  const authorization = GetAuthorization();
  if (!authorization) {
    throw new Error("key or secret is empty");
  }
  const data = await acquireToken();
  tokenName = data.tokenName;
  const url = `${gatewayAddress}/v1/projects/${options.appid}/rtsc/speech-to-text/tasks?builderToken=${tokenName}`;
  const pullUid = $("#puller-uid").val();
  const pullToken = $("#puller-token").val();
  const pushUid = $("#pusher-uid").val();
  const pushToken = $("#pusher-token").val();
  const speakingLanguage = $("#speaking-language").val();
  const translationLanguage = $("#translation-language").val();
  const s3Bucket = $("#s3-bucket").val();
  const s3AccessKey = $("#s3-access-key").val();
  const s3SecretKey= $("#s3-secret-key").val();
  const s3Vendor = parseInt($("#s3-vendor").val());
  const s3Region = parseInt($("#s3-region").val());
  const s3FileNamePrefix = $("#s3-fileNamePrefix").val();
  
    let body = {
      "languages": [
        speakingLanguage
      ],
      "maxIdleTime": 60,
      "rtcConfig": {
          "channelName": options.channel,
          "subBotUid": pullUid,
          "pubBotUid": pushUid,
      }
    };
    if (s3Bucket != "") {
      body.captionConfig =
            {
              "storage":{
                  "accessKey": s3AccessKey,
                  "secretKey": s3SecretKey,
                  "bucket": s3Bucket,
                  "vendor": s3Vendor,
                  "region": s3Region
              }
            };
     }   
//"subBotToken": pullToken, "pubBotToken": pushToken,
     if (pullToken || pushToken) {
        body.rtcConfig = {...body.rtcConfig
          ,
          "subBotToken": pullToken, 
          "pubBotToken": pushToken
        }
     }

    if (s3FileNamePrefix) {
      body.captionConfig.storage = {
        ...body.captionConfig.storage,fileNamePrefix: [
            s3FileNamePrefix
        ]
      }
    }
  if (translationLanguage) {
    body.translateConfig = {
      "languages": [{
        "source": speakingLanguage,
        "target": [translationLanguage]
      }]
    };
  }
  let res = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Authorization": authorization
    },
    body: JSON.stringify(body)
  });
  res = await res.json();
  taskId = res.taskId;
  return res;
}
async function queryTranscription() {
  if (!taskId) {
    return
  }
  const url = `${gatewayAddress}/v1/projects/${options.appid}/rtsc/speech-to-text/tasks/${taskId}?builderToken=${tokenName}`;
  await fetch(url, {
    method: 'GET',
    headers: {
      "Content-Type": "application/json",
      "Authorization": GetAuthorization()
    }
})
  .then(response => response.json())
    .then(json => {
      console.log(json);
    }
  );
  // Log output from get in console json {createTs, status, and taskId}
}
async function stopTranscription() {
  if (!taskId) {
    return;
  }
  const url = `${gatewayAddress}/v1/projects/${options.appid}/rtsc/speech-to-text/tasks/${taskId}?builderToken=${tokenName}`;
  let res = await fetch(url, {
    method: 'DELETE',
    headers: {
      "Content-Type": "application/json",
      "Authorization": GetAuthorization()
    }
  });
  taskId = null;
}