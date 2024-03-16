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

const createGroupButton = document.getElementById("createGroup");
const joinGroupButton = document.getElementById("joinGroup");
const leaveGroupButton = document.getElementById("leaveGroup");
const deleteGroupButton = document.getElementById("deleteGroup");
const getPublicGroupsButton = document.getElementById("getPublicGroups");
const getJoinedGroupsButton = document.getElementById("getJoinedGroups");


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
        refreshToken()
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


//Chat Group stuff

createGroupButton.addEventListener("click", () => {
    const groupName = document.getElementById("groupName").value.toString();
    if (groupName) {
        console.log("Creating ChatGroup: " + groupName);  
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
        console.log(res);
        const groupId = res.data.groupid;
        $("#groupID").val(groupId);
        logger.appendChild(document.createElement('div')).append(`${groupName} (${groupId}) has been created`)
        }).catch((err) => {
            console.log('create group chat failed', err);
            logger.appendChild(document.createElement('div')).append(`Failed to create group ${groupId}, check console for error`)
        })
    } else {
        console.log("GroupName cannot be empty");
    }
});

joinGroupButton.addEventListener("click", () => {

    let option = {
        groupId: document.getElementById("groupID").value.toString(),
        //groupId: "218535221592065",
        message: 'Join Group Request From ' + storage.username 
    }

    WebIM.conn.joinGroup(option).then((res) => {
        console.log('JoinGroup Button Pressed and Joined.');
    }).catch((err) => {
        console.log('Joining Group Failed', err);
    })
});

leaveGroupButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    let options = {
        groupId: groupId
    };
    WebIM.conn.leaveGroup(options).then((res) => {
        console.log(res);
        logger.appendChild(document.createElement('div')).append(`${storage.username} has left the group ${groupId}`)
    }).catch((err) => {
        console.log('leave group chat failed', err),
        logger.appendChild(document.createElement('div')).append(`Failed to leave group ${groupId}, check console for error`)
    })
})

deleteGroupButton.addEventListener("click", () => {
    const groupId = document.getElementById("groupID").value.toString();
    console.log("destroy group " + groupId);
    let options = {
        groupId: groupId
    };
    WebIM.conn.destroyGroup(options).then((res) => {
        console.log(res);
        logger.appendChild(document.createElement('div')).append(`${groupId} has been destoryed`)
    }).catch((err) => {
        console.log('destroy group chat failed', err);
        logger.appendChild(document.createElement('div')).append(`Failed to destroy group ${groupId}, check console for error`)
    })
});



getPublicGroupsButton.addEventListener("click", () => {
    console.log("Fetching Public Groups...");  
    let options = {limit: 50, cursor: null};
    const groups_no_owners = WebIM.conn.getPublicGroups(options);
    groups_no_owners
    .then((res) => {
        console.log(res);
        const count = res.data.length;
        res.data.forEach((item) => {
            let str = "";
            const groupowner = WebIM.conn.getGroupInfo({groupId: item.groupid});
            groupowner
            .then((res) => {
                console.log(res);
                const groupOwner = res.data[0].owner;
                str += '\n'+ JSON.stringify({
                    groupname: item.groupname,
                    groupid: item.groupid,
                    groupOwner: groupOwner
                });
                var odIV = document.createElement("div");
                odIV.style.whiteSpace = "pre";
                logger.appendChild(odIV).append(str);
            }).then((count) => {
                logger.appendChild(document.createElement('div')).append(`Public Groups have been fetched (${count} total).`)
            })
        });
    }).catch((err) => {
        console.log('fetching groups failed', err);
    })
});

/**getPublicGroupsButton.addEventListener("click", () => {
    console.log("Fetching Public Groups...");  
    let options = {limit: 50, cursor: null};
    const groups_no_owners = WebIM.conn.getPublicGroups(options);
    groups_no_owners
    .then((res) => {
        console.log(res);
        const count = res.data.length;
        res.data.forEach((item) => {
            let str = "";
            const groupowner = WebIM.conn.getGroupInfo({groupId: item.groupid});
            groupowner
            .then((res) => {
                console.log(res);
                const groupOwner = res.data[0].owner;
                str += '\n'+ JSON.stringify({
                    groupname: item.groupname,
                    groupid: item.groupid,
                    groupOwner: groupOwner
                });
                var odIV = document.createElement("div");
                odIV.style.whiteSpace = "pre";
                logger.appendChild(odIV).append(str);
            })
        });
        logger.appendChild(document.createElement('div')).append(`Public Groups have been fetched (${count} total).`)
    }).catch((err) => {
        console.log('fetching groups failed', err);
    })
});
*/

// token stuff

async function getTokens() {
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
            "expire": 2100 
            })});
      const response = await res.json();
      console.log("Chat token fetched from server: ", response.token);
      storage.tokenReturned = true;
      storage.token = response.token;
    } catch (err) {
      console.log(err);
    }
}

function refreshToken() {
    getTokens()
    .then(() => console.log("New token retrieved " + storage.token))
    .then(WebIM.conn.renewToken(storage.token));
};



        //let str='';
        //dataObj.groupid = res.data.groupid;
        //console.log(dataObj.groupid + " OBJECT \n")
        //res.data.map((item) => {
        //    str += '\n' + JSON.stringify({
        //        groupId: groupId,
        //    }) 
        //})
        //var odIV = document.createElement("div");
        //odIV.style.whiteSpace = "pre";
        //logger.appendChild(odIV).append('GROUPID:', str)
    //}).catch((err) => {
        //console.log('create group chat failed', err);
        //logger.appendChild(document.createElement('div')).append(`Failed to create group ${groupId}, check console for error`)
    //})