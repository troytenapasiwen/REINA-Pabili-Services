import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Phone, User } from 'lucide-react';
import { wsService } from '@/lib/websocket-service';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  senderId: number;
  senderType: 'customer' | 'rider';
  message: string;
  timestamp: string;
  orderId: number;
}

interface RiderChatProps {
  orderId: number;
  riderId: number;
  riderName: string;
  riderPhone?: string;
  customerId: number;
  orderStatus: string;
}

export default function RiderChat({
  orderId,
  riderId,
  riderName,
  riderPhone,
  customerId,
  orderStatus
}: RiderChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`);
      if (response.ok) {
        const chatHistory = await response.json();
        setMessages(chatHistory);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  useEffect(() => {
    let messageHandler: ((data: any) => void) | null = null;

    const connectAndListen = async () => {
      try {
        await wsService.connect();
        await wsService.authenticate('customer', customerId, undefined, customerId);
        setIsConnected(true);

        // Define message handler
        messageHandler = (data: any) => {
          if (data.orderId === orderId && data.type === 'chat_message') {
            const newMsg: Message = {
              id: data.messageId || `msg_${Date.now()}`,
              senderId: data.senderId,
              senderType: data.senderType,
              message: data.message,
              timestamp: data.timestamp || new Date().toISOString(),
              orderId: data.orderId
            };
            setMessages(prev => [...prev, newMsg]);
          }
        };

        // Listen for incoming messages
        wsService.on('chat_message', messageHandler);

        // Load chat history
        loadChatHistory();
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setIsConnected(false);
      }
    };

    if (orderStatus === 'picked_up' || orderStatus === 'on_the_way') {
      connectAndListen();
    }

    return () => {
      if (messageHandler) {
        wsService.off('chat_message', messageHandler);
      }
    };
  }, [orderId, riderId, customerId, orderStatus]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !isConnected) return;

    setIsLoading(true);
    try {
      // Send via WebSocket for real-time delivery
      await wsService.send({
        type: 'send_chat_message',
        orderId,
        riderId,
        customerId,
        message: newMessage,
        senderType: 'customer'
      });

      // Also save to backend
      await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage,
          senderType: 'customer'
        }),
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (orderStatus !== 'picked_up' && orderStatus !== 'on_the_way') {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-[#F06445]" />
            <span className="text-lg">Chat with Rider</span>
          </div>
          <Badge variant={isConnected ? 'outline' : 'secondary'}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </Badge>
        </CardTitle>

        {/* Rider Info */}
        <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span className="font-medium">{riderName}</span>
          </div>
          {riderPhone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`tel:${riderPhone}`, '_self')}
            >
              <Phone className="h-4 w-4 mr-1" />
              Call
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Messages */}
        <div className="h-64 overflow-y-auto space-y-3 mb-4 border rounded-lg p-3 bg-muted/20">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderType === 'customer' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.senderType === 'customer'
                      ? 'bg-[#F06445] text-white'
                      : 'bg-white border'
                  }`}
                >
                  <p className="text-sm">{message.message}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.senderType === 'customer'
                        ? 'text-white/70'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={!isConnected || isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected || isLoading}
            size="sm"
            className="bg-[#F06445] hover:bg-[#F06445]/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {!isConnected && (
          <p className="text-xs text-muted-foreground mt-2">
            Connecting to chat service...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
