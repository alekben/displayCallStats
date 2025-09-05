//login tracking var
timeStart = 0;

// Params for login
let options = {
    uid: "",
    token: ""
}

let state = {
  client: false,
  loggedin: false,
  subscribed: false,
}

const { RTM, setParameter } = AgoraRTM;
AgoraRTM.setParameter("ENABLE_EDGE_AUTO_FALLBACK", false);
AgoraRTM.setParameter("DISABLE_PRESENCE", true);


var rtmClient;

var rtmConfig = {
  //2.1.x or below
  //token : null,
  presenceTimeout : 30,
  logUpload : false,
  logLevel : "debug",
  cloudProxy : false,
  useStringUserId : true,
  //encryptionMode: "AES_128_GCM",
  //cipherKey: "",
  //salt: ""
};

// Your app ID
let appID = "";


function setupListners () {
    // Client Event listeners
    // Display messages from peer

    rtmClient.addEventListener("message", event => {
        document.getElementById("log").appendChild(document.createElement('div')).append("Message from: " + event.publisher + " Message: " + event.message)
      });
      // Connection State Change
      rtmClient.addEventListener("linkState", event => {
        document.getElementById("log").appendChild(document.createElement('div')).append(`SIGNALING: LinkState changed To: ${event.currentState} Reason: ${event.reason}`);
        if (event.reason == "Login success") {
          const d = new Date();
          time2 = d.getTime();
          const timeTaken = time2 - timeStart;
          document.getElementById("log").appendChild(document.createElement('div')).append(`SIGNALING: LoginSuccess at ${event.timestamp}, time taken ${timeTaken}ms`);
        }
        if (event.reason == "Login timeout") {
          document.getElementById("log").appendChild(document.createElement('div')).append(`SIGNALING: LoginTimeout at ${event.timestamp}, trying force proxy.`);
          setTimeout(forceProxy, 500);
        }
      });
      // Token Privilege Will Expire
      rtmClient.addEventListener("tokenPrivilegeWillExpire", (channelName) => {
        document.getElementById("log").appendChild(document.createElement('div')).append(`SIGNALING: Token will expire for ${channelName}`)
      });
}

async function forceProxy() {
  await rtmClient.logout();
  state.loggedin = false;
  console.log(state);
  rtmClient = "";
  state.client = false;
  state.subscribed = false;
  rtmConfig.cloudProxy = true;
  try {
    rtmClient = new RTM(appID, options.uid, rtmConfig); 
  } catch (status) {
    console.log(status); 
    console.log(state);
  } finally {
    state.client = true;
  };
  setupListners();
  try {
    const result = await rtmClient.login({token: options.token});
    console.log(result);
    console.log(state);
  } catch (status) {
    console.log(status);
  } finally {
    state.loggedin = true;
  };
}


