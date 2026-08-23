package room

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

const roomCodeCharset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

type Hub struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		rooms: make(map[string]*Room),
	}
}

func (h *Hub) JoinOrCreateRoom(code string, client *Client) (*Room, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	code = strings.TrimSpace(code)

	if code == "" || code == "CREATE" || code == "      " {
		var newCode string
		for {
			newCode = generateCode(6)
			if _, exists := h.rooms[newCode]; !exists {
				break
			}
		}
		room := NewRoom(newCode, h)
		h.rooms[newCode] = room
		room.Register(client)
		return room, nil
	}

	room, exists := h.rooms[code]
	if !exists {
		room = NewRoom(code, h)
		h.rooms[code] = room
	}

	room.Register(client)
	return room, nil
}

func (h *Hub) DestroyRoom(code string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms, code)
}

// ServeWS handles the WebSocket upgrade — no auth required for TETO.
// The username is taken from the JOIN_ROOM packet.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := NewClient(h, conn)
	// Default username; will be overridden by JOIN_ROOM packet
	client.Username = "Guest"
	go client.WritePump()
	go client.ReadPump()
}

func (h *Hub) GetStats() (activeRooms int, activeClients int) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	activeRooms = len(h.rooms)
	for _, room := range h.rooms {
		room.mu.RLock()
		activeClients += len(room.Clients)
		room.mu.RUnlock()
	}
	return activeRooms, activeClients
}

func (h *Hub) HealthHandler(w http.ResponseWriter, r *http.Request) {
	activeRooms, activeClients := h.GetStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":         "ok",
		"server":         "TETO Watch Together",
		"active_rooms":   activeRooms,
		"active_clients": activeClients,
	})
}

func generateCode(length int) string {
	b := make([]byte, length)
	charsetLen := big.NewInt(int64(len(roomCodeCharset)))
	for i := range b {
		n, err := rand.Int(rand.Reader, charsetLen)
		if err != nil {
			b[i] = roomCodeCharset[i%len(roomCodeCharset)]
		} else {
			b[i] = roomCodeCharset[n.Int64()]
		}
	}
	return string(b)
}

func (h *Hub) RoomsInfoHandler(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	type roomInfo struct {
		Code    string   `json:"code"`
		Users   []string `json:"users"`
		HostIdx int      `json:"host_idx"`
	}

	rooms := make([]roomInfo, 0, len(h.rooms))
	for _, room := range h.rooms {
		room.mu.RLock()
		info := roomInfo{Code: room.Code}
		for c := range room.Clients {
			info.Users = append(info.Users, c.Username)
			if c.IsHost {
				info.HostIdx = len(info.Users) - 1
			}
		}
		room.mu.RUnlock()
		rooms = append(rooms, info)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rooms": rooms,
	})
}

func init() {
	fmt.Println("[TETO-WT] Room hub module loaded")
}
