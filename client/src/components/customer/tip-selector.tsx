import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, DollarSign } from "lucide-react";

interface TipSelectorProps {
  totalAmount: number;
  onTipChange: (tipAmount: number) => void;
  selectedTip?: number;
}

export function TipSelector({ totalAmount, onTipChange, selectedTip = 0 }: TipSelectorProps) {
  const [customTip, setCustomTip] = useState<string>("");
  const [selectedTipType, setSelectedTipType] = useState<"preset" | "custom" | "none">(
    selectedTip > 0 ? "preset" : "none"
  );

  // Preset tip amounts in pesos
  const presetTips = [
    { label: "₱10", value: 10 },
    { label: "₱20", value: 20 },
    { label: "₱30", value: 30 },
    { label: "₱50", value: 50 },
  ];

  // Percentage-based tips
  const percentageTips = [
    { label: "10%", value: Math.round(totalAmount * 0.1) },
    { label: "15%", value: Math.round(totalAmount * 0.15) },
    { label: "20%", value: Math.round(totalAmount * 0.2) },
  ];

  const handlePresetTip = (amount: number) => {
    setSelectedTipType("preset");
    setCustomTip("");
    onTipChange(amount);
  };

  const handleCustomTip = (value: string) => {
    setCustomTip(value);
    setSelectedTipType("custom");
    const amount = parseFloat(value) || 0;
    onTipChange(amount);
  };

  const handleNoTip = () => {
    setSelectedTipType("none");
    setCustomTip("");
    onTipChange(0);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Heart className="h-5 w-5 text-red-500" />
          Add a Tip for Your Rider
        </CardTitle>
        <CardDescription>
          Show your appreciation for great service. Tips go directly to your delivery rider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* No Tip Option */}
        <Button
          variant={selectedTipType === "none" ? "default" : "outline"}
          className="w-full"
          onClick={handleNoTip}
        >
          No Tip
        </Button>

        {/* Preset Fixed Amounts */}
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2 block">Quick Tip Amounts</Label>
          <div className="grid grid-cols-2 gap-2">
            {presetTips.map((tip) => (
              <Button
                key={tip.value}
                variant={selectedTip === tip.value && selectedTipType === "preset" ? "default" : "outline"}
                onClick={() => handlePresetTip(tip.value)}
                className="h-12"
              >
                {tip.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Percentage-based Tips */}
        {totalAmount > 0 && (
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Percentage-based Tips</Label>
            <div className="grid grid-cols-3 gap-2">
              {percentageTips.map((tip) => (
                <Button
                  key={tip.label}
                  variant={selectedTip === tip.value && selectedTipType === "preset" ? "default" : "outline"}
                  onClick={() => handlePresetTip(tip.value)}
                  className="h-12 flex flex-col gap-1"
                  disabled={tip.value <= 0}
                >
                  <span className="text-xs">{tip.label}</span>
                  <span className="text-xs font-normal">₱{tip.value}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Tip Input */}
        <div>
          <Label htmlFor="custom-tip" className="text-sm font-medium text-gray-700 mb-2 block">
            Custom Tip Amount
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="custom-tip"
              type="number"
              placeholder="Enter custom amount"
              value={customTip}
              onChange={(e) => handleCustomTip(e.target.value)}
              className="pl-10"
              min="0"
              step="1"
            />
          </div>
          {selectedTipType === "custom" && customTip && (
            <p className="text-sm text-gray-600 mt-1">
              Tip amount: ₱{parseFloat(customTip) || 0}
            </p>
          )}
        </div>

        {/* Selected Tip Summary */}
        {selectedTip > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-800">Tip for Rider:</span>
              <span className="text-sm font-bold text-green-800">₱{selectedTip.toFixed(2)}</span>
            </div>
            <p className="text-xs text-green-600 mt-1">Thank you for supporting our riders!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
