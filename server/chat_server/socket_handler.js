const MAX_CONNECTIONS_PER_USER = 5;
const CONNECTION_TIMEOUT = 12 * 60 * 60 * 1000;
const connectionTimestamps = new Map();

function setupSocketIO(io, client) {
  io.on("connection", async (socket) => {
    try {
      const user = socket.handshake.auth.user;
  
      if (!user || !user.id) {
        console.error("Socket connection rejected: No valid user provided");
        socket.disconnect(true);
        return;
      }

      const userId = user.id;
      console.log(`User ${userId} connected with socket ${socket.id}`);

      socket.emit("connection_established", { socketId: socket.id });

      connectionTimestamps.set(socket.id, Date.now());

      const userSockets = await client.smembers(`user:${userId}:sockets`);

      if (userSockets.length > 0) {
        for (const existingSocketId of userSockets) {
          const connectedSocket = io.sockets.sockets.get(existingSocketId);
          
          if (!connectedSocket) {
            await client.srem(`user:${userId}:sockets`, existingSocketId);
          } else {
            const timestamp = connectionTimestamps.get(existingSocketId);
            if (timestamp && (Date.now() - timestamp > CONNECTION_TIMEOUT)) {
              console.log(`Disconnecting expired socket ${existingSocketId} for user ${userId}`);
              connectedSocket.disconnect(true);
              await client.srem(`user:${userId}:sockets`, existingSocketId);
              connectionTimestamps.delete(existingSocketId);
            }
          }
        }
      }

      const updatedUserSockets = await client.smembers(`user:${userId}:sockets`);
      
      if (updatedUserSockets.length >= MAX_CONNECTIONS_PER_USER) {
        console.log(`User ${userId} has too many connections (${updatedUserSockets.length}), cleaning up oldest`);
        
        const socketTimestamps = updatedUserSockets
          .map(sid => ({ 
            socketId: sid, 
            timestamp: connectionTimestamps.get(sid) || Infinity 
          }))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        const socketsToRemove = socketTimestamps.slice(0, socketTimestamps.length - MAX_CONNECTIONS_PER_USER + 1);
        
        for (const { socketId } of socketsToRemove) {
          const oldSocket = io.sockets.sockets.get(socketId);
          if (oldSocket) {
            console.log(`Disconnecting excess socket ${socketId} for user ${userId}`);
            oldSocket.disconnect(true);
          }
          await client.srem(`user:${userId}:sockets`, socketId);
          connectionTimestamps.delete(socketId);
        }
      }

      await client.sadd(`user:${userId}:sockets`, socket.id);

      socket.on("ping", (data) => {
        connectionTimestamps.set(socket.id, Date.now());
        socket.emit("pong", { timestamp: Date.now() });
      });

      socket.on("disconnect", async () => {
        console.log(`User ${userId} disconnected socket ${socket.id}`);
        
        await client.srem(`user:${userId}:sockets`, socket.id);
        connectionTimestamps.delete(socket.id);
        
        const remainingSockets = await client.smembers(`user:${userId}:sockets`);
        if (remainingSockets.length === 0) {
          console.log(`User ${userId} has no remaining connections`);
        }
      });

      client
        .smembers(`user:${userId}:workspaces`)
        .then(async (workspaces) => {
          for (const workspaceId of workspaces) {
            try {
              const unreadMessages = await client.lrange(
                `workspace:${workspaceId}:unread:${userId}`,
                0,
                -1
              );

              unreadMessages.forEach((msg) => {
                try {
                  const parsedMsg = JSON.parse(msg);
                  socket.emit("message", parsedMsg);
                } catch (e) {
                  console.error("Error parsing message:", e);
                }
              });

              await client.del(`workspace:${workspaceId}:unread:${userId}`);
            } catch (err) {
              console.error(
                `Error processing unread messages for workspace ${workspaceId}:`,
                err
              );
            }
          }
        })
        .catch((err) => {
          console.error("Error retrieving user workspaces:", err);
        });

      socket.on("join_workspace", (workspaceId) => {
        console.log("SocketServer: Joining workspace", workspaceId, userId);
        if (userId) {
          client.sadd(`workspace:${workspaceId}:users`, userId)
            .then(() => client.sadd(`user:${userId}:workspaces`, workspaceId))
            .catch(err => {
              console.error(`Error adding user ${userId} to workspace ${workspaceId}:`, err);
            });
        }
      });

      socket.on("invite_to_workspace", (data) => {
        const { workspaceId, userIds } = data;
        for (const invitedUserId of userIds) {
          client.sadd(`workspace:${workspaceId}:users`, invitedUserId);
          client.sadd(`user:${invitedUserId}:workspaces`, workspaceId);
        }
      });

      socket.on("quit_workspace", (workspaceId) => {
        if (userId) {
          client.srem(`workspace:${workspaceId}:users`, userId);
          client.srem(`user:${userId}:workspaces`, workspaceId);
        }
      });

      socket.on("message", async (data) => {
        console.log("SocketServer: Received message", data);
        const workspaceId = data.workspaceId;

        try {
          const usersInWorkspace = await client.smembers(`workspace:${workspaceId}:users`);
          console.log("SocketServer: Users in workspace", workspaceId, usersInWorkspace);
          for (const targetUserId of usersInWorkspace) {
            const socketIds = await client.smembers(`user:${targetUserId}:sockets`);
            console.log("SocketServer: Sending message to", socketIds, "for workspace", workspaceId);
            if (socketIds.length > 0) {
              socketIds.forEach(socketId => {
                io.to(socketId).emit("message", data);
              });
            } else {
              await client.lpush(
                `workspace:${workspaceId}:unread:${targetUserId}`,
                JSON.stringify(data)
              );
            }
          }
        } catch (error) {
          console.error("Error processing message event:", error.message);
        }
      });

      socket.on("delete_message", async (data) => {
        const workspaceId = data.workspaceId;
        
        try {
          const usersInWorkspace = await client.smembers(`workspace:${workspaceId}:users`);
          for (const targetUserId of usersInWorkspace) {
            const socketIds = await client.smembers(`user:${targetUserId}:sockets`);
            if (socketIds.length > 0) {
              socketIds.forEach(socketId => {
                io.to(socketId).emit("message_deleted", data);
              });
            }
          }
        } catch (error) {
          console.error("Error in delete_message event:", error.message);
        }
      });
    } catch (error) {
      console.error("Error in socket connection handler:", error);
      socket.disconnect(true);
    }
  });

  const cleanupStaleConnections = async () => {
    try {
      const userKeys = await client.keys("user:*:sockets");
      for (const userKey of userKeys) {
        const userIdFromKey = userKey.split(":")[1];
        const userSockets = await client.smembers(userKey);
        for (const socketId of userSockets) {
          const socket = io.sockets.sockets.get(socketId);
          if (!socket) {
            console.log(`Cleaning up disconnected socket ${socketId} for user ${userIdFromKey}`);
            await client.srem(userKey, socketId);
            connectionTimestamps.delete(socketId);
          }
        }
      }
    } catch (error) {
      console.error("Error in periodic socket cleanup:", error);
    }
  };

  setInterval(cleanupStaleConnections, 12 * 60 * 60 * 1000);
}

async function sendRecentMessages(socket, client) {
  try {
    const messages = await client.lrange("dummyQueue", 0, 9);
    messages.forEach((msg) => {
      try {
        const parsedMsg = JSON.parse(msg);
        socket.emit("queueData", parsedMsg);
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    });
  } catch (err) {
    console.error("Error retrieving messages from Redis:", err);
  }
}


module.exports = { setupSocketIO };