var storage = {
    username: null,
    password: null,
    token: null,
    tokenReturned: false,
    groupsFetched: false
};

chatClient = new WebIM.connection({
    appKey: "41450892#535167",
});

//get button elements:

const groupView = document.getElementById("groups");
const messageView = document.getElementById("messages");
const loggerBox = document.getElementById("log");

const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");

const sendPeerMessageButton = document.getElementById("send_peer_message");

const publicGroupsList = document.getElementById("publicGroupsList");
const createGroupButton = document.getElementById("createGroup");
const joinGroupButton = document.getElementById("joinGroup");
const leaveGroupButton = document.getElementById("leaveGroup");
const destroyGroupButton = document.getElementById("destroyGroup");
const getPublicGroupsButton = document.getElementById("getPublicGroups");
const getJoinedGroupsButton = document.getElementById("getJoinedGroups");
const sendGroupMessageButton = document.getElementById("sendGroupMessage");
const getGroupMessagesButton = document.getElementById("getGroupMessages");


//log to log div
function logger(line) {
    loggerBox.appendChild(document.createElement('div')).append(line);
};

// Register listening events
chatClient.addEventHandler('connection&message', {
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
            chatClient.open({
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
    chatClient.close();
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
    let msg = chatClient.message.create(option); 
    chatClient.send(msg).then((res) => {
        console.log('send private text success');
        logger("Message send to: " + peerId + " Message: " + peerMessage);
    }).catch((err) => {
        console.log('send private text fail', err);
    })
});


//Chat Group stuff
//buttons
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

    chatClient.createGroup(options)
    .then((res) => {
        console.log(`created chat group ${groupName} as groupid ${res.data.groupid}`);
        const groupId = res.data.groupid;
        $("#groupID").val(groupId);
        logger(`${groupName} (${groupId}) has been created!`);
        if (storage.groupsFetched) {
            fetchPublicGroups();
        }
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

    chatClient.joinGroup(options).then((res) => {
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
    chatClient.leaveGroup(options).then((res) => {
        console.log(`left group ${groupId} with ` + res.data.result);
        logger(`${storage.username} has left the group ${groupId}.`);
    }).catch((err) => {
        console.log('leave group chat failed', err);
        logger(`Failed to leave group ${groupId}, check console for error`);
    })
});

//destroy chat group
destroyGroupButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    if (groupId) {
        console.log("destroy group " + groupId);
        destroyGroup(groupId);
    } else {
        console.log('groupid field is empty');
        logger(`Fill out groupId field to delete a group.`)
    }
});

//get public chat rooms and owners
getPublicGroupsButton.addEventListener("click", () => {
    fetchPublicGroups();
});


//send group chat message
sendGroupMessageButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    if (!groupId) {
        console.log('fill out a group id to send a message');
        logger(`Fill out the groupId field to send a group message.`);
    } else { 
    let groupChatMessage = document.getElementById("groupChatMessage").value.toString();
    let options = {
        chatType: 'groupChat',    // Set it to group chat
        type: 'txt',               // Message type
        to: groupId,                // The user receiving the message (user ID)
        msg: groupChatMessage           // The message content
    };
    console.log("send group message to group " + groupId + "\nmessage: " + groupChatMessage);
    logger(`Sending Chat Group message to GroupId ${groupId}`);
    let msg = WebIM.message.create(options); 
    chatClient
        .send(msg)
        .then((res) => {
            console.log(`group chat text successfully to ${groupId}`);
            logger(`${storage.username} has sent a group message to ${groupId}`);
        }).catch((err) => {
            console.log('failed to send group chat text', err),
            logger(`Failed to send group message to ${groupId}, check console for errors`);
        })
    }
});

//get group history messages
getGroupMessagesButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    if (!groupId) {
        console.log('fill out a group id to geta messages');
        logger(`Fill out the groupId field to get group messages.`);
    } else { 
    chatClient.getHistoryMessages({ targetId: groupId, chatType: "groupChat", pageSize: 50 })
        .then((res) => {
            console.log('getChatGroupMessageHistory success');
            logger(`Retreived Group Chat ${groupId} History Messages.`);
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
            messages.innerHTML = "";
            messages.appendChild(document.createElement('div')).innerText = `Message History: ${str}`;
        })
        .catch((err) => {
            console.error('getChatGroupMessageHistory failed', err);
            logger(`getChatGroupMessageHistory failed`);
        });
    }
});



//functions for chat groups

//set groupname field
function setGroupName(groupName) {
    $("#groupName").val(groupName);
};

//set groupid field
function setGroupID(groupId) {
    $("#groupID").val(groupId);
};

