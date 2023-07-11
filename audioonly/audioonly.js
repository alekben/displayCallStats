
let autoplayFailTriggered = false;

var client = AgoraRTC.createClient({
  mode: "live",
  codec: "vp8"
});

var remoteUsers = {};

var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

AgoraRTC.onAutoplayFailed = () => {
  alert("click to start autoplay!");
  autoplayFailTriggered = true;
};

/*
 * When this page is called with parameters in the URL, this procedure
 * attempts to join a Call channel using those parameters.
 */
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

/*
 * When a user clicks Join or Leave in the HTML form, this procedure gathers the information
 * entered in the form and calls join asynchronously. The UI is updated to match the options entered
 * by the user.
 */
$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.channel = $("#channel").val();
    options.uid = Number($("#uid").val());
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
  }
});

/*
 * Called when a user clicks Leave in order to exit a channel.
 */
$("#leave").click(function (e) {
  leave();
});

/*
 * Join a channel, then create local audio tracks and publish them to the channel.
 */
async function join() {
  // Add an event listener to play remote tracks when remote user publishes.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // Join a channel and create local tracks. Best practice is to use Promise.all and run them concurrently.
  client.setClientRole("audience");
  options.uid = await client.join(options.appid, options.channel, options.token || null, options.uid || null)
  $("#joined-setup").css("display", "flex");
}

/*
 * Stop all local and remote tracks then leave the channel.
 */
async function leave() {

  // Remove remote users and player views.
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#joined-setup").css("display", "none");
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  if (mediaType === 'audio') {
    await client.subscribe(user, mediaType);
    console.log(`subscribe to audio of UID ${uid} success`);
    user.audioTrack.play();
    //Autoplay callback will trigger here if there hasn't been any page interaction
    if (autoplayFailTriggered) {
      user.audioTrack.play();
    }
    autoplayFailTriggered = false;
    const audioLabel = $(`
      <div id="audio-${uid}">
        <p>Listening to audio from remoteUser (${uid})</p>
      </div>
    `);
    $("#remote-playerlist").append(audioLabel);
  } else {
    console.log(`${uid} published video, but not subscribing.`);
  }
}


function handleUserPublished(user, mediaType) {
  const id = user.uid;
  if (mediaType === 'audio') {
    remoteUsers[id] = user;
    subscribe(user, mediaType);
    var x = document.getElementById("popup");
    $("#popup").text(`User ${id} published audio`);
    x.className = "show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
  } else {
    console.log(`${uid} published video, but not subscribing.`)
  }
}

function handleUserUnpublished(user, mediaType) {
  if (mediaType === 'audio') {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#audio-${id}`).remove();
    var x = document.getElementById("popup");
    $("#popup").text(`User ${id} unpublished audio`);
    x.className = "show";
    setTimeout(function(){ x.className = x.className.replace("show", ""); }, 3000);
  }
}