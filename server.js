const express = require('express');
const socket = require('socket.io');
const { ExpressPeerServer } = require('peer');
const groupCallHandler = require('./groupCallHandler');
const { v4: uuidv4 } = require('uuid');
// require("dotenv").config()
const PORT = process.env.PORT || 5000;
const https = require('https');
const fs = require('fs');
const bcrypt = require("bcrypt")
const app = express();
const cors = require("cors");
app.use(cors());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    next();
});
const mysql = require("mysql")

var formidable = require('formidable');
const path = require('path')

require('dotenv').config();
const DB_HOST = process.env.DB_HOST
const DB_USER = process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_DATABASE = process.env.DB_DATABASE
const DB_PORT = process.env.DB_PORT

// const DB_HOST = 'localhost'
// const DB_USER = 'root'
// const DB_PASSWORD = ''
// const DB_DATABASE = 'userDB'
// const DB_PORT = 3306

const db = mysql.createPool({
    connectionLimit: 100,
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    port: DB_PORT
})

app.get("/", (req, res) => {
    res.send({ api: "video-talker-api" });
});

const httpsOptions = {
    key: fs.readFileSync('cert/cert.key'),
    cert: fs.readFileSync('cert/cert.pem')
}

const server = https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`);
    console.log(`https://10.10.2.7:${PORT}`);
});



db.getConnection((err, connection) => {
    if (err) throw (err)
    console.log("DB connected successful: " + connection.threadId)
})


const peerServer = ExpressPeerServer(server, {
    debug: true
});

app.use('/peerjs', peerServer);

groupCallHandler.createPeerServerListeners(peerServer);

