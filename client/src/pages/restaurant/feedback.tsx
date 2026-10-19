import React from "react";
import RestaurantLayout from "@/layouts/RestaurantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Feedback, Restaurant } from "@shared/schema";
import { Star, MessageSquare, Clock, TrendingUp, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RestaurantFeedback() {
  const { user } = useAuth();

  // Get restaurant data for the logged-in user
  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants/by-user"],
    enabled: !!user?.id,
  });

  // Fetch feedback for this restaurant
  const { data: feedbackList, isLoading } = useQuery<Feedback[]>({
    queryKey: [`/api/feedback/restaurant/${restaurant?.id}`],
    enabled: !!restaurant?.id,
  });

  if (isLoading) {
    return (
      <RestaurantLayout>
        <div className="flex justify-center items-center p-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      </RestaurantLayout>
    );
  }

  // Calculate statistics
  const totalFeedback = feedbackList?.length || 0;
  const averageRating = feedbackList?.length
    ? (feedbackList.reduce((sum, fb) => sum + fb.rating, 0) / feedbackList.length).toFixed(1)
    : '0.0';

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: feedbackList?.filter(fb => fb.rating === rating).length || 0,
    percentage: totalFeedback > 0
      ? ((feedbackList?.filter(fb => fb.rating === rating).length || 0) / totalFeedback * 100).toFixed(1)
      : '0.0'
  }));

  return (
    <RestaurantLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Feedback</h1>
          <p className="text-muted-foreground">
            Review customer feedback and ratings for your restaurant
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFeedback}</div>
              <p className="text-xs text-muted-foreground">
                Customer reviews received
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center">
                {averageRating}
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 ml-1" />
              </div>
              <p className="text-xs text-muted-foreground">
                Out of 5 stars
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rating Trend</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {parseFloat(averageRating) >= 4.0 ? 'Excellent' : parseFloat(averageRating) >= 3.0 ? 'Good' : 'Needs Improvement'}
              </div>
              <p className="text-xs text-muted-foreground">
                Overall performance
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Rating Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ratingDistribution.map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 w-20">
                    <span className="text-sm font-medium">{rating}</span>
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  </div>

                  <div className="flex-1 h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="flex items-center space-x-2 w-20">
                    <span className="text-sm text-muted-foreground">{count}</span>
                    <span className="text-xs text-muted-foreground">({percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="mr-2 h-5 w-5" />
              Recent Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalFeedback === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No feedback yet</h3>
                <p className="text-muted-foreground">
                  Customer feedback will appear here once orders are delivered and reviewed.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbackList
                  ?.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                  .map((feedback, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= feedback.rating
                                    ? 'text-yellow-500 fill-yellow-500'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-medium">Order #{feedback.orderId.toString().padStart(4, '0')}</span>
                        </div>

                        <Badge variant="outline" className="text-xs">
                          {feedback.createdAt
                            ? new Date(feedback.createdAt).toLocaleDateString()
                            : 'Recent'
                          }
                        </Badge>
                      </div>

                      {feedback.comment && (
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-sm">{feedback.comment}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RestaurantLayout>
  );
}