// Button behavior
window.onload = function () {

    // Buttons
    // login

    document.getElementById("start").onclick = async function () {
        appID = document.getElementById("appid").value.toString();
        options.uid = document.getElementById("userID").value.toString();
        if (!state.client) {
          try {
            rtmClient = new RTM(appID, options.uid, rtmConfig); 
            } catch (status) {
                console.log(status); 
                console.log(state);
            } finally {
              state.client = true;
            };
        setupListners() 
        } else {
          console.log("SIGNALING: client status already true");
          document.getElementById("log").appendChild(document.createElement('div')).append("SIGNALING: client status already true");
        }

    }

    document.getElementById("startLogin").onclick = async function () {
        appID = document.getElementById("appid").value.toString();
        options.uid = document.getElementById("userID").value.toString();
        options.token = document.getElementById("token").value.toString();

        rtmConfig.cloudProxy = false;

        const d = new Date();
        timeStart = d.getTime();
        document.getElementById("log").appendChild(document.createElement('div')).append(`SIGNALING: login start at ${timeStart}`);
        if (!state.client) {
          try {
            rtmClient = new RTM(appID, options.uid, rtmConfig); 
            } catch (status) {
            console.log(status); 
            console.log(state);
            } finally {
              state.client = true;
            };
        setupListners();
        } else {
          console.log("SIGNALING: client status already true");
          document.getElementById("log").appendChild(document.createElement('div')).append("SIGNALING: client status already true");
        }

        if (!state.loggedin) {
          try {
            const result = await rtmClient.login({token: options.token});
            console.log(result);
            console.log(state);
          } catch (status) {
          console.log(status);
          } finally {
            state.loggedin = true;
          };
        } else {
          console.log("SIGNALING: client logged in already true");
          document.getElementById("log").appendChild(document.createElement('div')).append("SIGNALING: client logged in already true");
        }
    }


    document.getElementById("login").onclick = async function () {
        options.token = document.getElementById("token").value.toString() 
        if (!state.loggedin) {
          try {
            const result = await rtmClient.login({token: options.token});
            console.log(result);

            console.log(state);
          } catch (status) {
            console.log(status);
          } finally {
            state.loggedin = true;
          };
        } else {
          console.log("SIGNALING: client logged in already true");
          document.getElementById("log").appendChild(document.createElement('div')).append("SIGNALING: client logged in already true");
        }
    }

    // logout
    document.getElementById("logout").onclick = async function () {
      if (state.loggedin) {
        await rtmClient.logout();
        state.loggedin = false;
        state.subscribed = false;
        console.log(state);
      } else {
        console.log("SIGNALING: client logged in already false");
        document.getElementById("log").appendChild(document.createElement('div')).append("SIGNALING: client logged in already false");
      }

    }

    document.getElementById("logoutNull").onclick = async function () {
      if (state.loggedin) {
        await rtmClient.logout();
        state.loggedin = false;
        console.log(state);
        rtmClient = "";
        state.client = false;
        state.subscribed = false;
      } else {
        console.log("SIGNALING: client logged in already false");
        document.getElementById("log").appendChild(document.createElement('div')).append("SIGNALING: client logged in already false");
      }
    }

    // create and join channel
    document.getElementById("join").onclick = async function () {

      let channelName = document.getElementById("channelName").value.toString()

        try {
            const result = await rtmClient.subscribe(channelName, {
              withMessage: true,
              withPresence: true, 
              withMetadata: true,
              withLock: false,
            });
            console.log("SIGNALING: rtm channel sub result: ", result.channelName);
            document.getElementById("log").appendChild(document.createElement('div')).append("You have successfully joined channel " + channelName);
            state.subscribed = true;
          } catch (status) {
            console.log(status);
          };
    }

    // leave channel
    document.getElementById("leave").onclick = async function () {

      let channelName = document.getElementById("channelName").value.toString()

        try {
            const result = await rtmClient.unsubscribe(channelName);
            console.log("SIGNALING: rtm channel unsub result: ", result.channelName);
            document.getElementById("log").appendChild(document.createElement('div')).append("You have successfully left channel " + channelName);
            state.subscribed = false;
          } catch (status) {
            console.log(status);
          };
    }

    // send peer-to-peer message
    document.getElementById("send_peer_message").onclick = async function () {

        let peerId = document.getElementById("peerId").value.toString()
        let peerMessage = document.getElementById("peerMessage").value.toString()
        try {
            const result = await rtmClient.publish(peerId, peerMessage, { channelType: "USER"} );
            console.log(result);
        } catch (status) {
            console.log(status);
        }
        document.getElementById("log").appendChild(document.createElement('div')).append("Message sent to: " + peerId + " Message: " + peerMessage)
    }

    // send channel message
    document.getElementById("send_channel_message").onclick = async function () {

        if (state.subscribed) {
          let channelMessage = document.getElementById("channelMessage").value.toString();

          try {
            const result = await rtmClient.publish(channelName, channelMessage, { channelType: "MESSAGE"} );
            console.log(result);
            document.getElementById("log").appendChild(document.createElement('div')).append("Channel Message sent to: " + channelName)
        } catch (status) {
            console.log(status);
        }
        } else {
          alert("Join a channel first!");
        }
    }
}
