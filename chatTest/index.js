//session storage
var storage = {
    username: null,
    password: null,
    token: null,
    tokenReturned: false,
    groupsFetched: false,
    visibleGroup: 0
};

//AC client init
chatClient = new WebIM.connection({
    appKey: "41450892#535167",
});

//get button  and other elements:
const groupView = document.getElementById("groups");
const messageView = document.getElementById("messages");
const messageList = document.getElementById("messageList");
const loggerBox = document.getElementById("log");

const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");

const publicGroupsList = document.getElementById("publicGroupsList");
const joinedGroupsList = document.getElementById("joinedGroupsList");
const createGroupButton = document.getElementById("createGroup");
const joinGroupButton = document.getElementById("joinGroup");
const leaveGroupButton = document.getElementById("leaveGroup");
const destroyGroupButton = document.getElementById("destroyGroup");
const getPublicGroupsButton = document.getElementById("getPublicGroups");
const getJoinedGroupsButton = document.getElementById("getJoinedGroups");
const sendGroupMessageButton = document.getElementById("sendGroupMessage");
const getGroupMessagesButton = document.getElementById("getGroupMessages");

// Register listening events
chatClient.addEventHandler('connection&message&group', {
    onConnected: () => {
        logger("Connect success !");
        fetchPublicGroups();
        fetchJoinedGroups();
    },
    onDisconnected: () => {
        logger("Logout success !");
    },
    onTextMessage: (message) => {
        logger("Message from: " + message.from + " for Group " + message.to);
        switch(message.chatType){
            case "groupChat":
                    if (message.to == storage.visibleGroup) {
                        logRemoteMessage(message.from, message.msg, message.id);
                        logTime(message.time);
                    } else {
                        console.log("Message received for non-visible group, ignorning. future should maybe store this.");
                    }
                    break;
            case "singleChat":
                console.log("single chat received, ignoring");
                break;
            case "chatRoom":
                console.log("chatRoom message received, ignoring");
                break;
            default:
                console.log(`unexpected message type!! - ${message}`);
                break;             
            }
    },
    onGroupEvent: (event) => {
        switch(event.operation){
          case "create":
            console.log(`${msg.operation}`);
            break;
          case 'destroy':
              console.log(`${msg.operation}`);
            break;
          default:
            break;
      }
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
                $("#login").attr("disabled", true);
                $("#logout").attr("disabled", false);
                $("#createGroup").attr("disabled", false);
                $("#joinGroup").attr("disabled", false);
                $("#leaveGroup").attr("disabled", false);
                $("#destroyGroup").attr("disabled", false);
                $("#getPublicGroups").attr("disabled", false);
                $("#getJoinedGroups").attr("disabled", false);
                $("#sendGroupMessage").attr("disabled", false);
                $("#getGroupMessages").attr("disabled", false);
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
    $("#login").attr("disabled", false);
    $("#logout").attr("disabled", true);
    $("#createGroup").attr("disabled", true);
    $("#joinGroup").attr("disabled", true);
    $("#leaveGroup").attr("disabled", true);
    $("#destroyGroup").attr("disabled", true);
    $("#getPublicGroups").attr("disabled", true);
    $("#getJoinedGroups").attr("disabled", true);
    $("#sendGroupMessage").attr("disabled", true);
    $("#getGroupMessages").attr("disabled", true);
    publicGroupsList.innerHTML = "";
    $("#publicGroupsList").append(`<center><i>Public Groups...</span></i></center>`);
    joinedGroupsList.innerHTML = "";
    $("#joinedGroupsList").append(`<center><i>Joined Groups...</span></i></center>`);
    messageList.innerHTML = "";
    $("#groupName").val("");
    $("#groupID").val("");

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
            setTimeout(function() {fetchPublicGroups()}, 1000);
            setTimeout(function() {fetchJoinedGroups()}, 1000);
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
        logger(`User ${res.data.user} has joined Chat Group ${res.data.id}`);
        setTimeout(function() {fetchPublicGroups()}, 1000);
        setTimeout(function() {fetchJoinedGroups()}, 1000);
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
        setTimeout(function() {fetchPublicGroups()}, 1000);
        setTimeout(function() {fetchJoinedGroups()}, 1000);
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

getJoinedGroupsButton.addEventListener("click", () => {
    fetchJoinedGroups();
});

//send group chat message
sendGroupMessageButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    const groupName = document.getElementById("groupName").value.toString();
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
    console.log("send group message to group " + groupName + " " + groupId + "\nmessage: " + groupChatMessage);
    logger(`Sending Chat Group message to ${groupName} (${groupId}).`);
    let msg = WebIM.message.create(options); 
    chatClient
        .send(msg)
        .then((res) => {
            console.log(`group chat text successfully to ${groupId}`);
            logger(`${storage.username} has sent a group message to ${groupName}.`);
            logMyMessage(msg.msg, res.serverMsgId);
            logMyTime(msg.time);
            $("#groupChatMessage").val(""); 
        }).catch((err) => {
            console.log('failed to send group chat text', err),
            logger(`Failed to send group message to ${groupId}, check console for errors`);
        })
    }
});

