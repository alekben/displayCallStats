var storage = {
    username: null,
    password: null,
    token: null,
    tokenReturned: false
}

WebIM.conn = new WebIM.connection({
    appKey: "41450892#535167",
});

//get button elements:
const logger = document.getElementById("log");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const sendPeerMessageButton = document.getElementById("send_peer_message");
const joinGroupButton = document.getElementById("joinGroup");


// Register listening events
WebIM.conn.addEventHandler('connection&message', {
    onConnected: () => {
        logger.appendChild(document.createElement('div')).append("Connect success !")
    },
    onDisconnected: () => {
        logger.appendChild(document.createElement('div')).append("Logout success !")
    },
    onTextMessage: (message) => {
        console.log(message)
        logger.appendChild(document.createElement('div')).append("Message from: " + message.from + " Message: " + message.msg)
    },
    onTokenWillExpire: (params) => {
        logger.appendChild(document.createElement('div')).append("Token is about to expire")
        refreshToken(username, password)
    },
    onTokenExpired: (params) => {
        logger.appendChild(document.createElement('div')).append("The token has expired, please login again.")
    },
    onError: (error) => {
        console.log('on error', error)
    }
});

// Button behavior definition
// login
loginButton.addEventListener("click", () => {
    logger.appendChild(document.createElement('div')).append("Logging in...")
    storage.username = document.getElementById("userID").value.toString()
    $.when(getTokens()).then(function(){
        WebIM.conn.open({
            user: storage.username,
            agoraToken: storage.token
        }).then((res) => {
            console.log('logged in');
            logger.appendChild(document.createElement('div')).append(`Login success`);
        }).catch((er) => {
            console.log('log in failed');
            logger.appendChild(document.createElement('div')).append(`Login failed`);
        })
    })      
});

// logout
logoutButton.addEventListener("click", () => {
    WebIM.conn.close();
    logger.appendChild(document.createElement('div')).append("logout")
});

// Send a single chat message
sendPeerMessageButton.addEventListener("click", () => {
    let peerId = document.getElementById("peerId").value.toString()
    let peerMessage = document.getElementById("peerMessage").value.toString()
    let option = {
        chatType: 'singleChat',    // Set it to single chat
        type: 'txt',               // Message type
        to: peerId,                // The user receiving the message (user ID)
        msg: peerMessage           // The message content
    }
    let msg = WebIM.message.create(option); 
    WebIM.conn.send(msg).then((res) => {
        console.log('send private text success');
        logger.appendChild(document.createElement('div')).append("Message send to: " + peerId + " Message: " + peerMessage)
    }).catch((err) => {
        console.log('send private text fail', err);
    })
});

joinGroupButton.addEventListener("click", () => {

    let option = {
        groupId: document.getElementById("groupId").value.toString(),
        //groupId: "218535221592065",
        message: 'Join Group Request From ' + username 
    }

    WebIM.conn.joinGroup(option).then((res) => {
        console.log('JoinGroup Button Pressed and Joined.');
    }).catch((err) => {
        console.log('Joining Group Failed', err);
    })
});


// token stuff

async function getTokens() {
    const localTokenUrls = {
        host: "https://3-140-200-204.nip.io",
        endpoint: "getToken"
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
            "tokenType": "chat",
            "uid": storage.username,
            "expire": 3600 
            })});
      const response = await res.json();
      console.log("Chat token fetched from server: ", response.token);
      storage.tokenReturned = true;
      storage.token = response.token;
    } catch (err) {
      console.log(err);
    }
}