const io = socket(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

let peers = [];
let groupCallRooms = [];
let setData = '';
let dataRow = '';

const broadcastEventTypes = {
    ACTIVE_USERS: 'ACTIVE_USERS',
    GROUP_CALL_ROOMS: 'GROUP_CALL_ROOMS',
    Remove_CALL_ANS: 'Remove_CALL_ANS',
    Re_Route_Machine: 'Re_Route_Machine'
};

io.on('connection', (socket) => {
    socket.emit('connection', null);
    console.log('new user connected');
    console.log(socket.id);

    socket.on('register-new-user', (data) => {
        peers.push({
            username: data.username,
            usertype: data.usertype,
            socketId: data.socketId
        });
        console.log('registered new user');
        console.log(data);

        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.ACTIVE_USERS,
            activeUsers: peers
        });

        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.GROUP_CALL_ROOMS,
            groupCallRooms
        });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        var roomId;
     // on socket closed save the video using roomid 
     console.log("********** call the functiom ****************");
     console.log(socket.id);
     console.log(peers);
     
        for(var key in groupCallRooms) {
            console.log(groupCallRooms[key]);
            if(groupCallRooms[key].socketId === socket.id ){
                roomId = groupCallRooms[key].roomId;
            }
        }
        io.emit('machine-call-user-end', {
        peerId: peers,
        machineSocket: socket.id,
        roomId: roomId,
        });

        peers = peers.filter(peer => peer.socketId !== socket.id);
        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.ACTIVE_USERS,
            activeUsers: peers
        });

        groupCallRooms = groupCallRooms.filter(room => room.socketId !== socket.id);
        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.GROUP_CALL_ROOMS,
            groupCallRooms
        });
    });


    // listeners related with direct call

    socket.on('pre-offer', (data) => {
        console.log('pre-offer handled');
        io.to(data.callee.socketId).emit('pre-offer', {
            callerUsername: data.caller.username,
            callerSocketId: socket.id
        });
    });

    socket.on('pre-offer-answer', (data) => {
        console.log('handling pre offer answer');
        io.to(data.callerSocketId).emit('pre-offer-answer', {
            answer: data.answer
        });
    });

    socket.on('webRTC-offer', (data) => {
        console.log('handling webRTC offer');
        io.to(data.calleeSocketId).emit('webRTC-offer', {
            offer: data.offer
        });
    });

    socket.on('webRTC-answer', (data) => {
        console.log('handling webRTC answer');
        io.to(data.callerSocketId).emit('webRTC-answer', {
            answer: data.answer
        });
    });

    socket.on('webRTC-candidate', (data) => {
        console.log('handling ice candidate');
        io.to(data.connectedUserSocketId).emit('webRTC-candidate', {
            candidate: data.candidate
        });
    });

    socket.on('user-hanged-up', (data) => {
        io.to(data.connectedUserSocketId).emit('user-hanged-up');
    });

    // listeners related with group call
    socket.on('group-call-register', (data) => {
        const roomId = uuidv4();
        socket.join(roomId);

        console.log("Adding New Group calls $$$$$$$");

        const newGroupCallRoom = {
            peerId: data.peerId,
            hostName: data.username,
            socketId: socket.id,
            roomId: roomId,
            isAns: false
        };
        

        groupCallRooms.push(newGroupCallRoom);
        console.log(groupCallRooms);
        for(var key in peers){
            if(peers[key].socketId === socket.id) {
              peers[key].roomId = roomId
            }
          }

        //save call initi data
        saveCallInitDetail(newGroupCallRoom);

        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.GROUP_CALL_ROOMS,
            groupCallRooms
        });
    });

    socket.on('group-call-join-request', (data) => {
        io.to(data.roomId).emit('group-call-join-request', {
            peerId: data.peerId,
            streamId: data.streamId
        });
        socket.join(data.roomId);
        for(var key in peers) {
            if(peers[key].socketId === socket.id) {
              peers[key].roomId = data.roomId
            }
        }

    });

    socket.on('start-video', (data) => {
        io.to(data.roomId).emit('start-video', {
            peerId: data.peerId,
            streamId: data.streamId,
            data: data
        });
        // socket.join(data.roomId);
        // for(var key in peers) {
        //     if(peers[key].socketId === socket.id) {
        //       peers[key].roomId = data.roomId
        //     }
        // }

    });

    socket.on('machine-call-user-left', (data) => {
        // call the method used by operator-disconnecting
        console.log("############################################");
        console.log(data)
        io.emit('machine-call-user-left', {
          streamId: data.streamId,
          peerId: data.peerId,
          machineSocket: data.machineSocket,
        });
    });

    //test
    // socket.on('user-call-machine-left', (data) => {
    //     // call the method used by operator-disconnecting
    //     console.log("############################################");
    //     console.log(data)
    //     io.emit('user-call-machine-left', {
    //       streamId: data.streamId,
    //       peerId: data.peerId,
    //       machineSocket: data.machineSocket,
    //     });
    // });


    socket.on('group-call-user-left', (data) => {
        socket.leave(data.roomId);
        console.log("user");
        console.log(data)

        io.to(data.roomId).emit('group-call-user-left', {
            streamId: data.streamId
        });

        // the below broadcast is done to remove from group list

        groupCallRooms = groupCallRooms.filter(room => room.roomId !== data.roomId);

        console.log("$$$$$$$$$$$$$$$$$");
        console.log(groupCallRooms);
        console.log(data.peerId);
        console.log(data);

        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.GROUP_CALL_ROOMS,
            groupCallRooms
        });
    });

    socket.on('group-call-closed-by-host', (data) => {
        groupCallRooms = groupCallRooms.filter(room => room.peerId !== data.peerId);
        console.log("Host");
        console.log(groupCallRooms);
        console.log(data);

        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.GROUP_CALL_ROOMS,
            groupCallRooms
        });
    });


    socket.on('group-call-remove-notification', (data) => {
        // groupCallRooms = groupCallRooms.filter(room => room.roomId !== data.roomId);
        // below logic to add flag for answered
        for (const key in groupCallRooms) {
            if (groupCallRooms[key].roomId == data.roomId) {
                console.log("inside if add a flag $$$$$$$$$");
                groupCallRooms[key].isAns = true;
            }
        }
        console.log("server file filter");
        console.log(data);
        console.log(groupCallRooms);

        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.Remove_CALL_ANS,
            groupCallRooms
        });
    });

    socket.on('machine-re-route', (data) => {
        console.log("machine-re-route broad cast to all to re-route");
        console.log(data);
        io.sockets.emit('broadcast', {
            event: broadcastEventTypes.Re_Route_Machine,
            data
        });
    });

});

