const isChrome = (navigator.userAgent.indexOf('Firefox') === -1 && navigator.userAgent.indexOf('Chrome') > -1);

if (isChrome) {
  window.oldRTCPeerConnection = RTCPeerConnection;
  window.RTCPeerConnection = new Proxy(window.RTCPeerConnection, {
    construct: function(target, args) {
      if (args.length > 0) {
        args[0]['encodedInsertableStreams'] = true;
      } else {
        args.push({'encodedInsertableStreams': true});
      }
      let pc = new window.oldRTCPeerConnection(args[0]);
      return pc;
    },
  });
}

// create Agora client
var client = AgoraRTC.createClient({mode: "rtc", codec: "h264"});
const senderChannel = new MessageChannel;
const receiverChannel = new MessageChannel;

let videoSelect = document.querySelector('select#videoSource');
AgoraRTC.getDevices().then(devices => {
  const videoDevices = devices.filter(function(device){
    return device.kind === "videoinput";
  });
  for (let i = 0; i !== videoDevices.length; ++i) {
    const deviceInfo = videoDevices[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
    videoSelect.appendChild(option);
  }
});

var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

let watermarkText = $("#watermark").val();
let lastWatermark = null;

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  if (options.appid && options.channel) {
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
})

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
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
    $("#publish").attr("disabled", false);
  }
})

$("#leave").click(function (e) {
  leave();
})

document.getElementById("watermark").oninput = async function(e) {
  watermarkText = $("#watermark").val();
  if (!isChrome) {
    senderChannel.port1.postMessage({watermark: watermarkText});
  }
};

async function join() {

  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [options.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    localTracks.audioTrack || AgoraRTC.createMicrophoneAudioTrack(),
    localTracks.videoTrack || AgoraRTC.createCameraVideoTrack({cameraId: videoSelect.value, encoderConfig: '720p_1'})
  ]);

  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);

  $("#background-blurring").attr("disabled", false);
  $("#image-uploader").attr("disabled", false);
  $("#btn-color").attr("disabled", false);
  $("#virtual-background-off").attr("disabled", false);

  await publish();
  console.log("publish success");
}

async function leave() {
  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  $("#publish").attr("disabled", true);
  $("#background-blurring").attr("disabled", true);
  $("#image-uploader").attr("disabled", true);
  $("#btn-color").attr("disabled", true);
  $("#virtual-background-off").attr("disabled", true);
  console.log("client leaves channel success");
}

async function publish() {
  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
  $("#publish").attr("disabled", true);

  const pc = __ARTC__.__CLIENT_LIST__[0]._p2pChannel.connection.peerConnection;
  const senders = pc.getSenders();
  let i = 0;
  for(i = 0; i < senders.length; i++) {
    if (senders[i].track?.kind == 'video') {
      break;
    }
  }
  let sender = null;
  if (i < senders.length) {
    sender = senders[i];
  }

  if (isChrome) {
    const streams = sender.createEncodedStreams();
    const textEncoder = new TextEncoder();
    const transformer = new TransformStream({
      transform(chunk, controller) {
        const watermark = textEncoder.encode(watermarkText);
        const frame = chunk.data;
        const data = new Uint8Array(chunk.data.byteLength + watermark.byteLength + 1 + 8);
        data.set(new Uint8Array(frame), 0);
        data.set (watermark, frame.byteLength);
        data[frame.byteLength + watermark.byteLength] = watermark.byteLength;
	//console.log("set custom data length at,custom data length",frame.byteLength + watermark.byteLength,watermark.byteLength);

         // Set magic number at the end
        const magicIndex = frame.byteLength + watermark.byteLength + 1;
        const magicString = 'AgoraWrc';
        for (let i = 0; i < 8; i++) {
          data[magicIndex + i] = magicString.charCodeAt(i);
        }

        chunk.data = data.buffer;
  
        controller.enqueue(chunk);
      }
    });
  
    streams.readable.pipeThrough(transformer).pipeTo(streams.writable);
  } else {
    const worker = new Worker('script-transform-worker.js');
    await new Promise(resolve => worker.onmessage = (event) => {
      if (event.data === 'registered') {
        resolve();
      }
    });

    const senderTransform = new RTCRtpScriptTransform(worker, {name:'outgoing', port: senderChannel.port2}, [senderChannel.port2]);
    senderTransform.port = senderChannel.port1;
    sender.transform = senderTransform;

    await new Promise(resolve => worker.onmessage = (event) => {
      if (event.data === 'started') {
        resolve();
      }
    });

    const watermarkInput = document.getElementById('watermark');
    senderChannel.port1.postMessage({watermark: watermarkInput.value});
  }
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);

    const label = $('<span>').css({'z-index': 1000,
      'position': 'absolute',
      'margin': '5px',
      'font-size': '22pt'});
    $("#remote-playerlist").find(".player").children().append(label);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }

  const pc = __ARTC__.__CLIENT_LIST__[0]._p2pChannel.connection.peerConnection;
  const receivers = pc.getReceivers();
  let i = 0;
  for(i = 0; i < receivers.length; i++) {
    if (receivers[i].track?.kind == 'video') {
      break;
    }
  }
  let receiver = null;
  if (i < receivers.length) {
    receiver = receivers[i];
  }

  if (isChrome) {
    const streams = receiver.createEncodedStreams();
    const textDecoder = new TextDecoder();
    const transformer = new TransformStream({
      transform(chunk, controller) {
        const view = new DataView(chunk.data);

        const magicData = new Uint8Array(chunk.data, chunk.data.byteLength - 8, 8);
        let magic = [];
        for (let i = 0; i < 8; i ++) {
          magic.push(magicData[i]);
        }
        let magicString = String.fromCharCode(...magic);

        if (magicString === 'AgoraWrc') {
          const watermarkLen = view.getUint8(chunk.data.byteLength - (1 + 8));
	  //console.log("watermarkLen ",chunk.data.byteLength, watermarkLen);
	  console.log("chunk.data ",chunk.data);
          const frameSize = chunk.data.byteLength - (watermarkLen + 1 + 8);
    
          const watermarkBuffer = new Uint8Array(chunk.data, frameSize, watermarkLen);
          const watermark = textDecoder.decode(watermarkBuffer)
    
          if (lastWatermark !== watermark) {
            $("#remote-playerlist").find(".player").find("span").text(watermark);
            lastWatermark = watermark;
          }
    
          const frame = chunk.data;
          chunk.data = new ArrayBuffer(frameSize);
          const data = new Uint8Array(chunk.data);
          data.set(new Uint8Array(frame, 0, frameSize));
        }

        controller.enqueue (chunk);
      }
    });
    streams.readable.pipeThrough(transformer).pipeTo(streams.writable);
  } else {
    const worker = new Worker('script-transform-worker.js');
    await new Promise(resolve => worker.onmessage = (event) => {
      if (event.data === 'registered') {
        resolve();
      }
    });

    const receiverTransform = new RTCRtpScriptTransform(worker, {name:'incoming', port: receiverChannel.port2}, [receiverChannel.port2]);
    receiverTransform.port = receiverChannel.port1;
    receiver.transform = receiverTransform;
    receiverTransform.port.onmessage = e => {
      $("#remote-playerlist").find(".player").find("span").text(e.data)
    };

    await new Promise(resolve => worker.onmessage = (event) => {
      if (event.data === 'started') {
        resolve();
      }
    });
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}
