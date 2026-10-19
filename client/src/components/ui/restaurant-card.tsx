import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, MapPin, ChevronRight, Edit, Trash2, ExternalLink, AlertCircle, Utensils, CheckCircle, XCircle } from "lucide-react";

interface RestaurantCardProps {
  id: number;
  name: string;
  imageUrl: string;
  categories: string[];
  rating?: number;
  reviewCount?: number;
  isActive: boolean;
  isApproved?: boolean;
  deliveryFee: number;
  deliveryTime: string;
  distance?: string;
  isAdmin: boolean;
  isRecommended?: boolean;
  onView: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onManageMenu?: (id: number) => void;
  onApprove?: (id: number) => void;
}

export function RestaurantCard({
  id,
  name,
  imageUrl,
  categories,
  rating = 0,
  reviewCount = 0,
  isActive,
  isApproved,
  deliveryFee,
  deliveryTime,
  distance,
  isAdmin,
  isRecommended = false,
  onView,
  onEdit,
  onDelete,
  onManageMenu,
  onApprove,
}: RestaurantCardProps) {
  const [, setLocation] = useLocation();

  return (
    <Card className={`overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col ${isRecommended ? 'ring-2 ring-primary shadow-lg' : ''}`}>
      <div className="relative">
        <div
          className="h-36 w-full bg-center bg-cover relative"
          style={{ backgroundImage: `url(${imageUrl})` }}
        >
          {isRecommended && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-primary text-white font-semibold">
                ⭐ AI Recommended
              </Badge>
            </div>
          )}
          {!isActive && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Badge variant="destructive" className="text-sm font-medium">
                Currently Closed
              </Badge>
            </div>
          )}
        </div>
      </div>

      <CardContent className="pt-3 flex-grow">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="font-bold text-lg line-clamp-1">{name}</h3>
          {isAdmin && (
            <Badge
              variant={isApproved ? "secondary" : "outline"}
              className={`ml-2 ${isApproved ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}`}
            >
              {isApproved ? (
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  <span>Approved</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  <span>Pending</span>
                </div>
              )}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          {categories && categories.slice(0, 3).map((category, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {category}
            </Badge>
          ))}
          {categories && categories.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{categories.length - 3} more
            </Badge>
          )}
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex items-center">
            <Clock className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
            <span>{deliveryTime}</span>
          </div>

          {distance && (
            <div className="flex items-center">
              <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
              <span>{distance}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0 pb-3">
        {isAdmin ? (
          <div className="flex flex-col w-full gap-2">
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onView(id)}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </Button>

              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => onDelete(id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            {onManageMenu && (
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => onManageMenu(id)}
              >
                <Utensils className="h-4 w-4 mr-1" />
                Manage Menu
              </Button>
            )}
            {onApprove && !isApproved && (
              <Button
                variant="default"
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onApprove(id)}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve Restaurant
              </Button>
            )}
          </div>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={() => onView(id)}
          >
            View Menu
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
