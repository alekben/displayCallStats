var username, password
conn = new WebIM.connection({
    appKey: "41155833#993682",
})

var storage = {
    token: null,
    tokenReturned: false
}
//easemob appkey appKey: "41117440#383391"
//my appkey: 41155833#993682
//get elements:

const logger = document.getElementById("log");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const sendPeerMessageButton = document.getElementById("send_peer_message");
const joinGroupButton = document.getElementById("joinGroup");
const createChatGroupButton = document.getElementById("create_chat_group");
const destroyChatGroupButton = document.getElementById("destroy_chat_group");
const joinChatGroupButton = document.getElementById("join_chat_group");
const leaveChatGroupButton = document.getElementById("leave_chat_group");
const sendChatGroupMessageButton = document.getElementById("send_group_message");
const getChatGroupMessageHistoryButton = document.getElementById("getChatGroupMessageHistory");
const getPublicGroupsButton = document.getElementById("getPublicGroups");

// Register listening events
conn.addEventHandler('connection&message', {
    onConnected: () => {
        logger.appendChild(document.createElement('div')).append("Connect success !")
    },
    onDisconnected: () => {
        logger.appendChild(document.createElement('div')).append("Logout success !")
    },
    onTextMessage: (message) => {
        console.log(message)
        logger.appendChild(document.createElement('div')).append(message.from + ": " + message.msg)
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
})

/* Obtain and set the Agora token again - easemob appkey*/
function refreshToken(username, password) {
    postData('https://3-140-200-204.nip.io/frank', { "userAccount": username, "userPassword": password })
        .then((res) => {
            let agoraToken = res.accessToken
            conn.renewToken(agoraToken)
            logger.appendChild(document.createElement('div')).append("Token has been updated")
        })
}

function postData(url, data) {
    return fetch(url, {
        body: JSON.stringify(data),
        cache: 'no-cache',
        headers: {
            'content-type': 'application/json'
        },
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        referrer: 'no-referrer',
    })
        .then(response => response.json())
}

// token stuff
async function getTokens() {
    const localTokenUrls = {
        host: "https://3-140-200-204.nip.io/frank",
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
            "uid": username,
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

// Button behavior definition
// register
document.getElementById("register").onclick = function () {
    username = document.getElementById("userID").value.toString()
    password = document.getElementById("password").value.toString()
    postData('https://a41.chat.agora.io/app/chat/user/register', { "userAccount": username, "userPassword": password })
        .then((res) => {
            logger.appendChild(document.createElement('div')).append(`register user ${username} success`)
        })
        .catch((res)=> {
            logger.appendChild(document.createElement('div')).append(`${username} already exists`)
        })
}
// login
loginButton.addEventListener("click", () => {
    logger.appendChild(document.createElement('div')).append("Logging in...")
    username = document.getElementById("userID").value.toString()
    $.when(getTokens()).then(function(){
        conn.open({
            user: username,
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
/* old stuff
    password = document.getElementById("password").value.toString()
    postData('https://a41.chat.agora.io/app/chat/user/login', { "userAccount": username, "userPassword": password })
        .then((res) => {
            let agoraToken = res.accessToken
            let easemobUserName = res.chatUserName
            conn.open({
                user: easemobUserName,
                agoraToken: agoraToken
            });
        })
        .catch((res)=> {
            logger.appendChild(document.createElement('div')).append(`Login failed`)
        })
});*/

// logout
logoutButton.addEventListener("click", () => {
    conn.close();
    logger.appendChild(document.createElement('div')).append("logout")
});

const groupName = document.getElementById("chat_group_name").value.toString();
var groupId = document.getElementById("groupId").value.toString();

// create chat group
createChatGroupButton.addEventListener("click", () => {
    const groupName = document.getElementById("chat_group_name").value.toString();
    console.log("groupName: " + groupName);
    let option = {
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
    // Call createGroup to create a chat group.
    conn.createGroup(option)
        .then((res) => {
            console.log(res);
            logger.appendChild(document.createElement('div')).innerText = `${groupName} has been created, groupId has been auto populated`;
            var dataObj = res.data.groupid;
            var odIV = document.createElement("div");
            odIV.style.whiteSpace = "pre";
            logger.appendChild(odIV).innerText = 'groupid for peer is ' + dataObj;
            groupId = dataObj;
        })
        .catch((err) => {
            console.error('Create group chat failed', err);
            logger.appendChild(document.createElement('div')).innerText = `Failed to create group ${groupId}, check console for error`;
        });
});

// Call destroyGroup to disband a chat group.
destroyChatGroupButton.addEventListener("click", () => {
    if (!groupId) {
        groupId = document.getElementById("groupId").value.toString();
        destroyChatGroup(groupId)
    }
});

function destroyChatGroup(groupId) {
    console.log("Destroy group " + groupId);
    let option = {
        groupId: groupId
    };
    conn.destroyGroup(option)
        .then((res) => {
            console.log(res);
            logger.appendChild(document.createElement('div')).innerText = `${groupId} has been destroyed`;
            groupId = null;
            $("#groupId").val("");
            console.log("Clearing groupId text box");
        })
        .catch((err) => {
            console.error('Destroy group chat failed', err);
            logger.appendChild(document.createElement('div')).innerText = `Failed to destroy group ${groupId}, check console for error`;
        });
    }

// join chat group
joinChatGroupButton.addEventListener("click", () => {
    // Call joinGroup to send a join request to a chat group.
    if (!groupId) {
        groupId = document.getElementById("groupId").value.toString();
    }
    console.log("join group " + groupId);
    var joinMess = username + " has joined the group " + groupId;
    let options = {
        groupId: groupId,
        message: joinMess
    };
    conn.joinGroup(options).then((res) => {
        console.log(res);
        logger.appendChild(document.createElement('div')).append(joinMess)
    }).catch((err) => {
        console.log('join group chat failed', err),
        logger.appendChild(document.createElement('div')).append(`Failed to join group ${groupId}, check console for error`)
    })
})

// leave group
joinChatGroupButton.addEventListener("click", () => {
    // Call joinGroup to send a join request to a chat group.
    if (!groupId) {
        groupId = document.getElementById("groupId").value.toString();
    }
    console.log("Join group " + groupId);
    var joinMess = username + " has joined the group " + groupId;
    let options = {
        groupId: groupId,
        message: joinMess
    };
    conn.joinGroup(options)
        .then((res) => {
            console.log(res);
            logger.appendChild(document.createElement('div')).innerText = joinMess;
        })
        .catch((err) => {
            console.error('Join group chat failed', err);
            logger.appendChild(document.createElement('div')).innerText = `Failed to join group ${groupId}, check console for error`;
        });
});

// get group chat history
getChatGroupMessageHistoryButton.addEventListener("click", () => {
    if (!groupId) {
        groupId = document.getElementById("groupId").value.toString();
    }

    logger.appendChild(document.createElement('div')).innerText = "...getChatGroupMessageHistory...";

    conn.getHistoryMessages({ targetId: groupId, chatType: "groupChat", pageSize: 20 })
        .then((res) => {
            console.log('getChatGroupMessageHistory success');
            logger.appendChild(document.createElement('div')).innerText = "getChatGroupMessageHistory success";

            let str = '';
            res.messages.forEach((item) => {
                str += '\n' + JSON.stringify({
                    time: item.time,
                    messageId: item.id,
                    messageType: item.type,
                    from: item.from,
                    to: item.to,
                    msg: item.msg,
                });
            });

            var odIV = document.createElement("div");
            odIV.style.whiteSpace = "pre";
            logger.appendChild(odIV).innerText = 'Message History:' + str;
        })
        .catch((err) => {
            console.error('getChatGroupMessageHistory failed', err);
            logger.appendChild(document.createElement('div')).innerText = "getChatGroupMessageHistory failed";
        });
});

// Send a single chat message
sendPeerMessageButton.onclick = function () {
    let peerId = document.getElementById("peerId").value.toString();
    let peerMessage = document.getElementById("peerMessage").value.toString();
    
    let option = {
        chatType: 'singleChat',    // Set it to single chat
        type: 'txt',               // Message type
        to: peerId,                // The user receiving the message (user ID)
        msg: peerMessage           // The message content
    };
    
    let msg = WebIM.message.create(option); 
    conn.send(msg)
        .then((res) => {
            console.log('Send private text success');
            logger.appendChild(document.createElement('div')).innerText = `Message sent to: ${peerId}\nMessage: ${peerMessage}`;
        })
        .catch((err) => {
            console.error('Send private text failed', err);
        });
};


// Send a group chat message
sendChatGroupMessageButton.addEventListener("click", () => {
    if (!groupId) {
        groupId = document.getElementById("groupId").value.toString();
    }
    let groupChatMessage = document.getElementById("groupChatMessage").value.toString()
    let option = {
        chatType: 'groupChat',    // Set it to group chat
        type: 'txt',               // Message type
        to: groupId,                // The user receiving the message (user ID)
        msg: groupChatMessage           // The message content
    }
    console.log("send group message to group " + groupId + "\nmessage: " + groupChatMessage)
    let msg = WebIM.message.create(option); 
    conn
        .send(msg)
        .then((res) => {
            console.log('Group chat text successfully');
            logger
                .appendChild(document.createElement('div'))
                .innerText = `Message sent to group: ${groupId}\n${username}: ${groupChatMessage}`
        }).catch((err) => {
            console.log('Failed to send group chat text', err),
            logger
                .appendChild(document.createElement('div'))
                .innerText = `Failed to send message, GroupId empty =>${groupId}, Check console for full error`
        })
});

// get public groups
getPublicGroupsButton.addEventListener("click", () => {
    logger.appendChild(document.createElement('div')).innerText = "...getPublicGroups...";

    conn.getPublicGroups({limit: 200, cursor: null})
    .then((res) => {
            console.log('getPublicGroups success');
            logger.appendChild(document.createElement('div')).innerText = "getPublicGroups success";

            let str = '';
            var ctr = 0;
            res.data.forEach((item) => {
                str += '\n' + JSON.stringify({
                    groupid: item.groupid,
                    groupname: item.groupname
                });
                ctr++;
            });
            console.log("Counter - " + ctr)
            var odIV = document.createElement("div");
            odIV.style.whiteSpace = "pre";
            logger.appendChild(odIV).innerText = 'Public group:' + str;
        })
        .catch((err) => {
            console.error('getPublicGroups failed', err);
            logger.appendChild(document.createElement('div')).innerText = "getPublicGroups failed";
        });
});