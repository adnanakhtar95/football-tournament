
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api";



interface MatchUpdate {
  type?: string;
  event?: string;
  match_id?: number;
  status?: "scheduled" | "live" | "finished";
  home_score?: number;
  away_score?: number;
}


export default function HomeRealtime() {
  const router = useRouter();

  const [connected, setConnected] = useState(false);

  const refreshTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  useEffect(() => {
    let active = true;

    let socket: WebSocket | null = null;

    let reconnectTimer: ReturnType<typeof setTimeout> | null =
      null;

    
    function refreshHomepage() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        if (!active) return;

        console.log(
          "[HOME WS] Refreshing homepage data"
        );

        router.refresh();
      }, 350);
    }

    

    function connect() {
      if (!active) return;

      const backendUrl = new URL(API_BASE_URL);

      const protocol =
        backendUrl.protocol === "https:" ? "wss:" : "ws:";

      const socketUrl = `${protocol}//${backendUrl.host}/ws/live/`;

      const currentSocket = new WebSocket(socketUrl);

      socket = currentSocket;

     
      currentSocket.addEventListener("open", () => {
        if (!active) {
          currentSocket.close(
            1000,
            "Component unmounted"
          );
        }
      });

      /* =========================================
         CONNECTION OPENED
      ========================================= */

      currentSocket.onopen = () => {
        if (!active) return;

        console.log(
          "[HOME WS] Connected successfully"
        );

        setConnected(true);

        // Recover changes missed while disconnected.
        refreshHomepage();
      };

      /* =========================================
         REALTIME MESSAGE RECEIVED
      ========================================= */

      currentSocket.onmessage = (message: MessageEvent) => {
        if (!active) return;

        console.log(
          "[HOME WS] Message received:",
          message.data
        );

        try {
          const data = JSON.parse(
            message.data
          ) as MatchUpdate;

          // Ignore connection and heartbeat messages.
          if (data.type === "connection") {
            return;
          }

          // Refresh homepage for relevant match changes.
          if (
            data.match_id !== undefined ||
            data.event === "match_started" ||
            data.event === "match_finished"
          ) {
            refreshHomepage();
          }
        } catch (error) {
          console.error(
            "Homepage WebSocket message error:",
            error
          );
        }
      };

      /* =========================================
         CONNECTION ERROR
      ========================================= */

      currentSocket.onerror = () => {
        if (!active) return;

        console.error(
          "[HOME WS] WebSocket connection error"
        );

        setConnected(false);
      };

      /* =========================================
         CONNECTION CLOSED / RECONNECT
      ========================================= */

      currentSocket.onclose = () => {
        if (!active) return;

        console.log(
          "[HOME WS] Connection closed. Reconnecting..."
        );

        setConnected(false);

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        reconnectTimer = setTimeout(() => {
          if (active) {
            connect();
          }
        }, 3000);
      };
    }

    /* =========================================
       START CONNECTION
    ========================================= */

    connect();

    /* =========================================
       SAFE CLEANUP

       Prevents:
       "WebSocket is closed before the
       connection is established."
    ========================================= */

    return () => {
      active = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }

      const currentSocket = socket;

      if (!currentSocket) return;

      // Remove handlers to prevent updates after unmount.
      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;

      if (currentSocket.readyState === WebSocket.OPEN) {
        // Already connected: close normally.
        currentSocket.close(
          1000,
          "Component unmounted"
        );
      }

      /*
        Do not call close() while CONNECTING.

        The addEventListener("open") handler registered
        above will close the abandoned connection
        after its handshake completes.
      */
    };
  }, [router]);

  /* =========================================
     CONNECTION STATUS INDICATOR
  ========================================= */

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        connected
          ? "border-green-800 bg-green-950/40 text-green-400"
          : "border-slate-700 bg-slate-900 text-slate-400"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          connected
            ? "animate-pulse bg-green-400"
            : "bg-slate-500"
        }`}
      />

      {connected
        ? "Live Updates Connected"
        : "Connecting to Live Updates..."}
    </div>
  );
}
