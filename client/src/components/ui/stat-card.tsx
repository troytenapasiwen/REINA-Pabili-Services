import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  change?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  iconBgColor = "bg-primary/10",
  iconColor = "text-primary",
  change,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("border border-border", className)}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            <h3 className="text-2xl font-bold mt-1">{value}</h3>

            {change && (
              <p
                className={`text-sm flex items-center mt-1 ${
                  change.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {change.isPositive ? (
                  <ArrowUp className="mr-1 h-3 w-3" />
                ) : (
                  <ArrowDown className="mr-1 h-3 w-3" />
                )}
                {Math.abs(change.value)}%
                {change.label && <span className="text-muted-foreground ml-1">{change.label}</span>}
              </p>
            )}
          </div>

          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", iconBgColor, iconColor)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
