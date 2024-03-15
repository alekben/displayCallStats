var username, password
WebIM.conn = new WebIM.connection({
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
})

/* Obtain and set the Agora token again - easemob appkey
function refreshToken(username, password) {
    postData('https://a41.chat.agora.io/app/chat/user/login', { "userAccount": username, "userPassword": password })
        .then((res) => {
            let agoraToken = res.accessToken
            WebIM.conn.renewToken(agoraToken)
            logger.appendChild(document.createElement('div')).append("Token has been updated")
        })
}*/

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
        WebIM.conn.open({
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
            WebIM.conn.open({
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
    WebIM.conn.close();
    logger.appendChild(document.createElement('div')).append("logout")
});

const groupName = document.getElementById("chat_group_name").value.toString();
const groupId = document.getElementById("chat_group_id").value.toString();
var chatGroupRes = null;

// create chat group
createChatGroupButton.addEventListener("click", () => {
    const groupName = document.getElementById("chat_group_name").value.toString();
    console.log(groupName);
    let option = {
        data: {
            groupname: groupName,
            desc: "A description of a group",
            // members: ["user1", "user2"],
            // Set the type of a chat group to public. Public chat groups can be searched, and users can send join requests.
            public: true,
            // Join requests must be approved by the chat group owner or chat group admins.
            approval: false,
            // Allow chat group members to invite other users to join the chat group.
            allowinvites: true,
            // Group invitations must be confirmed by invitees.
            inviteNeedConfirm: false,
            // Set the maximum number of users that can be added to the group.
            maxusers: 500
        },
    };
    // Call createGroup to create a chat group.
    WebIM.conn.createGroup(option).then((res) => {
        let groupId = res.groupId;
        console.log(groupId)});
    // groupId = chatGroupRes.data.groupId;
    /*const response = res.json();
    var obj = JSON.parse(response);
    groupId = obj.data.groupId;*/
    console.log("create group " + groupId);
});

destroyChatGroupButton.addEventListener("click", () => {
    // Call destroyGroup to disband a chat group.
    const groupId = document.getElementById("chat_group_id").value.toString();
    console.log("destroy group " + groupId);
    let option = {
        groupId: groupId
    };
    WebIM.conn.destroyGroup(option).then((res) => console.log(res))
});

// join chat group
joinChatGroupButton.addEventListener("click", () => {
    // Call joinGroup to send a join request to a chat group.
    const groupId = document.getElementById("chat_group_id").value.toString();
    console.log("join group " + groupId);
    var joinMess = username + " has joined the group";
    let options = {
        groupId: groupId,
        message: joinMess
    };
    WebIM.conn.joinGroup(options).then(res => console.log(res))
});

// leave group
leaveChatGroupButton.addEventListener("click", () => {
    // Call memberAbsence to leave a chat group.
    const groupId = document.getElementById("chat_group_id").value.toString();
    let option = {
        groupId: groupId
    };
    WebIM.conn.leaveGroup(option).then(res => console.log(res))
    });

    // get group chat history
    getChatGroupMessageHistoryButton.addEventListener("click", () => {
        const groupId = document.getElementById("chat_group_id").value.toString();
        logger.appendChild(document.createElement('div')).append("getChatGroupMessageHistory...")
        WebIM.conn.getHistoryMessages({ targetId: groupId, chatType:"groupChat", pageSize: 20 }).then((res) => {
            console.log('getChatGroupMessageHistory success')
            logger.appendChild(document.createElement('div')).append("getChatGroupMessageHistory success")
            let str='';
            res.messages.map((item) => {
                str += '\n'+ JSON.stringify({
                    messageId:item.id,
                    messageType:item.type,
                    from: item.from,
                    to: item.to,
                }) 
            })
            var odIV = document.createElement("div");
            odIV.style.whiteSpace = "pre";
            logger.appendChild(odIV).append('getChatGroupMessageHistory:', str)
        }).catch(() => {
            logger.appendChild(document.createElement('div')).append("getChatGroupMessageHistory failed")
        })
    });

// Send a single chat message
sendPeerMessageButton.onclick = function () {
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
}

// Send a group chat message
sendChatGroupMessageButton.addEventListener("click", () => {
    const groupId = document.getElementById("chat_group_id").value.toString();
    let groupChatMessage = document.getElementById("groupChatMessage").value.toString()
    let option = {
        chatType: 'groupChat',    // Set it to group chat
        type: 'txt',               // Message type
        to: groupId,                // The user receiving the message (user ID)
        msg: groupChatMessage           // The message content
    }
    console.log("send group message to group " + groupId + "\n& message is " + groupChatMessage)
    let msg = WebIM.message.create(option); 
    WebIM.conn.send(msg).then((res) => {
        console.log('group chat text success');
        logger.appendChild(document.createElement('div')).append("Message send to: " + groupId + " Message: " + groupChatMessage)
    }).catch((err) => {
        console.log('group chat text fail', err);
    })
});