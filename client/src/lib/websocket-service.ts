// WebSocket service for real-time communication
export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased for better resilience
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  private connectionPromise: Promise<WebSocket> | null = null;
  private isConnected = false;
  private authData: { role: string; userId?: number; riderId?: number; customerId?: number; restaurantId?: number } | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPingTime = 0;

  // Connect to the WebSocket server
  connect(): Promise<WebSocket> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection using the correct path
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        console.log('Connecting to WebSocket server at:', wsUrl);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          this.reconnectAttempts = 0;
          this.isConnected = true;

          // Re-authenticate if we have auth data
          if (this.authData) {
            this.send({
              type: 'auth',
              ...this.authData
            }).catch(console.error);
          }

          // Start ping/pong to keep connection alive
          this.startPing();

          resolve(this.socket!);
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.socket.onclose = (event) => {
          console.log('WebSocket connection closed', { code: event.code, reason: event.reason });
          this.isConnected = false;
          this.socket = null;
          this.connectionPromise = null;
          this.stopPing();

          // Only reconnect if it wasn't a clean close
          if (event.code !== 1000) {
            this.attemptReconnect();
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.socket?.close();
          reject(error);
        };
      } catch (error) {
        console.error('Error connecting to WebSocket server:', error);
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  // Attempt to reconnect to the WebSocket server
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached. Will continue trying every 30 seconds.`);
      // Continue trying every 30 seconds indefinitely
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempts = Math.max(this.reconnectAttempts - 1, 5); // Reset attempts partially
        this.attemptReconnect();
      }, 30000);
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000); // Max 10 seconds between attempts

    console.log(`Attempting to reconnect in ${delay / 1000} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        // Connection attempt failed, will try again if not at max attempts
      });
    }, delay);
  }

  // Start ping/pong mechanism to keep connection alive
  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
        this.lastPingTime = Date.now();
      }
    }, 30000); // Ping every 30 seconds
  }

  // Stop ping/pong mechanism
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Send a message to the WebSocket server
  async send(data: any): Promise<void> {
    try {
      const socket = await this.connect();
      socket.send(JSON.stringify(data));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      throw error;
    }
  }

  // Add a listener for a specific message type
  on(type: string, callback: (data: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)?.push(callback);
  }

  // Remove a listener for a specific message type
  off(type: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Handle incoming WebSocket messages
  private handleMessage(data: any): void {
    console.log('Received WebSocket message:', data);
    if (data && data.type) {
      const listeners = this.listeners.get(data.type);
      if (listeners) {
        listeners.forEach(callback => callback(data));
      }
    }
  }

  // Authenticate with the WebSocket server
  async authenticate(role: string, userId?: number, riderId?: number, customerId?: number, restaurantId?: number): Promise<void> {
    // Store auth data for reconnection
    this.authData = { role, userId, riderId, customerId, restaurantId };

    try {
      await this.send({
        type: 'auth',
        role,
        userId,
        riderId,
        customerId,
        restaurantId
      });
    } catch (error) {
      console.error('Error authenticating with WebSocket server:', error);
      throw error;
    }
  }

  // Check if WebSocket is connected
  getConnectionState(): boolean {
    return this.isConnected && this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  // Close the WebSocket connection
  close(): void {
    this.stopPing();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connectionPromise = null;
    this.authData = null;
    this.isConnected = false;
    this.listeners.clear();
  }
}

// Create a singleton instance of the WebSocket service
export const wsService = new WebSocketService();
