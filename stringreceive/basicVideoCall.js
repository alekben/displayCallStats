var client;
var popups = 0;
AgoraRTC.enableLogUpload();
var remoteUsers = {};
var remotesArray = [];
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

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

//AgoraRTC.onAutoplayFailed = () => {
//  alert("click to start autoplay!");
//};

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
  if (action == "remove") {
    console.log("UID should already have been removed, not pushing id.");
  } else {
    remotesArray.push(id);
  }


  //repopulate
  let j = 0;
  while (j < remotesArray.length) {
    $(".uid-list").append(`<a class="dropdown-item" label="${remotesArray[j]}" href="#">${remotesArray[j]}</a>`);
    j++;
  } 
  $(".uid-input").val(`Online user count: ` + remotesArray.length);
}
}


$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  //$("#subscribe").attr("disabled", false);
  //$("#unsubscribe").attr("disabled", false);
  try {
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "live",
        codec: "vp8"
      });
    }
    options.channel = $("#channel").val();
    options.uid = String($("#uid").val());
    options.appid = $("#appid").val();
    options.token = $("#token").val();

    client.setClientRole("audience");


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
$(".uid-list").delegate("a", "click", function (e) {
  changeTargetUID(this.getAttribute("label"));
});
$("#subscribe").click(function (e) {
  manualSub();
});
$("#unsubscribe").click(function (e) {
  manualUnsub();
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
/*
 * Join a channel, then create local video and audio tracks and publish them to the channel.
 */
async function join() {
  // Add an event listener to play remote tracks when remote user publishes.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);
  client.on("user-joined", handleUserJoined);
  client.on("user-left", handleUserLeft);
  client.on("user-info-updated", handleUserInfoUpdated);

  // Join the channel.
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
  $("#joined-setup").css("display", "flex");
  console.log("join success");
}

/*
 * Stop all local and remote tracks then leave the channel.
 */
async function leave() {

  // Remove remote users and player views.
  remoteUsers = {};
  $("#remote-playerlist").html("");

  remotesArray = [];
  $(".uid-list").empty();
  $(".uid-input").val(``);

  // leave the channel
  await client.leave();
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  //$("#subscribe").attr("disabled", true);
  //$("#unsubscribe").attr("disabled", true);
  console.log("client leaves channel success");
}


async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === "video") {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
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
  showPopup(`UID ${id} published ${mediaType}`);
  updateUIDs(id, "add");
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user, mediaType) {
  const id = user.uid;
  if (mediaType === "video") {
    showPopup(`UID ${id} unpublished video`);
    removeItemOnce(remotesArray, id);
    updateUIDs(id, "remove");
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
  } else {
    showPopup(`UID ${id} unpublished audio`);
  }
}

function handleUserJoined(user) {
  const id = user.uid;
  updateUIDs(id, "add");
  showPopup(`UID ${id} Joined as Host`);
}

function handleUserLeft(user) {
  const id = user.uid;
  removeItemOnce(remotesArray, id);
  updateUIDs(id, "remove");
  showPopup(`UID ${id} Offline`);
}

function handleUserInfoUpdated(uid, message) {
  console.log(`User Info Updated for ${uid}, new state is: ${message}`);
  showPopup(`UID ${uid} new state: ${message}`);
}

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


function removeItemOnce(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}