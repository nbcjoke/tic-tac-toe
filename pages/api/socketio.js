import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const Socketio = (req, res) => {
  const WIN_CON = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  let ROOMS = [];
  let PLAYERS = [];

  res.status(200).json({ user: "hazel" });

  if (!res.socket.server.io) {
    const io = new Server(res.socket.server);

    const isPlayerExist = (obj) => {
      for (let i = 0; i < PLAYERS.length; i++) {
        if (PLAYERS[i].id === obj.id && PLAYERS[i].name === obj.name) {
          return true;
        }
      }

      return false;
    };

    io.on("connection", (socket) => {
      const emitserverData = () => {
        io.emit("server-data", {
          onlinePlayers: PLAYERS.filter((p) => {
            if (p.status === "online") {
              return true;
            }

            return false;
          }).length,
        });
      };

      socket.onAny((event, args) => {
        if (event === "player-details") {
          if (args.type === "initial") {
            const obj = {
              socketId: socket.id,
              id: args.id,
              name: args.name,
              win: 0,
              lose: 0,
              draw: 0,
              status: "online",
            };

            if (!isPlayerExist(obj)) {
              PLAYERS.push(obj);
            } else {
              const objIndex = PLAYERS.findIndex((obj) => obj.id === args.id);
              PLAYERS[objIndex].status = "online";
              PLAYERS[objIndex].socketId = socket.id;
            }
          }
        }

        emitserverData();
      });

      socket.on("enemy-timer", (data) => {
        socket.to(data.room).emit("enemy-timer", { timer: data.timer });
      });

      socket.on("disconnecting", () => {
        const room = Array.from(socket.rooms)[1];
        socket.leave(room);
        socket.to(room).emit("exit-room", {});

        const objIndex = PLAYERS.findIndex((obj) => obj.socketId === socket.id);
        if (objIndex >= 0) {
          PLAYERS[objIndex].status = "offline";
          PLAYERS[objIndex].socketId = "";
        }

        ROOMS = ROOMS.filter((item) => item.hostId !== socket.id);
        emitserverData();
      });

      socket.on("exit-room", (data, callback) => {
        socket.leave(data.room);
        ROOMS = ROOMS.filter((item) => item.room !== data.room);
        callback({
          status: "ok",
        });
        socket.to(data.room).emit("exit-room", {});
      });

      socket.on("rematch", (data, callback) => {
        socket.to(data.room).emit("rematch");

        if (typeof data.acceptRematch !== "undefined") {
          if (data.acceptRematch) {
            io.to(data.room).emit("game-ready", {
              isReady: true,
            });
          }
        }

        callback({
          status: "ok",
        });
      });

      socket.on("move", (data) => {
        socket.to(data.room).emit("move", {
          moves: data.moves,
          turn: data.turn,
        });

        const winObj = checkWinV2(data.turn, data.moves);
        if (winObj !== false) {
          io.to(data.room).emit("game-result", {
            winner: winObj.symbol,
            result: "done",
            combination: winObj.combination,
          });
        } else if (isDraw(data.moves)) {
          io.to(data.room).emit("game-result", {
            winner: "none",
            result: "draw",
          });
        }
      });

      socket.on("times-up", (data) => {
        io.to(data.room).emit("game-result", {
          winner: "none",
          result: "timesup",
          winner: data.symbol === "x" ? "circle" : "x",
        });
      });

      socket.on("join-room", (data) => {
        getAvailableRoom(io).then((r) => {
          if (r) {
            getRoomDetails(r).then((h) => {
              if (h) {
                socket.emit("joined-room", {
                  room: r,
                  isHost: false,
                  isReady: true,
                  name:
                    typeof h.hostName === "undefined" ||
                    h.hostName === null ||
                    h.hostName === ""
                      ? "unknown"
                      : h.hostName,
                });
                socket.to(r).emit("game-ready", {
                  isReady: true,
                  name: data.name,
                });

                socket.join(r);
              }
            });
          } else {
            let autoroom = uuidv4();
            socket.join(autoroom);
            ROOMS.push({
              hostId: data.id,
              hostName: data.name,
              room: autoroom,
            });
            socket.emit("joined-room", {
              room: autoroom,
              isHost: true,
              isReady: false,
            });
          }
        });
      });
    });

    function getActiveRooms(io) {
      const arr = Array.from(io.sockets.adapter.rooms);
      const filtered = arr.filter((room) => !room[1].has(room[0]));
      const res = filtered.map((i) => i[0]);
      return res;
    }

    const isDraw = (_moves) => {
      return [..._moves].every((index) => {
        return index === "circle" || index === "x";
      });
    };

    const checkWinV2 = (symbol, _moves) => {
      for (let i = 0; i < WIN_CON.length; i++) {
        const c = WIN_CON[i].every((index) => _moves[index] === symbol);
        if (c) return { combination: WIN_CON[i], symbol: symbol };
      }
      return false;
    };

    const getAvailableRoom = async (io) => {
      const rooms = getActiveRooms(io);
      for (let room of rooms) {
        let c = await io.in(room).fetchSockets();
        let filtered = c.map(function (item) {
          return item.id;
        });
        if (filtered.length === 1) {
          return room;
        } else {
          console.log("no room available");
        }
      }
    };

    const getRoomDetails = async (room) => {
      const h = await ROOMS.find((item) => item.room === room);
      if (h) {
        return h;
      } else {
        console.log("Error: No room found, Function: getRoomDetails");
      }
    };

    res.socket.server.io = io;
  } else {
  }
  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default Socketio;
