import { useState } from "react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UploadResult } from "@uppy/core";

interface BusinessPermitUploaderProps {
  onUploadComplete?: (permitUrl: string) => void;
  currentPermitUrl?: string;
  disabled?: boolean;
}

export function BusinessPermitUploader({
  onUploadComplete,
  currentPermitUrl,
  disabled = false
}: BusinessPermitUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPermitUrl, setUploadedPermitUrl] = useState(currentPermitUrl);
  const { toast } = useToast();

  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload");
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to get upload URL. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    setIsUploading(true);

    try {
      if (result.successful && result.successful.length > 0) {
        const uploadedFile = result.successful[0];
        const uploadUrl = uploadedFile.uploadURL;

        // Update restaurant with business permit URL
        const response = await apiRequest("PUT", "/api/restaurants/business-permit", {
          businessPermitUrl: uploadUrl,
        });

        if (response.ok) {
          const data = await response.json();
          const permitPath = data.objectPath || uploadUrl;

          setUploadedPermitUrl(permitPath);
          onUploadComplete?.(permitPath);

          toast({
            title: "Business Permit Uploaded",
            description: "Your business permit has been uploaded successfully and will be reviewed.",
          });
        } else {
          throw new Error("Failed to save business permit");
        }
      }
    } catch (error) {
      console.error("Error uploading business permit:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload business permit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getUploadStatus = () => {
    if (uploadedPermitUrl) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        text: "Business permit uploaded",
        badge: <Badge variant="secondary" className="bg-green-100 text-green-700">Uploaded</Badge>
      };
    }
    return {
      icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
      text: "Business permit required",
      badge: <Badge variant="outline" className="border-orange-500 text-orange-700">Required</Badge>
    };
  };

  const status = getUploadStatus();

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-blue-600" />
          Business Permit
          {status.badge}
        </CardTitle>
        <CardDescription>
          Upload your business permit for verification. This is required for restaurant approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Status */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          {status.icon}
          <div className="flex-1">
            <p className="font-medium text-sm">{status.text}</p>
            {uploadedPermitUrl && (
              <p className="text-xs text-gray-600 mt-1">
                Document submitted for review
              </p>
            )}
          </div>
        </div>

        {/* Upload Requirements */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Document Requirements</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Valid business permit from your local government</li>
            <li>• Clear, readable image (JPEG, PNG, PDF accepted)</li>
            <li>• File size should not exceed 10MB</li>
            <li>• Document should show business name and validity period</li>
          </ul>
        </div>

        {/* Upload Component */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <ObjectUploader
            maxNumberOfFiles={1}
            maxFileSize={10485760} // 10MB
            onGetUploadParameters={handleGetUploadParameters}
            onComplete={handleUploadComplete}
            buttonClassName="w-full h-12"
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="h-5 w-5" />
              <span>
                {uploadedPermitUrl ? "Replace Business Permit" : "Upload Business Permit"}
              </span>
            </div>
          </ObjectUploader>
        </div>

        {/* Loading State */}
        {isUploading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              Uploading and saving business permit...
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-gray-500 mt-4">
          <p><strong>Note:</strong> Your business permit will be reviewed by our team. Restaurant approval may take 1-2 business days after all required documents are submitted.</p>
        </div>
      </CardContent>
    </Card>
  );
}
