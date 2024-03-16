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
const loggerBox = document.getElementById("log");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");

const sendPeerMessageButton = document.getElementById("send_peer_message");

const createGroupButton = document.getElementById("createGroup");
const joinGroupButton = document.getElementById("joinGroup");
const leaveGroupButton = document.getElementById("leaveGroup");
const destroyGroupButton = document.getElementById("destroyGroup");
const getPublicGroupsButton = document.getElementById("getPublicGroups");
const getJoinedGroupsButton = document.getElementById("getJoinedGroups");

//log to log div
function logger(line) {
    loggerBox.appendChild(document.createElement('div')).append(line);
}

// Register listening events
WebIM.conn.addEventHandler('connection&message', {
    onConnected: () => {
        logger("Connect success !");
    },
    onDisconnected: () => {
        logger("Logout success !");
    },
    onTextMessage: (message) => {
        console.log(message)
        logger("Message from: " + message.from + " Message: " + message.msg);
    },
    onTokenWillExpire: (params) => {
        logger("Token is about to expire");
        refreshToken()
    },
    onTokenExpired: (params) => {
        logger("The token has expired, please login again.");
    },
    onError: (error) => {
        console.log('on error', error);
    }
});

// Button behavior definition

// login
loginButton.addEventListener("click", () => {
    storage.username = document.getElementById("userID").value.toString();
    if (storage.username) {
        console.log(`login started as ${storage.username}`);
        logger(`Logging in as ${storage.username}...`);
        $.when(getTokens()).then(function(){
            WebIM.conn.open({
                user: storage.username,
                agoraToken: storage.token
            }).then((res) => {
                console.log('logged in');
                logger(`Login success!`);
            }).catch((err) => {
                console.log('log in failed', err);
                logger(`Login failed as ${storage.username}, check console!`);
            })
        })  
    } else {
        console.log('username field is empty or undefined, login canceled');
        logger("Please check the Username field, not attempting login.");
    }   
});

// logout
logoutButton.addEventListener("click", () => {
    WebIM.conn.close();
    logger("Logging Out.");
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
        logger("Message send to: " + peerId + " Message: " + peerMessage);
    }).catch((err) => {
        console.log('send private text fail', err);
    })
});


//Chat Group stuff
//create chat group
createGroupButton.addEventListener("click", () => {
    const groupName = document.getElementById("groupName").value.toString();
    if (groupName) {
        console.log("creating chatGroup: " + groupName);  
    let options = {
        data: {
            groupname: groupName,
            desc: "A description of a group",
            public: true,
            approval: false,
            allowinvites: true,
            inviteNeedConfirm: false,
            maxusers: 500
        },
    };

    WebIM.conn.createGroup(options)
    .then((res) => {
        console.log(`created chat group ${groupName} as groupid ${res.data.groupid}`);
        const groupId = res.data.groupid;
        $("#groupID").val(groupId);
        logger(`${groupName} (${groupId}) has been created!`);
        }).catch((err) => {
            console.log('create group chat failed', err);
            logger(`failed to create Chat Group ${groupName}, check console for error;`);
        })
    } else {
        console.log("create group failed - groupname cannot be empty");
        logger('Please input a Chat Group Name.');
    }
});

//join chat group
joinGroupButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    let options = {
        groupId: groupId,
        message: 'Join Group Request From ' + storage.username 
    }

    WebIM.conn.joinGroup(options).then((res) => {
        console.log(`join group ${res.data.id} for ${res.data.user} result ${res.data.result}.`);
        logger(`User ${res.data.user} has joined Chat Group ${res.data.id}`)
    }).catch((err) => {
        console.log(`joining ${groupId} failed`, err);
        logger(`Unable to join Chat Group ${groupId}!`);
    })
});

//leave chat group
leaveGroupButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    let options = {
        groupId: groupId
    };
    WebIM.conn.leaveGroup(options).then((res) => {
        console.log(`left group ${groupId} with ` + res.data.result);
        logger(`${storage.username} has left the group ${groupId}.`);
    }).catch((err) => {
        console.log('leave group chat failed', err);
        logger(`Failed to leave group ${groupId}, check console for error`);
    })
})

//destroy chat group
destroyGroupButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    console.log("destroy group " + groupId);
    let options = {
        groupId: groupId
    };
    WebIM.conn.destroyGroup(options).then((res) => {
        console.log(`group ${res.data.id} destroyed ${res.data.success}`);
        logger(`${res.data.id} has been destroyed.`);
        $("#groupID").val("");
    }).catch((err) => {
        console.log(`destroy chat group ${groupId} failed`, err);
        logger(`Failed to destroy group ${groupId}, check console for error`);
    })
});

//get public chat rooms and owners

/** not interesting way, comparing an i count of length of public group length to number of times group owner is logged to output 'after' all requests have been received and processed. Should be a way to do this with Promise.all, so that resolve condition is all promises fired to get group owner have resolved to output final count and confirmation
*/

getPublicGroupsButton.addEventListener("click", () => {
    console.log("get groups start"); 
    logger('Fetching Public Groups...') ;
    let options = {limit: 50, cursor: null};
    WebIM.conn.getPublicGroups(options)
    .then((res) => {
        console.log('public group list retrieved');
        const count = res.data.length;
        let i = 0;
        res.data.forEach((item) => {
            let str = "";
            WebIM.conn.getGroupInfo({groupId: item.groupid})
            .then((res) => {
                console.log(`group owner for ${res.data[0].id} retrieved`);
                const groupOwner = res.data[0].owner;
                str += '\n'+ JSON.stringify({
                    groupname: item.groupname,
                    groupid: item.groupid,
                    groupOwner: groupOwner
                });
                logger(str);
                i++;
                if (i == count) {
                    logger(`Public Groups have been fetched (${count} total).`);
                } else if (i > count) {
                    logger('WARN: logged group rows greated than returned groups');
                }
            })
        });
    }).catch((err) => {
        console.log('fetching groups failed', err);
    })
});


// token stuff
//get token using username
async function getTokens() {
    console.log('getting token...');
    const localTokenUrls = {
        host: "https://3-140-200-204.nip.io/aleksey",
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
            "expire": 900 
            })});
      const response = await res.json();
      console.log("chat token fetched from server: ", response.token);
      storage.token = response.token;
    } catch (err) {
      console.log(err);
    }
}

//refresh token using username
function refreshToken() {
    getTokens()
    .then(() => console.log("new token retrieved " + storage.token))
    .then(WebIM.conn.renewToken(storage.token))
    .then((res) => {
        logger(`Token renewed - Expire: ${res.expire} - Status: ${res.status}`);
    });
};