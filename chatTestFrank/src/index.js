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
const logGroups = document.getElementById("groups");
const logMessages = document.getElementById("messages");
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
const groupList = document.getElementById("groups");
function appendLogger(line) {
    logger.appendChild(document.createElement('div')).append(line);
}
function prependLogger(line){
    logger.prepend(line)
}
function inlineLogger(line) {
    logMessages.appendChild(document.createElement('div')).innerText = line;
}

// Register listening events
conn.addEventHandler('connection&message', {
    onConnected: () => {
        //$(logger).prepend(`<div>${Date()}Connect success !`)
        prependLogger('<div>Connect success !')
    },
    onDisconnected: () => {
        //$(logger).prepend(`<div>Logout success !`)
        prependLogger('<div>Logout success !')
    },
    onTextMessage: (message) => {
        console.log(message)
        // logMessages.appendChild(document.createElement('div')).innerText = `${message.from}: ${message.msg}`
        line = `${message.from}: ${message.msg}`
    },
    onTokenWillExpire: (params) => {
        $(logger).prepend(`<div>Token is about to expire`)
        refreshToken(username, password)
    },
    onTokenExpired: (params) => {
        $(logger).prepend(`<div>The token has expired, please login again.`)
    },
    onError: (error) => {
        console.log('on error', error)
        $(logger).prepend(`<div>Error`)
    }
})