const saveCallInitDetail = (data) => {
    const callerId = data.roomId;
    const callOriginationTime = new Date();
    const callOrigin = data.hostName.username;
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlInsert = "INSERT INTO callDetails VALUES (0,?,?,?)"
        const insert_query = mysql.format(sqlInsert, [callerId, callOriginationTime, callOrigin])
        await connection.query(insert_query, (err, result) => {
            connection.release()
            if (err) throw (err)
            console.log("--------> added init details")
            console.log(result.insertId)
        })
    })
}

// DB APIS

app.use(express.json())
app.post("/createUser", async(req, res) => {
    const user = req.body.name;
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const email = req.body.email;
    const isAdmin = req.body.isAdmin;
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        // const sqlSearch = "SELECT * FROM usertable WHERE userId = ?"
        const sqlSearch = "SELECT * FROM usertable WHERE userName = ?"
        const search_query = mysql.format(sqlSearch, [user])
        const sqlInsert = "INSERT INTO usertable VALUES (0,?,?,?,?)"
        const insert_query = mysql.format(sqlInsert, [user, hashedPassword, isAdmin, email])
        await connection.query(search_query, async(err, result) => {
            if (err) throw (err)
            console.log("------> Search Results")
            console.log(result.length)
            if (result.length != 0) {
                connection.release()
                console.log("------> User already exists")
                res.sendStatus(409)
            } else {
                await connection.query(insert_query, (err, result) => {
                    connection.release()
                    if (err) throw (err)
                    console.log("--------> Created new User")
                    console.log(result.insertId)
                    res.writeHead(200, { "Content-Type": "application/json" });
                    var json = JSON.stringify({
                        created: true,
                    });
                    res.end(json);
                })
            }
        })
    })
})


//LOGIN (AUTHENTICATE USER)
app.post("/login", (req, res) => {
    const user = req.body.name
    const password = req.body.password
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlSearch = "Select * from usertable where userName = ?"
        const search_query = mysql.format(sqlSearch, [user])
        await connection.query(search_query, async(err, result) => {
            connection.release()

            if (err) throw (err)
            if (result.length == 0) {
                console.log("--------> User does not exist")
                    // res.sendStatus(404)
                res.writeHead(404, { "Content-Type": "application/json" });
                var json = JSON.stringify({
                    result: "User does not exist",
                });
                res.end(json);
            } else {
                const hashedPassword = result[0].password
                    //get the hashedPassword from result
                if (await bcrypt.compare(password, hashedPassword)) {
                    console.log("---------> Login Successful")
                        // res.send(`${user} is logged in!`)
                    res.writeHead(200, { "Content-Type": "application/json" });
                    var json = JSON.stringify({
                        result: `${user} is logged in!`,
                        details: result
                    });
                    res.end(json);
                } else {
                    console.log("---------> Password Incorrect")
                        // res.send("Password incorrect!");
                    res.writeHead(403, { "Content-Type": "application/json" });
                    var json = JSON.stringify({
                        result: "Password incorrect!",
                    });
                    res.end(json);
                }
            }
        })
    })
})


//Delete user
app.post("/deleteUser", async(req, res) => {
    const user = req.body.name;
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlSearch = "SELECT * FROM usertable WHERE userName = ?"
        const search_query = mysql.format(sqlSearch, [user])
        const sqlDelete = "DELETE FROM usertable WHERE  userName = ?"
        const delete_query = mysql.format(sqlDelete, [user])
        await connection.query(search_query, async(err, result) => {
            if (err) throw (err)
            console.log("------> Search Results")
            Object.keys(result).forEach(function(key) {
                dataRow = result[key];
                setData = dataRow.isAdmin;
              });
              console.log('check isadmin',dataRow.isAdmin)
              console.log(result.length)
              if(dataRow.isAdmin == '1'){
                connection.release()
                console.log("------> admin cannot delete")
                res.sendStatus(409)
              }
            else if (result.length == 0) {
                connection.release()
                console.log("------> User Does not exists")
                    //  res.sendStatus(409)
                res.writeHead(409, { "Content-Type": "application/json" });
                var json = JSON.stringify({
                    result: "User does not exixts",
                });
                res.end(json);
            } else {
                await connection.query(delete_query, (err, result) => {
                    connection.release()
                    if (err) throw (err)
                    console.log("-------->User Deleted")
                    console.log(result.insertId)
                        //  res.sendStatus(201);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    var json = JSON.stringify({
                        result: true,
                    });
                    res.end(json);
                })
            }
        })
    })
})

