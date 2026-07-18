package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"miyo-stream/wt-server/room"
)

func main() {
	port := os.Getenv("WT_PORT")
	if port == "" {
		port = "5610"
	}

	hub := room.NewHub()

	http.HandleFunc("/ws", hub.ServeWS)
	http.HandleFunc("/health", hub.HealthHandler)
	http.HandleFunc("/rooms", hub.RoomsInfoHandler)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintf(w, "MIYO Watch Together WebSocket Server is running.\nConnect via WebSocket to /ws")
	})

	log.Printf("[MIYO-WT] Watch Together server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