//get group history messages
getGroupMessagesButton.addEventListener("click", () => {
    fetchGroupHistory();
});

//Chat group functions
//log to log div
function logger(line) {
    const logLine = loggerBox.appendChild(document.createElement('div'));
    loggerBox.append(line);
    logLine.scrollIntoViewIfNeeded();
};
 
//append message user has sent to message list
function logMyMessage(msg, id) {
    const message = $(`<div id="my_message_${id}" class="mMessage"><span>${msg}</span></div>`);
    $("#messageList").append(message);
}
 
//append other user's message to message list
function logRemoteMessage(from, msg, id) {
    const sender = $(`<div id="remote_sender_${id}" class="rMessage"><span class="rFrom">${from}</span>`);
    const message = $(`<div id="remote_message_${id}" class="rMessage"><span class="rText">${msg}</span>`);
    $("#messageList").append(sender);
    $("#messageList").append(message);
}
 
//convert and append timestamp from message of other user
function logTime(time) {
    let t = '';
    t = new Date(time).toLocaleDateString("en-US") + " " + new Date(time).toLocaleTimeString("en-US");
    const timeDone = $(`<div id="time_${time}" class="rTime">${t}</div>`);
    $("#messageList").append(timeDone);
    let emptyDiv = messageList.appendChild(document.createElement('div'));
    emptyDiv.className = "emptyDiv";
    messageList.append(emptyDiv); 
    emptyDiv.scrollIntoViewIfNeeded();
}
 
//convert and append timestamp of user's own message
function logMyTime(time) {
    let t = '';
    t = new Date(time).toLocaleDateString("en-US") + " " + new Date(time).toLocaleTimeString("en-US");
    const timeDone = $(`<div id="time_${time}" class="myTime">${t}</div>`);
    $("#messageList").append(timeDone);
    let emptyDiv = messageList.appendChild(document.createElement('div'));
    emptyDiv.className = "emptyDiv";
    console.log("logging time");
    messageList.append(emptyDiv); 
    emptyDiv.scrollIntoViewIfNeeded();
}

async function fetchGroupHistory(passedID) {
    var groupId;
    if (passedID) {
        groupId = passedID.toString();
    } else {
        groupId = document.getElementById("groupID").value.toString();
    }
    if (!groupId) {
        console.log('fill out a group id to get a messages');
        logger(`Fill out the groupId field to get group messages.`);
    } else { 
        const res = await chatClient.getHistoryMessages({ targetId: groupId, chatType: "groupChat", pageSize: 50 });
        console.log(`retreived messages for ${groupId}`);
        messageList.innerHTML = "";
        for (let index = res.messages.length - 1; index >= 0; index--) {
            const message = res.messages[index];
            if (message.from == storage.username) {
                logMyMessage(message.msg, message.id);
                logMyTime(message.time);       
            } else {
                logRemoteMessage(message.from, message.msg, message.id);
                logTime(message.time);
            }
        };
        storage.visibleGroup = groupId;
    }
};

//set groupname field
function setGroupName(groupName) {
    $("#groupName").val(groupName);
};

//set groupid field
function setGroupID(groupId) {
    $("#groupID").val(groupId);
};

//set groupid and name to input fields
function setGroupNameAndID(groupName, groupId) {
    $("#groupName").val(groupName);
    $("#groupID").val(groupId);
};

