import WebIM from 'agora-chat'
var username, password
WebIM.conn = new WebIM.connection({
    appKey: "41117440#383391",
})
// Register listening events
WebIM.conn.addEventHandler('connection&message', {
    onConnected: () => {
        document.getElementById("log").appendChild(document.createElement('div')).append("Connect success !")
    },
    onDisconnected: () => {
        document.getElementById("log").appendChild(document.createElement('div')).append("Logout success !")
    },
    onTextMessage: (message) => {
        console.log(message)
        document.getElementById("log").appendChild(document.createElement('div')).append("Message from: " + message.from + " Message: " + message.msg)
    },
    onTokenWillExpire: (params) => {
        document.getElementById("log").appendChild(document.createElement('div')).append("Token is about to expire")
        refreshToken(username, password)
    },
    onTokenExpired: (params) => {
        document.getElementById("log").appendChild(document.createElement('div')).append("The token has expired, please login again.")
    },
    onError: (error) => {
        console.log('on error', error)
    }
})

// Obtain and set the Agora token again
function refreshToken(username, password) {
    postData('https://a41.chat.agora.io/app/chat/user/login', { "userAccount": username, "userPassword": password })
        .then((res) => {
            let agoraToken = res.accessToken
            WebIM.conn.renewToken(agoraToken)
            document.getElementById("log").appendChild(document.createElement('div')).append("Token has been updated")
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

// Button behavior definition
// register
document.getElementById("register").onclick = function () {
    username = document.getElementById("userID").value.toString()
    password = document.getElementById("password").value.toString()
    postData('https://a41.chat.agora.io/app/chat/user/register', { "userAccount": username, "userPassword": password })
        .then((res) => {
            document.getElementById("log").appendChild(document.createElement('div')).append(`register user ${username} success`)
        })
        .catch((res)=> {
            document.getElementById("log").appendChild(document.createElement('div')).append(`${username} already exists`)
        })
}
// login
document.getElementById("login").onclick = function () {
    document.getElementById("log").appendChild(document.createElement('div')).append("Logging in...")
    username = document.getElementById("userID").value.toString()
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
            document.getElementById("log").appendChild(document.createElement('div')).append(`Login failed`)
        })
}

// logout
document.getElementById("logout").onclick = function () {
    WebIM.conn.close();
    document.getElementById("log").appendChild(document.createElement('div')).append("logout")
}

const groupName = document.getElementById("chat_group_name").value.toString();
const groupId = document.getElementById("chat_group_id").value.toString();
// create chat group
document.getElementById("create_chat_group").onclick = function () {
    console.log(groupName);
    let option = {
        data: {
            groupname: groupName,
            desc: "A description of a group",
            // members: ["user1", "user2"],
            // Set the type of a chat group to public. Public chat groups can be searched, and users can send join requests.
            public: true,
            // Join requests must be approved by the chat group owner or chat group admins.
            approval: true,
            // Allow chat group members to invite other users to join the chat group.
            allowinvites: true,
            // Group invitations must be confirmed by invitees.
            inviteNeedConfirm: true,
            // Set the maximum number of users that can be added to the group.
            maxusers: 500
        },
    };
    // Call createGroup to create a chat group.
    var response;
    WebIM.conn.createGroup(option).then((res) => console.log(res));
    /*const response = res.json();
    var obj = JSON.parse(response);
    groupId = obj.data.groupId;*/
    console.log("create group " + groupId);
}
document.getElementById("destroy_chat_group").onclick = function () {
    // Call destroyGroup to disband a chat group.
    const groupId = document.getElementById("chat_group_id").value.toString();
    console.log("destroy group " + groupId);
    let option = {
        groupId: groupId
    };
    WebIM.conn.destroyGroup(option).then((res) => console.log(res))
}
// join chat group
document.getElementById("join_chat_group").onclick = function () {
    // Call joinGroup to send a join request to a chat group.
    const groupId = document.getElementById("chat_group_id").value.toString();
    console.log("join group " + groupId);
    var joinMess = username + " has joined the group";
    let options = {
        groupId: groupId,
        message: joinMess
    };
    WebIM.conn.joinGroup(options).then(res => console.log(res))
}
// leave group
document.getElementById("leave_chat_group").onclick = function () {
    // Call memberAbsence to leave a chat group.
    const groupId = document.getElementById("chat_group_id").value.toString();
    let option = {
        groupId: groupId
    };
    WebIM.conn.leaveGroup(option).then(res => console.log(res))
    }

    document.getElementById("chatGroupMessage").onclick = function () {
        const groupId = document.getElementById("chat_group_id").value.toString();
        document.getElementById("log").appendChild(document.createElement('div')).append("getChatGroupMessage...")
        WebIM.conn.getHistoryMessages({ targetId: groupId, chatType:"groupChat", pageSize: 20 }).then((res) => {
            console.log('getChatGroupMessage success')
            document.getElementById("log").appendChild(document.createElement('div')).append("getChatGroupMessage success")
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
            document.getElementById("log").appendChild(odIV).append('chatGroupMessage:', str)
        }).catch(() => {
            document.getElementById("log").appendChild(document.createElement('div')).append("getChatGroupMessage failed")
        })
    }

// Send a single chat message
document.getElementById("send_peer_message").onclick = function () {
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
        document.getElementById("log").appendChild(document.createElement('div')).append("Message send to: " + peerId + " Message: " + peerMessage)
    }).catch((err) => {
        console.log('send private text fail', err);
    })
}

// Send a group chat message
document.getElementById("send_group_message").onclick = function () {
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
        document.getElementById("log").appendChild(document.createElement('div')).append("Message send to: " + groupId + " Message: " + groupChatMessage)
    }).catch((err) => {
        console.log('group chat text fail', err);
    })
}