//Update password
app.post("/updateUserPassword", async(req, res) => {
    console.log("------> Entred update user")

    const user = req.body.name;
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    console.log("------> Entred update user", hashedPassword)

    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlUpdate = "UPDATE usertable SET password = ? Where  userName = ?"
        const update_query = mysql.format(sqlUpdate, [hashedPassword, user])
        await connection.query(update_query, (err, result) => {
            connection.release()
            if (err) throw (err)
            console.log("--------> password update")
            console.log(result.insertId)
            res.sendStatus(201)
        })
    })
})

app.post("/updateUser", async(req, res) => {
    const user = req.body.name;
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const email = req.body.email;
    const isAdmin = req.body.isAdmin;
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlInsert = "UPDATE usertable SET  password = ? , emailAddress = ? , isAdmin = ? Where  userName = ?"
        const insert_query = mysql.format(sqlInsert, [hashedPassword, email, isAdmin, user])
        await connection.query(insert_query, (err, result) => {
            connection.release()
            if (err) throw (err)
            console.log("--------> Created new User")
            console.log(result.insertId)
                //  res.sendStatus(201);
            res.writeHead(200, { "Content-Type": "application/json" });
            var json = JSON.stringify({
                result: "Updated Successful",
            });
            res.end(json);
        })
    })
})

app.get("/getAllUsers", async(req, res) => {
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlSearch = "SELECT * FROM usertable"
        const search_query = mysql.format(sqlSearch, [])
        await connection.query(search_query, async(err, result) => {
            if (err) throw (err)
            console.log(result)
            res.send(result)
        })
    })
})

app.post("/createAuditReport", async(req, res) => {
    const callStartTime = req.body.callStartTime;
    const operatorName = req.body.operatorName;;
    const callEndTime = req.body.callEndTime;
    const reason = req.body.reason;;
    const callOrigin = req.body.callOrigin;
    // const recording = req.body.recording;
    const operator_recording = req.body.recording;
    const user_recording = req.body.recording1;
    const today = new Date(callStartTime);
    const endDate = new Date(callEndTime);
    const minutes = parseInt(Math.abs(endDate.getTime() - today.getTime()) / (1000 * 60) % 60);
    const seconds = parseInt(Math.abs(endDate.getTime() - today.getTime()) / (1000) % 60);
    const callDuration = minutes + ' Minute ' + seconds + ' Seconds';
    const roomId = req.body.roomId;
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlInsert = "INSERT INTO auditReports VALUES (0,?,?,?,?,?,?,?,?,?)"
        const insert_query = mysql.format(sqlInsert, [callStartTime, operatorName, callDuration, callEndTime, callOrigin, reason, operator_recording,user_recording, roomId])
        await connection.query(insert_query, (err, result) => {
            connection.release()
            if (err) throw (err)
            console.log("--------> Created new User ",callOrigin + 'recording', operator_recording)
            console.log(result.insertId)
            res.writeHead(200, { "Content-Type": "application/json" });
            var json = JSON.stringify({
                created: true,
            });
            res.end(json);

        })
    })
})


app.get("/getAuditReport", async(req, res) => {
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlSearch = "SELECT * FROM auditReports ORDER BY id DESC;"
        const search_query = mysql.format(sqlSearch, [])
        await connection.query(search_query, async(err, result) => {
            if (err) throw (err)
            console.log(result)
            res.send(result)
        })
    })
});

