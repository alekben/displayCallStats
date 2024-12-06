
var client;
AgoraRTC.enableLogUpload();

var remoteUsers = {};
var remotesArray = [];
var clonedTracks = {};

var timeStart = 0;

var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null,
  autoclone: false
};

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
  options.uid = urlParams.get("uid");
  options.autoclone = urlParams.get("autoclone");
  if (options.autoclone == null) {options.autoclone = false} else {options.autoclone = true; document.getElementById("autoclone").checked = true};
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
  $("#subscribe").attr("disabled", false);
  $("#unsubscribe").attr("disabled", false);
  $("#autoclone").attr("disabled", true);
  try {
    if (!client) {
      client = AgoraRTC.createClient({
        mode: "live",
        codec: "vp8"
      });
    }
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    client.setClientRole("audience");
    if (document.getElementById("autoclone").checked == true) {
      options.autoclone = true;
    } else { options.autoclone = false};  
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
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null);
}

async function leave() {
  remoteUsers = {};
  $("#remote-playerlist").html("");

  remotesArray = [];
  $(".uid-list").empty();
  $(".uid-input").val(``);

  clonedTracks = {};
  // leave the channel
  await client.leave();
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  $("#subscribe").attr("disabled", true);
  $("#unsubscribe").attr("disabled", true);
  $("#autoclone").attr("disabled", false);
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === "video") {
    const d = new Date();
    timeStart = d.getTime();
    const player = $(`
    <div id="player-wrapper-${uid}">
    <div class="container-controls">
      <p style="display: inline-block;float: left">remoteUser(${uid})</p>
      <p id="renderTime-${uid}" style="display: inline-block;float: left;padding-left:30px">Time to render:</p>
      <button id="clone-${uid}" type="button" class="btn btn-primary btn-sm" style="display: inline-block;float: right;padding-right:10px">Clone and Play</button>
      <p id="renderTime-${uid}-cloned" style="display: inline-block;float: right;padding-right:30px">Time to render:</p>
    </div> 
    <div id="players" class="players">
    <div id="player-${uid}" data-size-variant="sm" class="player"></div>
    <div id="player-${uid}-cloned" data-size-variant="sm" class="player-cloned"></div>
    </div>
  </div>
    `);
    $("#remote-playerlist").append(player);
    trackid = user.videoTrack._userId;

  //  user.videoTrack.on("first-frame-decoded", function () {
  //    const d2 = new Date();
  //    let time2 = d2.getTime();
  //    console.log(`remote track for ${this.uid} has decoded at ${time2}`);
  //    let timeTaken = time2 - timeStart;
  //    console.log(`clone track for ${this.uid} took ${timeTaken} to decode`);
  //    $(`#decodeTime-${this.uid}`).text(`Time to decode: ${timeTaken}ms`);
  //  }.bind(user));

    //user.videoTrack.on("video-state-changed", function (reason) {
    //  if (reason == 2) {
    //    const d2 = new Date();
    //    let time2 = d2.getTime();
    //    console.log(`remote track for ${this.uid} video state changed playing at ${time2}`);
    //    let timeTaken = time2 - timeStart;
    //    console.log(`remote track for ${this.uid} took ${timeTaken} to change state to playing`);
    //    //$(`#renderTime-${this.uid}`).text(`Time to render: ${timeTaken}ms`);
    //  }
    //}.bind(user));

    $(`#clone-${uid}`).click(() => cloneRemote(uid));
    user.videoTrack.play(`player-${uid}`);

    user.videoTrack._player.videoElement.addEventListener("playing", function () {
      const d2 = new Date();
      let time2 = d2.getTime();
      console.log(`remote track for ${this.uid} playing at ${time2}`);
      let timeTaken = time2 - timeStart;
      console.log(`remote track for ${this.uid} took ${timeTaken} to change state to playing`);
      $(`#renderTime-${this.uid}`).text(`Time to render: ${timeTaken}ms`);
    }.bind(user));

    if (options.autoclone == true) {
      cloneRemote(uid);
    }
  }
  //if (mediaType === "audio") {
  //  user.audioTrack.play();
  //}
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

async function cloneRemote(uid) {
  if (document.getElementById(`clone-${uid}`).innerHTML == "Stop") {
    console.log(`clone stopped for ${uid}`);
    clonedTracks[uid].stop();
    clonedTracks[uid] = "";
    $(`#clone-${uid}`).text("Clone and Play");
    $(`#renderTime-${uid}-cloned`).text(`Time to render:`);
  } else {
    const d = new Date();
    timeStart = d.getTime();
    console.log(`clone triggered for ${uid} at ${timeStart}`);
    const stream = remoteUsers[uid].videoTrack.getMediaStreamTrack();
    clonedTracks[uid] = await AgoraRTC.createCustomVideoTrack({"mediaStreamTrack": stream});
    const id = clonedTracks[uid].getTrackId().split("track-cus-")[1];
    clonedTracks[uid].play(`player-${uid}-cloned`, {"fit": "cover"});
    clonedTracks[uid]._player.videoElement.addEventListener("playing", function () {
      const d = new Date();
      time2 = d.getTime();
      console.log(`cloned track for ${uid} playing at ${time2}`);
      let timeTaken = time2 - timeStart;
      console.log(`cloned track for ${uid} took ${timeTaken} to render`);
      $(`#renderTime-${uid}-cloned`).text(`Time to render: ${timeTaken}ms`);
    });
    $(`#agora-video-player-track-cus-${id}`).css("background-color", "red");
    $(`#clone-${uid}`).text("Stop");
  }
}

async function handleFirstFrame() {
    console.log(`first frame decoded fired`);
    //const d2 = new Date();
    //let time2 = d2.getTime();
    //console.log(`clone track for ${uid} has decoded at ${time2}`);
    //let timeTaken = time2 - timeStart;
    //console.log(`clone track for ${uid} took ${timeTaken} to decode`);
    //$(`#decodeTime-${uid}`).text(`Time to decode: ${timeTaken}ms`);
};

async function handleVideoStateChanged(vstate) {
  console.log(`videostatechanged`);
  //const d2 = new Date();
  //let time2 = d2.getTime();
  //console.log(`clone track for ${uid} has decoded at ${time2}`);
  //let timeTaken = time2 - timeStart;
  //console.log(`clone track for ${uid} took ${timeTaken} to render`);
  //$(`#renderTime-${uid}`).text(`Time to render: ${timeTaken}ms`);
};

async function handleFirstFrameCloned() {
  console.log(`first frame decoded fired`);
  //const d2 = new Date();
  //let time2 = d2.getTime();
  //console.log(`clone track for ${uid} has decoded at ${time2}`);
  //let timeTaken = time2 - timeStart;
  //console.log(`clone track for ${uid} took ${timeTaken} to decode`);
  //$(`#decodeTime-${uid}`).text(`Time to decode: ${timeTaken}ms`);
};

async function handleVideoStateChangedCloned(vstate) {
console.log(`videostatechanged`);
//const d2 = new Date();
//let time2 = d2.getTime();
//console.log(`clone track for ${uid} has decoded at ${time2}`);
//let timeTaken = time2 - timeStart;
//console.log(`clone track for ${uid} took ${timeTaken} to render`);
//$(`#renderTime-${uid}`).text(`Time to render: ${timeTaken}ms`);
};

