import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Star, Clock, MapPin, ChevronRight, Edit, Trash2, ExternalLink, AlertCircle, Utensils, CheckCircle, XCircle, Bike } from "lucide-react";

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
  /**
   * "default" keeps the original card (used by admin / restaurant screens).
   * "customer" is the Reina Pabili branded card used on the customer home page only.
   */
  variant?: "default" | "customer";
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
  variant = "default",
  onView,
  onEdit,
  onDelete,
  onManageMenu,
  onApprove,
}: RestaurantCardProps) {
  const [, setLocation] = useLocation();

  // Customer-facing variant (never used for admin: falls through to the original card when isAdmin)
  if (variant === "customer" && !isAdmin) {
    return (
      <article
        className={`flex h-full flex-col border-2 border-[#282828] bg-white text-[#282828] ${
          isRecommended ? "shadow-[6px_6px_0_0_#F76043]" : "shadow-[4px_4px_0_0_#282828]"
        }`}
        aria-label={name}
      >
        <div className="relative h-40 w-full overflow-hidden border-b-2 border-[#282828] bg-[#FFD527]">
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${!isActive ? "grayscale" : ""}`}
          />
          {isRecommended && (
            <span className="absolute left-2 top-2 border-2 border-[#282828] bg-[#FFD527] px-2 py-0.5 text-xs font-extrabold">
              Nearest to you
            </span>
          )}
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#282828]/70">
              <span className="border-2 border-[#282828] bg-white px-3 py-1 text-sm font-extrabold">
                Currently closed
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-1 text-lg font-extrabold tracking-tight">{name}</h3>
            {rating > 0 && (
              <span className="flex shrink-0 items-center gap-1 border-2 border-[#282828] bg-[#FFD527] px-1.5 py-0.5 text-sm font-extrabold">
                <Star className="h-3.5 w-3.5 fill-[#282828]" aria-hidden="true" />
                <span>{rating.toFixed(1)}</span>
                <span className="sr-only">out of 5</span>
                {reviewCount > 0 && (
                  <span className="text-xs font-bold text-gray-700">({reviewCount})</span>
                )}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories?.slice(0, 3).map((category, index) => (
              <span
                key={`${category}-${index}`}
                className="border border-[#282828] bg-white px-2 py-0.5 text-xs font-bold"
              >
                {category}
              </span>
            ))}
            {categories && categories.length > 3 && (
              <span className="border border-gray-400 px-2 py-0.5 text-xs font-bold text-gray-700">
                +{categories.length - 3} more
              </span>
            )}
          </div>

          <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-semibold text-gray-800">
            <li className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {deliveryTime}
            </li>
            <li className="flex items-center gap-1.5">
              <Bike className="h-4 w-4 shrink-0" aria-hidden="true" />
              {deliveryFee > 0 ? formatCurrency(deliveryFee) : "Free delivery"}
            </li>
            {distance && (
              <li className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {distance}
              </li>
            )}
          </ul>

          <Button
            type="button"
            className="h-11 w-full rounded-none border-2 border-[#282828] bg-[#F76043] text-base font-bold text-[#282828] shadow-[3px_3px_0_0_#282828] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-[#FF7154] hover:shadow-[2px_2px_0_0_#282828] focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2 motion-reduce:transition-none"
            onClick={() => onView(id)}
          >
            View menu
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </article>
    );
  }

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