//set groupid and name to input fields, and fetch history
function setGroupNameAndIDAndPull(groupName, groupId) {
    $("#groupName").val(groupName);
    $("#groupID").val(groupId);
    fetchGroupHistory(groupId);
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
            setTimeout(function() {fetchPublicGroups()}, 1000);
            setTimeout(function() {fetchJoinedGroups()}, 1000);
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
        const publicTitle = publicGroupsList.appendChild(document.createElement('div'));
        publicTitle.id = "publicTableTitle";
        publicTitle.className = "publicTableTitle";
        publicTitle.innerHTML ="Public Groups:"
        publicGroupsList.append(publicTitle);
        const publicGroupsListTable = publicGroupsList.appendChild(document.createElement('table'));
        publicGroupsListTable.id = "publicGroupsTable";
        publicGroupsListTable.className = "publicGroupsTable";
        const groupTableHeader = $(`<tr><th>Group Name</th><th>Group ID</th><th>Group Owner</th><th>Delete</th></tr>`);
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
                    const groupTableRow = $(`<tr><td onclick="setGroupNameAndIDAndPull('${item.groupname}', ${item.groupid})">${item.groupname}</td><td id="group_id_${res.data[0].id}" onclick="setGroupNameAndIDAndPull('${item.groupname}', ${item.groupid})">${item.groupid}</td><td>${groupOwner}</td><td>${delete_img}</td></tr>`);
                    $("#publicGroupsTable").append(groupTableRow);
                } else {
                    const groupTableRow = $(`<tr><td onclick="setGroupNameAndIDAndPull('${item.groupname}', ${item.groupid})">${item.groupname}</td><td onclick="setGroupNameAndIDAndPull('${item.groupname}', ${item.groupid})">${item.groupid}</td><td>${groupOwner}</td><td></td></tr>`);
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

//fetch joined groups
function fetchJoinedGroups() {
    console.log("get joined groups start"); 
    logger('Fetching Joined Groups...') ;
    let options = {pageNum: 1, pageSize: 500, needAffiliations: false, needRole: false};
    chatClient.getJoinedGroups(options)
    .then((res) => {
        console.log('joined groups list retrieved');
        joinedGroupsList.innerHTML = "";
        const joinedTitle = joinedGroupsList.appendChild(document.createElement('div'));
        joinedTitle.id = "joinedTableTitle";
        joinedTitle.className = "joinedTableTitle";
        joinedTitle.innerHTML ="Joined Groups:"
        joinedGroupsList.append(joinedTitle);
        const joinedGroupsListTable = joinedGroupsList.appendChild(document.createElement('table'));
        joinedGroupsListTable.id = "joinedGroupsTable";
        joinedGroupsListTable.className = "joinedGroupsTable";
        const joinedTableHeader = $(`<tr><th>Group Name</th><th>Group ID</th><th>Group Owner</th><th>Delete</th></tr>`);
        $("#joinedGroupsTable").append(joinedTableHeader);
        const count = res.data.length;
        let i = 0;  
        res.data.forEach((item) => {
            chatClient.getGroupInfo({groupId: item.groupid})
            .then((res) => {
                const groupOwner = res.data[0].owner;
                console.log(`group owner for ${res.data[0].id} retrieved`);
                if (groupOwner == storage.username) {
                    let delete_img = `<img src="./red_x.png" alt="Delete Group" class="deleteGroupDirect" id="${res.data[0].id}" onclick="destroyGroup(${res.data[0].id}, true)" height=20 width=20></img>`
                    const groupTableRow = $(`<tr><td onclick="setGroupNameAndIDAndPull('${item.groupname}', ${item.groupid})">${item.groupname}</td><td id="joined_group_id_${res.data[0].id}" onclick="setGroupNameAndIDAndPull('${item.groupname}', ${item.groupid})">${item.groupid}</td><td>${groupOwner}</td><td>${delete_img}</td></tr>`);
                    $("#joinedGroupsTable").append(groupTableRow);
                } else {
                    const groupTableRow = $(`<tr><td onclick="setGroupNameAndIDAndPull('${item.groupname}', ${item.groupid})">${item.groupname}</td><td onclick="setGroupNameAndIDAndPull('${item.groupname}', ${item.groupid})">${item.groupid}</td><td>${groupOwner}</td><td></td></tr>`);
                    $("#joinedGroupsTable").append(groupTableRow);
                }
                i++;
                if (i == count) {
                    logger(`Joined Groups have been fetched (${count} total).`);
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
        host: "https://18-118-241-12.nip.io/aleksey",
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
        logger(`Token renewed - Expire: ${res.expire} - Status: ${res.status}`);
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
 
 .forEach reference, replaced with for loop to iterate backgrounds through messages array:

  res.messages.forEach((item) => {
            if (item.from == storage.username) {
                logMyMessage(item.msg, item.id, false);
                let t = '';
                t = new Date(item.time).toLocaleDateString("en-US") + " " + new Date(item.time).toLocaleTimeString("en-US");
                logTime(t.toString(), false);
                
            } else {
                logRemoteMessage(item.from, item.msg, item.id, false);
                let t = '';
                t = new Date(item.time).toLocaleDateString("en-US") + " " + new Date(item.time).toLocaleTimeString("en-US");
                logTime(t.toString(), false);
            }
})
 

refreshMessages as broken up string:

async function refreshMessages(messages) {
    let str = '';
    messages.forEach((item) => {
        str += '\n' + JSON.stringify({
            time: item.time,
            messageId: item.id,
            messageType: item.type,
            from: item.from,
            to: item.to,
            msg: item.msg,
        });
    return str;
});};
 
*/

