import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, Send, Check } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Order, InsertFeedback, Feedback } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FeedbackFormProps {
  order: Order;
  onFeedbackSubmitted?: () => void;
}

export default function FeedbackForm({ order, onFeedbackSubmitted }: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackType, setFeedbackType] = useState<"order" | "delivery" | "food_quality">("order");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  // Check if feedback already exists for this order
  const { data: existingFeedback } = useQuery<Feedback[]>({
    queryKey: [`/api/feedback/order/${order.id}`],
    enabled: !!order.id,
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: Omit<InsertFeedback, 'customerId'>) => {
      return apiRequest("POST", "/api/feedback", feedbackData);
    },
    onSuccess: () => {
      toast({
        title: "Thank you for your feedback!",
        description: "Your feedback has been submitted successfully.",
      });
      setIsSubmitted(true);
      onFeedbackSubmitted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit feedback",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitFeedback = () => {
    if (rating === 0) {
      toast({
        title: "Please provide a rating",
        description: "Rating is required to submit feedback.",
        variant: "destructive",
      });
      return;
    }

    const feedbackData: Omit<InsertFeedback, 'customerId'> = {
      orderId: order.id,
      restaurantId: order.restaurantId,
      rating,
      comment: comment.trim() || null,
      feedbackType,
      isAnonymous,
    };

    submitFeedbackMutation.mutate(feedbackData);
  };

  // Check if feedback already exists or was just submitted
  const hasFeedback = isSubmitted || (existingFeedback && existingFeedback.length > 0);

  if (hasFeedback) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Feedback Already Submitted!</h3>
          <p className="text-muted-foreground">
            Thank you for taking the time to share your experience with us.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
          Rate Your Experience
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Order #{order.id} • {order.isPabili ? 'Pabili Order' : 'Restaurant Order'}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Feedback Type */}
        <div>
          <Label htmlFor="feedback-type" className="text-sm font-medium">
            What would you like to rate?
          </Label>
          <Select value={feedbackType} onValueChange={(value: any) => setFeedbackType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Overall Order Experience</SelectItem>
              <SelectItem value="delivery">Delivery Service</SelectItem>
              {!order.isPabili && <SelectItem value="food_quality">Food Quality</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {/* Star Rating */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Rating *
          </Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="transition-colors"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {rating === 1 && "Poor - We'll work to improve"}
              {rating === 2 && "Fair - Room for improvement"}
              {rating === 3 && "Good - Satisfactory experience"}
              {rating === 4 && "Very Good - Great experience"}
              {rating === 5 && "Excellent - Outstanding experience"}
            </p>
          )}
        </div>

        {/* Comment */}
        <div>
          <Label htmlFor="comment" className="text-sm font-medium">
            Additional Comments (Optional)
          </Label>
          <Textarea
            id="comment"
            placeholder="Share your experience, suggestions, or any issues you encountered..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="mt-1"
          />
        </div>

        {/* Anonymous Option */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="anonymous"
            checked={isAnonymous}
            onCheckedChange={(checked) => setIsAnonymous(checked === true)}
          />
          <Label htmlFor="anonymous" className="text-sm">
            Submit feedback anonymously
          </Label>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmitFeedback}
          disabled={rating === 0 || submitFeedbackMutation.isPending}
          className="w-full gap-2"
        >
          {submitFeedbackMutation.isPending ? (
            <>Submitting...</>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Feedback
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
