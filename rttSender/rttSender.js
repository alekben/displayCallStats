
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

var remoteUsers = {};
var remotesArray = [];

// RTC client for host/audience
if (!client) {
  client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
  });
}

/*
 * On initiation. `client` is not attached to any project or channel for any specific user.
 */
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

let transcribeIndex = 0;
let translateIndex = 0;

$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.uid = urlParams.get("uid");
  if (options.token != null) {
    options.token = options.token.replace(/ /g,'+');
  };
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
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "rtc",
        codec: "vp8"
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
    $("#send").attr("disabled", false);
  }
});


$("#leave").click(function (e) {
  leave();
});
$("#send").click(function (e) {
  sendRtt();
});


async function join() {

  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  client.on("stream-message", handleStreamMessage);

  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  showPopup(`RTC video/audio client joined to ${options.channel} as ${options.uid}`);

  const localIntUid = client._joinInfo.uid;
  $("#local-player-name").text(`localVideo(String: ${options.uid}, Int: ${localIntUid})`);
  $("#joined-setup").css("display", "flex");
}

function handleStreamMessage(msgUid, data) {
  // use protobuf decode data
  const text = Utf8ArrayToStr(data);
  console.log(`handleStreamMessage from ${msgUid}: ${text}`);
  addTranscribeItem(msgUid, text);
}

function handleStreamMessageOff(msgUid, data) {
  // use protobuf decode data
  const msg = $protobufRoot.lookup("Text").decode(data) || {};
  console.log(`handleStreamMessage from ${msgUid}: ${msg}`);
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

  // leave the channel
  await client.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#send").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  console.log("client leaves channel success");
}

function StringToUint8Array(Str)
{
  const result = new Uint8Array(new ArrayBuffer(Str.length));
  for (let i = 0; i < Str.length; i += 1)
  {
    result[i] = Str.charCodeAt(i);
  }
  return result;
}

function Utf8ArrayToStr(array) {
  var out, i, len, c;
  var char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while(i < len) {
  c = array[i++];
  switch(c >> 4)
  { 
    case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
      // 0xxxxxxx
      out += String.fromCharCode(c);
      break;
    case 12: case 13:
      // 110x xxxx   10xx xxxx
      char2 = array[i++];
      out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
      break;
    case 14:
      // 1110 xxxx  10xx xxxx  10xx xxxx
      char2 = array[i++];
      char3 = array[i++];
      out += String.fromCharCode(((c & 0x0F) << 12) |
                     ((char2 & 0x3F) << 6) |
                     ((char3 & 0x3F) << 0));
      break;
  }
  }

  return out;
}

async function sendRtt() {
  const msg = $("#message").val();
  const rttArray = StringToUint8Array(msg);
  client.sendStreamMessage(rttArray);
}

async function sendRttOff() {
  const msg = $("#message").val();
  const split_msg = msg.split(" ");
  const word_array = [];
  for (let i = 0; i < split_msg.length; i += 1)
  {
    word_array[i] = {text: split_msg[i]};
  }

  const rttData = {
    data_type: "transcribe",
    duration_ms: 500,
    offtime: 300,
    trans: [],
    uid: options.uid,
    words: word_array
  };

  const base64 = window.btoa(rttData);
  const rttArray = base64ToUint8Array(base64);
  client.sendStreamMessage(rttArray);
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  if (mediaType === "video") {
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  const player = $(`
      <div id="player-wrapper-${uid}">
        <div class="player-with-rtt">
          <div id="player-${uid}" class="player"></div>
          <div id="remoteCaptions" class="remoteCaptions">
          <p>Remote: ${uid}</p>
          <p id="subtitles"></p></div>
      </div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user, mediaType) {
  if (mediaType === "video") {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
  }
}