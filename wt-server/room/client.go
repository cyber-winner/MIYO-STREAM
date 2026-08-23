package room

import (
	"log"
	"time"

	"miyo-stream/wt-server/protocol"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

type Client struct {
	ID         byte
	Username   string
	Provider   string
	Hub        *Hub
	Room       *Room
	Conn       *websocket.Conn
	Send       chan []byte
	IsHost     bool
	IsCoHost   bool
	msgCounter int
	lastReset  time.Time
}

func NewClient(hub *Hub, conn *websocket.Conn) *Client {
	return &Client{
		Hub:       hub,
		Conn:      conn,
		Send:      make(chan []byte, 256),
		lastReset: time.Now(),
	}
}

func (c *Client) ReadPump() {
	defer func() {
		if c.Room != nil {
			c.Room.Unregister(c)
		}
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("client %s read error: %v", c.Username, err)
			}
			break
		}

		if len(message) == 0 {
			continue
		}

		// Rate limit: max 30 messages per second
		now := time.Now()
		if now.Sub(c.lastReset) > time.Second {
			c.msgCounter = 0
			c.lastReset = now
		}
		c.msgCounter++
		if c.msgCounter > 30 {
			continue
		}

		c.handleMessage(message)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.BinaryMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(data []byte) {
	opcode := data[0]

	switch opcode {
	case protocol.OpJoinRoom:
		code, username, provider, err := protocol.DecodeJoinRoom(data)
		if err != nil {
			c.Send <- protocol.EncodeError(0x01, "Invalid join packet")
			return
		}
		// TETO: No MAL auth — accept any username from the JOIN packet
		if username != "" {
			c.Username = username
		}
		if c.Username == "" {
			c.Username = "Guest"
		}
		c.Provider = provider
		room, err := c.Hub.JoinOrCreateRoom(code, c)
		if err != nil {
			c.Send <- protocol.EncodeError(0x02, err.Error())
			return
		}
		c.Room = room

	case protocol.OpPlayPause, protocol.OpTimeSync, protocol.OpAddQueue, protocol.OpRemoveQueue:
		if c.Room != nil {
			c.Room.Broadcast(data, c)
		}

	case protocol.OpLoadMedia:
		if c.Room != nil {
			c.Room.HandleLoadMedia(data, c)
		}

	case protocol.OpClientReady:
		if c.Room != nil {
			c.Room.HandleClientReady(c)
		}

	case protocol.OpChatMsg:
		if c.Room != nil {
			c.Room.BroadcastChat(data, c)
		}

	case protocol.OpUserEvent:
		if c.Room != nil && c.IsHost {
			eType, uID, val, err := protocol.DecodeUserEvent(data)
			if err == nil && eType == 0x03 {
				c.Room.mu.Lock()
				var targetClient *Client
				for client, id := range c.Room.Clients {
					if id == uID {
						targetClient = client
						break
					}
				}
				if targetClient != nil {
					isCoHost := len(val) == 1 && val[0] == '1'
					targetClient.IsCoHost = isCoHost
					c.Room.mu.Unlock()
					c.Room.Broadcast(data, nil)
				} else {
					c.Room.mu.Unlock()
				}
			}
		}

	case protocol.OpPing:
		pong := make([]byte, len(data))
		copy(pong, data)
		pong[0] = protocol.OpPong
		c.Send <- pong

	case protocol.OpCaptionSync, protocol.OpVoiceState:
		// Broadcast to everyone else in the room
		if c.Room != nil {
			c.Room.Broadcast(data, c)
		}

	case protocol.OpVoiceSignal:
		// Targeted relay: [0x10] [targetUserID] [rest...]
		// Rewrite byte 1 to sender's ID, then send to target
		if c.Room != nil && len(data) >= 2 {
			targetID := data[1]
			relayed := make([]byte, len(data))
			copy(relayed, data)
			relayed[1] = c.ID // replace target with sender ID
			c.Room.SendToUser(targetID, relayed)
		}
	}
}