/* Obtain and set the Agora token again - easemob appkey*/
function refreshToken(username, password) {
    postData('https://3-140-200-204.nip.io/frank', { "userAccount": username, "userPassword": password })
        .then((res) => {
            let agoraToken = res.accessToken
            conn.renewToken(agoraToken)
            $(logger).prepend(`<div>Token has been updated`)
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
            $(logger).prepend(`<div>register user ${username} success`)
        })
        .catch((res)=> {
            $(logger).prepend(`<div>${username} already exists`)
        })
}
// login
loginButton.addEventListener("click", () => {
    $(logger).prepend(`<div>Logging in...`)
    username = document.getElementById("userID").value.toString()
    $.when(getTokens()).then(function(){
        conn.open({
            user: username,
            agoraToken: storage.token
        }).then((res) => {
            console.log('logged in');
            $(logger).prepend(`<div>Login success`);
        }).catch((er) => {
            console.log('log in failed');
            $(logger).prepend(`<div>Login failed`);
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
    $(logger).prepend(`<div>logout`)
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
            $(logger).prepend(`<div>${groupName} has been created, groupId has been auto populated`);
            var dataObj = res.data.groupid;
            var odIV = document.createElement("div");
            odIV.style.whiteSpace = "pre";
            $(logger).prepend(`<div>groupid for peer is ${dataObj}`);
            groupId = dataObj;
        })
        .catch((err) => {
            console.error('Create group chat failed', err);
            $(logger).prepend(`<div>Failed to create group ${groupId}, check console for error`);
        });
});

// Call destroyGroup to disband a chat group.
destroyChatGroupButton.addEventListener("click", () => {
    if (!groupId) {
        groupId = document.getElementById("groupId").value.toString();
        destroyChatGroup(groupId)
        groupId = null;
    }
    destroyChatGroup(groupId)
    groupId = null;
});

function destroyChatGroup(groupId) {
    console.log("Destroy group " + groupId);
    let option = {
        groupId: groupId
    };
    conn.destroyGroup(option)
        .then((res) => {
            console.log(res);
            $(logger).prepend(`<div>${groupId} has been destroyed`);
            groupId = null;
            $("#groupId").val("");
            console.log("Clearing groupId text box");
        })
        .catch((err) => {
            console.error('Destroy group chat failed', err);
            $(logger).prepend(`<div>Failed to destroy group ${groupId}, check console for error`);
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
        $(logger).prepend(`<div>${joinMess}`)
    }).catch((err) => {
        console.log('join group chat failed', err),
        $(logger).prepend(`<div>Failed to join group ${groupId}, check console for error`);
    })
})

// leave group
leaveChatGroupButton.addEventListener("click", () => {
    // Call memberAbsence to leave a chat group.
    if (!groupId) {
        groupId = document.getElementById("groupId").value.toString();
    }
    let option = {
        groupId: groupId
    };
    conn.leaveGroup(option)
        .then((res) => {
            console.log(res);
            $(logger).prepend(`<div>${username} has left the group ${groupId}`);
        })
        .catch((err) => {
            console.error('Leave group chat failed', err);
            $(logger).prepend(`<div>Failed to leave group ${groupId}. Check console for error.`);
        });
});


// get group chat history
getChatGroupMessageHistoryButton.addEventListener("click", () => {
    if (!groupId) {
        groupId = document.getElementById("groupId").value.toString();
    }

    $(logger).prepend(`<div>...getChatGroupMessageHistory...`);

    conn.getHistoryMessages({ targetId: groupId, chatType: "groupChat", pageSize: 20 })
        .then((res) => {
            console.log('getChatGroupMessageHistory success');
            $(logger).prepend(`<div>getChatGroupMessageHistory success`);

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
            logMessages.appendChild(document.createElement('div')).innerText = `Message History: ${str}`;
        })
        .catch((err) => {
            console.error('getChatGroupMessageHistory failed', err);
            $(logger).prepend(`<div>getChatGroupMessageHistory failed`);
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
            $(logger).prepend(`<div>Message sent to: ${peerId}\nMessage: ${peerMessage}`);
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
            $(logger).prepend(`<div>${username} sent message to group ${groupId}`);
            logMessages.appendChild(document.createElement('div')).innerText = `${username}: ${groupChatMessage}`;
        }).catch((err) => {
            console.log('Failed to send group chat text', err),
            $(logger).prepend(`<div>Failed to send message, GroupId empty =>${groupId}, Check console for full error`);
        })
});

/* get public groups - my old way
getPublicGroupsButton.addEventListener("click", () => {
    $(logger).prepend(`<div>getting PublicGroups...`);

    conn.getPublicGroups({limit: 200, cursor: null})
    .then((res) => {
            console.log('getPublicGroups success');
            $(logger).prepend(`<div>getPublicGroups success`);

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
            logGroups.appendChild(document.createElement('div')).innerText = `Public group: ${str}`;
        })
        .catch((err) => {
            console.error('getPublicGroups failed', err);
            $(logger).prepend(`<div>getPublicGroups failed`);
        });
}); 
*/

//get public chat rooms and owners
/* not interesting way, comparing an i count of length of public group length to number of times group owner is logged to output 'after' all requests have been received and processed. Should be a way to do this with Promise.all, so that resolve condition is all promises fired to get group owner have resolved to output final count and confirmation
*/

getPublicGroupsButton.addEventListener("click", () => {
    fetchPublicGroups();
});

function fetchPublicGroups() {
    console.log("get groups start"); 
    prependLogger('Fetching Public Groups...') ;
    let options = {limit: 50, cursor: null};
    conn.getPublicGroups(options)
    .then((res) => {
        console.log('public group list retrieved');
        groupList.innerHTML = "";
        const groupListTable = groupList.appendChild(document.createElement('table'));
        groupListTable.id = "groupTable";
        const groupTableHeader = $(`<tr><th>Group Name</th><th>Group ID</th><th>Group Owner</th><th>Delete</th<</tr>`);
        $("#groupTable").append(groupTableHeader);
        const count = res.data.length;
        let i = 0;  
        res.data.forEach((item) => {
            conn.getGroupInfo({groupId: item.groupid})
            .then((res) => {
                const groupOwner = res.data[0].owner;
                console.log(`group owner for ${res.data[0].id} retrieved`);
                if (groupOwner == storage.username) {
                    let delete_img = `<img src="./red_x.png" alt="Delete Group" class="deleteGroupDirect" id="${res.data[0].id}" onclick="destroyGroup(${res.data[0].id}, true)" height=20 width=20></img>`
                    const groupTableRow = $(`<tr><td>${item.groupname}</td><td id="group_id_${res.data[0].id}">${item.groupid}</td><td>${groupOwner}</td><td>${delete_img}</td></tr>`);
                    $("#groupTable").append(groupTableRow);
                } else {
                    const groupTableRow = $(`<tr><td>${item.groupname}</td><td>${item.groupid}</td><td>${groupOwner}</td><td></td></tr>`);
                    $("#groupTable").append(groupTableRow);
                }
                i++;
                if (i == count) {
                    prependLogger(`Public Groups have been fetched (${count} total).`);
                    storage.groupsFetched = true;
                } else if (i > count) {
                    prependLogger('WARN: logged group rows greated than returned groups');
                }
            })
        });
    }).catch((err) => {
        console.log('fetching groups failed', err);
    })
}