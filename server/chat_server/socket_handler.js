const axios = require("axios");

const MAX_CONNECTIONS_PER_USER = 5;
const CONNECTION_TIMEOUT = 12 * 60 * 60 * 1000;
const connectionTimestamps = new Map();

function setupSocketIO(io, client) {
  io.on("connection", async (socket) => {
    try {
      const user = socket.handshake.auth.user;
  
      if (!user || !user.id) {
        console.log("Socket connection rejected: No valid user provided");
        socket.disconnect(true);
        return;
      }

      const userId = user.id;
      console.log(`User ${userId} connected with socket ${socket.id}`);

      connectionTimestamps.set(socket.id, Date.now());

      const userSockets = await client.smembers(`user:${userId}:sockets`);
      console.log(`User ${userId} has ${userSockets.length} existing connections`);

      if (userSockets.length > 0) {
        for (const existingSocketId of userSockets) {
          const connectedSocket = io.sockets.sockets.get(existingSocketId);
          
          if (!connectedSocket) {
            console.log(`Removing stale socket ${existingSocketId} for user ${userId}`);
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
        console.log(`User ${userId} has too many connections (${updatedUserSockets.length}), cleaning up`);
        
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
        console.log("join_workspace", workspaceId, userId);

        if (userId) {
          client.sadd(`workspace:${workspaceId}:users`, userId)
            .then(() => {
              console.log(`Added user ${userId} to workspace ${workspaceId}`);
              return client.sadd(`user:${userId}:workspaces`, workspaceId);
            })
            .then(() => {
              console.log(`Added workspace ${workspaceId} to user ${userId}'s workspaces`);
            })
            .catch(err => {
              console.error(`Error adding user ${userId} to workspace ${workspaceId}:`, err);
            });
        }
      });

      socket.on("invite_to_workspace", (data) => {
        console.log("invite_to_workspace", data);

        const { workspaceId, userIds } = data;
        for (const userId of userIds) {
          client.sadd(`workspace:${workspaceId}:users`, userId);
          client.sadd(`user:${userId}:workspaces`, workspaceId);
        }
      });

      socket.on("quit_workspace", (workspaceId) => {
        console.log("quit_workspace", workspaceId);

        if (userId) {
          client.srem(`workspace:${workspaceId}:users`, userId);
          client.srem(`user:${userId}:workspaces`, workspaceId);
        }
      });

      socket.on("message", async (data) => {
        console.log("message==============", data);
        insertionMessageInAppDb(data);
        const workspaceId = data.workspace_id;

        try {
          const usersInWorkspace = await client.smembers(`workspace:${workspaceId}:users`);
          console.log("sending msg to usersInWorkspace", usersInWorkspace);
          
          for (const userId of usersInWorkspace) {
            const socketIds = await client.smembers(`user:${userId}:sockets`);
            console.log(`User ${userId} has ${socketIds.length} active connections`);

            if (socketIds.length > 0) {
              socketIds.forEach(socketId => {
                io.to(socketId).emit("message", data);
                console.log(`Message sent to socket ${socketId} for user ${userId}`);
              });
            } else {
              await client.lpush(
                `workspace:${workspaceId}:unread:${userId}`,
                JSON.stringify(data)
              );
              console.log("message stored in Redis for", userId);
            }
          }
        } catch (error) {
          console.log("error", error.message);
        }
      });

      socket.on("delete_message", async (data) => {
        console.log("delete_message", data);
        
        deleteMessageFromAppDb(data);
        
        const workspaceId = data.workspaceId;
        
        try {
          const usersInWorkspace = await client.smembers(`workspace:${workspaceId}:users`);
          console.log("sending delete notification to usersInWorkspace", usersInWorkspace);
          
          for (const userId of usersInWorkspace) {
            const socketIds = await client.smembers(`user:${userId}:sockets`);
            console.log(`User ${userId} has ${socketIds.length} active connections`);

            if (socketIds.length > 0) {
              socketIds.forEach(socketId => {
                io.to(socketId).emit("message_deleted", data);
                console.log(`Delete notification sent to socket ${socketId} for user ${userId}`);
              });
            }
          }
        } catch (error) {
          console.log("error in delete_message", error.message);
        }
      });

      socket.on("notification", async (data) => {
        console.log("notification", data);
        const workspaceId = data.workspace_id;
        let allReceivers = [];

        if (data.receivers && Array.isArray(data.receivers)) {
          allReceivers = [...data.receivers];
        }
        console.log(workspaceId);

        if (workspaceId) {
          try {
            const workspaceUsers = await client.smembers(`workspace:${workspaceId}:users`);
            allReceivers = [...new Set([...allReceivers, ...workspaceUsers])];
            console.log("allReceivers", allReceivers);
          } catch (error) {
            console.error(`Error getting users for workspace ${workspaceId}:`, error);
          }
        }

        for (const receiverId of allReceivers) {
          try {
            const socketIds = await client.smembers(`user:${receiverId}:sockets`);

            if (socketIds.length > 0) {
              socketIds.forEach(socketId => {
                io.to(socketId).emit("notification", data);
                console.log(`Notification sent to socket ${socketId} for user ${receiverId}`);
              });
            } else {
              console.log("No active sockets found for user", receiverId);
            }
          } catch (error) {
            console.error(
              `Error sending notification to user ${receiverId}:`,
              error
            );
          }
        }
      });
    } catch (error) {
      console.error("Error in socket connection handler:", error);
      socket.disconnect(true);
    }
  });

  const cleanupStaleConnections = async () => {
    try {
      console.log("Running periodic socket cleanup");
      
      const userKeys = await client.keys("user:*:sockets");
      
      for (const userKey of userKeys) {
        const userId = userKey.split(":")[1];
        const userSockets = await client.smembers(userKey);
        
        console.log(`Checking ${userSockets.length} sockets for user ${userId}`);
        
        for (const socketId of userSockets) {
          const socket = io.sockets.sockets.get(socketId);
          
          if (!socket) {
            console.log(`Cleaning up disconnected socket ${socketId} for user ${userId}`);
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

async function insertionMessageInAppDb(message) {
  // Dummy implementation
}

async function deleteMessageFromAppDb(message) {
  // Dummy implementation
}

async function checkUnreadMessages(userId) {
  console.log("TODO:");
}

module.exports = { setupSocketIO };