function setGroupNameAndID(groupName, groupId) {
    $("#groupName").val(groupName);
    $("#groupID").val(groupId);
};

//destroy chat group function
function destroyGroup(groupId, refresh) {
    let options = {
        groupId: groupId.toString()
    };
    chatClient.destroyGroup(options).then((res) => {
        console.log(`group ${res.data.id} destroyed ${res.data.success}`);
        logger(`${res.data.id} has been destroyed.`);
        $("#groupID").val("");
        if (refresh || storage.groupsFetched) {
            setTimeout(fetchPublicGroups(), 5000);
        }
    }).catch((err) => {
        console.log(`destroy chat group ${groupId} failed`, err);
        logger(`Failed to destroy group ${groupId}, check console for error`);
    })
};


//fetch public groups
/** not interesting way, comparing an i count of length of public group length to number of times group owner is logged to output 'after' all requests have been received and processed. Should be a way to do this with Promise.all, so that resolve condition is all promises fired to get group owner have resolved to output final count and confirmation
*/

function fetchPublicGroups() {
    console.log("get groups start"); 
    logger('Fetching Public Groups...') ;
    let options = {limit: 50, cursor: null};
    chatClient.getPublicGroups(options)
    .then((res) => {
        console.log('public groups list retrieved');
        publicGroupsList.innerHTML = "";
        const publicGroupsListTable = publicGroupsList.appendChild(document.createElement('table'));
        publicGroupsListTable.id = "publicGroupsTable";
        publicGroupsListTable.className = "publicGroupsTable";
        const groupTableHeader = $(`<tr><th>Group Name</th><th>Group ID</th><th>Group Owner</th><th>Delete</th<</tr>`);
        $("#publicGroupsTable").append(groupTableHeader);
        const count = res.data.length;
        let i = 0;  
        res.data.forEach((item) => {
            chatClient.getGroupInfo({groupId: item.groupid})
            .then((res) => {
                const groupOwner = res.data[0].owner;
                console.log(`group owner for ${res.data[0].id} retrieved`);
                if (groupOwner == storage.username) {
                    let delete_img = `<img src="./red_x.png" alt="Delete Group" class="deleteGroupDirect" id="${res.data[0].id}" onclick="destroyGroup(${res.data[0].id}, true)" height=20 width=20></img>`
                    const groupTableRow = $(`<tr><td onclick="setGroupNameAndID('${item.groupname}', ${item.groupid})">${item.groupname}</td><td id="group_id_${res.data[0].id}" onclick="setGroupNameAndID('${item.groupname}', ${item.groupid})">${item.groupid}</td><td>${groupOwner}</td><td>${delete_img}</td></tr>`);
                    $("#publicGroupsTable").append(groupTableRow);
                } else {
                    const groupTableRow = $(`<tr><td onclick="setGroupNameAndID('${item.groupname}', ${item.groupid})">${item.groupname}</td><td onclick="setGroupNameAndID('${item.groupname}', ${item.groupid})">${item.groupid}</td><td>${groupOwner}</td><td></td></tr>`);
                    $("#publicGroupsTable").append(groupTableRow);
                }
                i++;
                if (i == count) {
                    logger(`Public Groups have been fetched (${count} total).`);
                    storage.groupsFetched = true;
                } else if (i > count) {
                    logger('WARN: logged group rows greated than returned groups');
                }
            })
        });
    }).catch((err) => {
        console.log('fetching groups failed', err);
    })
}

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
    chatClient.renewToken(storage.token)
    .then((res) => {
        logger(`Token renewed - Expire: ${res.data.expire} - Status: ${res.data.status}`);
    });
};

//reference area

/** 
 * save this stringify if needed at some point to manipulate json to string
          res.data.forEach((item) => {
            let str = "";
            chatClient.getGroupInfo({groupId: item.groupid})
            .then((res) => {
                console.log(`group owner for ${res.data[0].id} retrieved`);
                const groupOwner = res.data[0].owner;
                str += '\n'+ JSON.stringify({
                    groupname: item.groupname,
                    groupid: item.groupid,
                    groupOwner: groupOwner
                });
                groupList.appendChild(document.createElement('div')).append(str);
                i++;
                if (i == count) {
                    logger(`Public Groups have been fetched (${count} total).`);
                } else if (i > count) {
                    logger('WARN: logged group rows greated than returned groups');
                }
            })
        });


* save string writing of group public list, just in case, now it's table instead:
    let str = `Group Name: ${item.groupname} -- Group Id: ${item.groupId} -- Group Owner: ${res.data[0].owner}`;
    groupList.appendChild(document.createElement('div')).append(str);
 */

