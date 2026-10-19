import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Order, InsertRiderFeedback, RiderFeedback } from "@shared/schema";

interface CustomerFeedbackFormProps {
  order: Order;
  onFeedbackSubmitted?: () => void;
}

export default function CustomerFeedbackForm({ order, onFeedbackSubmitted }: CustomerFeedbackFormProps) {
  const [overallRating, setOverallRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [paymentEase, setPaymentEase] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  // Check if feedback already exists for this order
  const { data: existingFeedback } = useQuery<RiderFeedback[]>({
    queryKey: [`/api/rider-feedback/order/${order.id}`],
    enabled: !!order.id,
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: InsertRiderFeedback) => {
      return apiRequest("POST", "/api/rider-feedback", feedbackData);
    },
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Thank you for rating this customer. Your feedback helps improve our service.",
      });
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: [`/api/rider-feedback/order/${order.id}`] });
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
    if (overallRating === 0) {
      toast({
        title: "Please provide a rating",
        description: "Overall rating is required to submit feedback.",
        variant: "destructive",
      });
      return;
    }

    const feedbackData: InsertRiderFeedback = {
      orderId: order.id,
      customerId: order.customerId,
      rating: overallRating,
      comment: comment.trim() || null,
      punctuality: punctuality || null,
      communication: communication || null,
      paymentEase: paymentEase || null,
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
            Thank you for rating this customer. Your feedback helps us maintain service quality.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Star rating component
  const StarRating = ({
    rating,
    setRating,
    hover,
    setHover,
    label
  }: {
    rating: number;
    setRating: (rating: number) => void;
    hover: number;
    setHover: (hover: number) => void;
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-1 hover:scale-110 transition-transform"
            data-testid={`star-${label.toLowerCase().replace(/\s+/g, '-')}-${star}`}
          >
            <Star
              className={`w-6 h-6 ${
                star <= (hover || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {rating > 0 ? `${rating} star${rating !== 1 ? 's' : ''}` : 'Not rated'}
        </span>
      </div>
    </div>
  );

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Rate Customer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Rating */}
        <StarRating
          rating={overallRating}
          setRating={setOverallRating}
          hover={hoveredRating}
          setHover={setHoveredRating}
          label="Overall Experience *"
        />

        {/* Additional Ratings */}
        <div className="space-y-4">
          <StarRating
            rating={punctuality}
            setRating={setPunctuality}
            hover={0}
            setHover={() => {}}
            label="Punctuality"
          />

          <StarRating
            rating={communication}
            setRating={setCommunication}
            hover={0}
            setHover={() => {}}
            label="Communication"
          />

          <StarRating
            rating={paymentEase}
            setRating={setPaymentEase}
            hover={0}
            setHover={() => {}}
            label="Payment Process"
          />
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <Label htmlFor="comment">Additional Comments (Optional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this customer..."
            rows={3}
            data-testid="feedback-comment"
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmitFeedback}
          className="w-full"
          disabled={submitFeedbackMutation.isPending}
          data-testid="submit-feedback-button"
        >
          {submitFeedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
        </Button>
      </CardContent>
    </Card>
  );
}
