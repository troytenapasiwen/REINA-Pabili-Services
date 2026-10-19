import React from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Star, MessageSquare, Calendar, User, Store, Eye, Bike } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Feedback, Restaurant, Order, Rider, User as UserType } from "@shared/schema";
import { Link } from "wouter";

export default function AdminFeedbackPage() {
  // Fetch all feedback
  const { data: feedbackList, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/feedback"],
  });

  // Fetch restaurants data for display names
  const { data: restaurants } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  // Fetch orders data to get rider information
  const { data: orders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Fetch riders data for display names
  const { data: riders } = useQuery<Rider[]>({
    queryKey: ["/api/riders"],
  });

  // Fetch users data for rider names
  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  if (isLoading) {
    return (
      <AdminLayout title="Reviews & Feedback" description="View all customer reviews and feedback">
        <div className="flex justify-center items-center p-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

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

  const getRestaurantName = (restaurantId: number | null) => {
    if (!restaurantId) return "Pabili Service";
    const restaurant = restaurants?.find(r => r.id === restaurantId);
    return restaurant?.name || `Restaurant #${restaurantId}`;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getFeedbackTypeLabel = (type: string) => {
    switch (type) {
      case 'order': return 'Overall Order';
      case 'delivery': return 'Delivery Service';
      case 'food_quality': return 'Food Quality';
      default: return 'General';
    }
  };

  const getDeliveryDriverInfo = (orderId: number) => {
    const order = orders?.find(o => o.id === orderId);
    if (!order?.riderId) return null;

    const rider = riders?.find(r => r.id === order.riderId);
    const riderUser = rider ? users?.find(u => u.id === rider.userId) : null;

    return {
      riderName: riderUser?.fullName || riderUser?.username || `Rider #${order.riderId}`,
      riderId: order.riderId
    };
  };

  return (
    <AdminLayout title="Reviews & Feedback" description="View all customer reviews and feedback">
      <div className="space-y-8">
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
                Customer feedback submissions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                {averageRating}
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              </div>
              <p className="text-xs text-muted-foreground">
                Overall customer satisfaction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rating Distribution</CardTitle>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {ratingDistribution.map(({ rating, count, percentage }) => (
                  <div key={rating} className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1 w-10">
                      <span>{rating}</span>
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feedback List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              All Customer Feedback
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Complete list of customer reviews and feedback
            </p>
          </CardHeader>
          <CardContent>
            {totalFeedback === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Feedback Yet</h3>
                <p className="text-muted-foreground">
                  Customer feedback will appear here once they start leaving reviews.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbackList
                  ?.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                  .map((feedback) => (
                  <div
                    key={feedback.id}
                    className="border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < feedback.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          <span className={`font-semibold ${getRatingColor(feedback.rating)}`}>
                            {feedback.rating}/5
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Store className="h-4 w-4" />
                          <span>{getRestaurantName(feedback.restaurantId)}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            {getFeedbackTypeLabel(feedback.feedbackType || 'order')}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/orders`}>
                          <Button variant="ghost" size="sm" className="text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            Order #{feedback.orderId}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Comment */}
                    {feedback.comment && (
                      <div className="pl-2 border-l-2 border-muted">
                        <p className="text-sm text-gray-700 italic">
                          "{feedback.comment}"
                        </p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {feedback.isAnonymous ? (
                            <span>Anonymous Customer</span>
                          ) : (
                            <span>Customer #{feedback.customerId}</span>
                          )}
                        </div>
                        {(() => {
                          const driverInfo = getDeliveryDriverInfo(feedback.orderId);
                          return driverInfo ? (
                            <div className="flex items-center gap-1">
                              <Bike className="h-3 w-3" />
                              <span>{driverInfo.riderName}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Bike className="h-3 w-3" />
                              <span>No driver assigned</span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(feedback.createdAt || '').toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
