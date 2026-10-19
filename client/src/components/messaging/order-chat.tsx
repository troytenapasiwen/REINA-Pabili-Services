import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, X, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";

interface Message {
  id: number;
  orderId: number;
  senderId: number;
  senderType: 'customer' | 'rider';
  message: string;
  messageType: string;
  metadata: any;
  isRead: boolean;
  createdAt: string;
}

interface OrderChatProps {
  orderId: number;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: 'customer' | 'rider';
  otherUserName?: string;
}

export function OrderChat({ orderId, isOpen, onClose, currentUserRole, otherUserName }: OrderChatProps) {
  const { t } = useLanguage();
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClientInstance = useQueryClient();

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: [`/api/orders/${orderId}/messages`],
    enabled: isOpen,
    refetchInterval: 2000, // Poll for new messages every 2 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", `/api/orders/${orderId}/messages`, {
        message: message.trim(),
        messageType: "text",
        senderType: currentUserRole
      });
      return response.json();
    },
    onSuccess: () => {
      setMessageInput("");
      queryClientInstance.invalidateQueries({ queryKey: [`/api/orders/${orderId}/messages`] });
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const otherRole = currentUserRole === 'rider' ? 'customer' : 'rider';
  const chatTitle = otherUserName || (currentUserRole === 'rider' ? 'Customer' : 'Delivery Rider');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md h-[600px] p-0 flex flex-col">
        {/* Chat Header */}
        <DialogHeader className="p-4 border-b bg-primary/5 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-sm font-medium">{chatTitle}</DialogTitle>
                <p className="text-xs text-muted-foreground">Order #{orderId}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Start a conversation</p>
                <p className="text-xs mt-1">Send your first message below</p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.senderType === currentUserRole;
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2 max-w-[80%]",
                      isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarFallback className={cn(
                        "text-xs",
                        isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {message.senderType === 'rider' ? 'R' : 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "rounded-2xl px-3 py-2 max-w-full break-words",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}>
                      <p className="text-sm">{message.message}</p>
                      <p className={cn(
                        "text-xs mt-1 opacity-70",
                        isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {(() => {
                          try {
                            const date = new Date(message.createdAt);
                            return isNaN(date.getTime()) ? format(new Date(), 'HH:mm') : format(date, 'HH:mm');
                          } catch {
                            return format(new Date(), 'HH:mm');
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 rounded-full"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              size="sm"
              className="rounded-full px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