app.post("/forgotPassword", async(req, res) => {
    console.log("------> Entred update user")
    var password = generator.generate({
        length: 10,
        numbers: true,
    });
    const user = req.body.name;
    const email = req.body.email;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.getConnection(async(err, connection) => {

        const sqlSearch = "SELECT * FROM usertable WHERE userName = ? and emailAddress = ?"
        const search_query = mysql.format(sqlSearch, [user, email])
        const sqlUpdate = "UPDATE usertable SET password = ? Where  userName = ? and emailAddress = ?"
        const update_query = mysql.format(sqlUpdate, [hashedPassword, user, email])
        await connection.query(search_query, async(err, result) => {
            if (err) throw (err)
            console.log("------> Search Results")
            console.log(result.length)
            if (result.length == 0) {
                connection.release()
                console.log("------> User does not exists")
                res.sendStatus(409)
            } else {
                await connection.query(update_query, (err, result) => {
                    connection.release()
                    if (err) throw (err)
                    console.log("--------> Password Updated")
                    sendmail({
                        from: 'test@finra.org',
                        to: 'ahmedhassain95@gmail.com',
                        subject: 'Password Reset Complete',
                        html: 'Password has been reset to'
                    }, function(err, reply) {
                        console.log(err && err.stack)
                        console.dir(reply)
                    })
                    console.log(result.insertId)
                    res.writeHead(200, { "Content-Type": "application/json" });
                    var json = JSON.stringify({
                        created: true,
                    });
                    res.end(json);
                })
            }
        })
    })
});

app.post("/saveCallDetails", async(req, res) => {
    const callerId = req.body.callerId;
    const callOriginationTime = req.body.callOriginationTime;;
    const callOrigin = req.body.callOrigin;
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlInsert = "INSERT INTO callDetails VALUES (0,?,?,?)"
        const insert_query = mysql.format(sqlInsert, [callerId, callOriginationTime, callOrigin])
        await connection.query(insert_query, (err, result) => {
            connection.release()
            if (err) throw (err)
            console.log("--------> Capture Incoming Call Details")
            console.log(result.insertId)
            res.writeHead(200, { "Content-Type": "application/json" });
            var json = JSON.stringify({
                created: true,
            });
            res.end(json);

        })
    })
});

app.get("/getMissedCallReport", async(req, res) => {
    db.getConnection(async(err, connection) => {
        if (err) throw (err)
        const sqlSearch = "select * from userDB.callDetails where roomId  not in(SELECT roomId FROM userDB.auditReports) ORDER BY id DESC;"
        const search_query = mysql.format(sqlSearch, [])
        await connection.query(search_query, async(err, result) => {
            if (err) throw (err)
            console.log(result)
            res.send(result)
        })
    })
});


app.post("/upload", async (req,res) => {
  var form = new formidable.IncomingForm();
  const uploadFolder = path.join(__dirname, "public", "files");
  form.uploadDir = uploadFolder;
  form.newFilename = form.originalFilename;

  form.parse(req, function(err, fields, files) {
      console.log(files);
      if (err) {
          console.log("Error parsing the files");
          return res.status(400).json({
              status: "Fail",
              message: "There was an error parsing the files",
              error: err,
            });
      }
      const file = files.my_file;
      const fileName = file.originalFilename;
      console.log(file);
      console.log(file.filepath);
      fs.renameSync(file.filepath, path.join(uploadFolder, fileName));
      return;
  });
  var json = JSON.stringify({ 
      created: true, 
       });
    res.end(json);
});

app.post("/download", async (req,res) => {
  console.log(req);
  try {
  const uploadFolder = path.join(__dirname, "public", "files",req.body.url);
  console.log(uploadFolder+'.mp4');
  // res.download(uploadFolder+'.mp4');
  const header = {
    'Content-Length': fs.statSync(uploadFolder+'.mp4').size,
    'Content-Type': 'video/mp4',
    };
  res.writeHead(200, header);
  fs.createReadStream(uploadFolder+'.mp4').pipe(res);
  }catch (e) {
    res.status(400);
  }
});