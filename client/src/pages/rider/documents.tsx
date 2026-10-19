import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { FileImage, Upload, Check, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RiderDocuments {
  licensePhotoUrl?: string;
  riderPhotoUrl?: string;
  isVerified?: boolean;
}

export default function RiderDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Fetch rider data
  const { data: riderData } = useQuery({
    queryKey: ["/api/riders/current"],
    enabled: !!user,
  });

  // Update documents mutation
  const updateDocumentsMutation = useMutation({
    mutationFn: async (data: { licensePhotoUrl?: string; riderPhotoUrl?: string }) => {
      const response = await fetch("/api/riders/documents", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update documents");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/riders/current"] });
      toast({
        title: "Success",
        description: "Documents updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update documents",
        variant: "destructive",
      });
    },
  });

  // Get upload URL
  const getUploadParameters = async () => {
    const response = await fetch("/api/riders/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get upload URL");
    }

    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  // Handle license photo upload
  const handleLicenseUploadComplete = (result: any) => {
    setUploadingLicense(false);
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      updateDocumentsMutation.mutate({
        licensePhotoUrl: uploadedFile.uploadURL,
      });
    }
  };

  // Handle rider photo upload
  const handleRiderPhotoUploadComplete = (result: any) => {
    setUploadingPhoto(false);
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      updateDocumentsMutation.mutate({
        riderPhotoUrl: uploadedFile.uploadURL,
      });
    }
  };

  const hasLicense = (riderData as any)?.licensePhotoUrl;
  const hasPhoto = (riderData as any)?.riderPhotoUrl;
  const isVerified = (riderData as any)?.isVerified;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Document Verification</h1>
        <p className="text-gray-600 mt-2">
          Upload your license and photo to complete your rider verification
        </p>
      </div>

      {/* Verification Status */}
      <Alert className={`mb-6 ${isVerified ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
        <AlertCircle className={`h-4 w-4 ${isVerified ? 'text-green-600' : 'text-orange-600'}`} />
        <AlertDescription className={isVerified ? 'text-green-800' : 'text-orange-800'}>
          {isVerified
            ? "Your documents have been verified. You can now accept ride requests."
            : "Upload both documents below for admin verification. This process may take 24-48 hours."
          }
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* License Photo Upload */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
              Driver's License
            </CardTitle>
            <CardDescription>
              Upload a clear photo of your valid driver's license
            </CardDescription>
            {hasLicense && (
              <Badge variant="outline" className="w-fit mx-auto">
                <Check className="h-3 w-3 mr-1" />
                Uploaded
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {hasLicense ? (
              <div className="text-center space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-800">License photo uploaded</p>
                  <p className="text-xs text-green-600 mt-1">
                    Waiting for admin verification
                  </p>
                </div>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  allowedFileTypes={["image/*"]}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={handleLicenseUploadComplete}
                  buttonClassName="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Replace License Photo
                </ObjectUploader>
              </div>
            ) : (
              <div className="text-center">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4">
                  <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No license photo uploaded</p>
                  <p className="text-sm text-gray-500">
                    Take a clear photo of both sides of your license
                  </p>
                </div>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  allowedFileTypes={["image/*"]}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={handleLicenseUploadComplete}
                  buttonClassName="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLicense ? "Uploading..." : "Upload License Photo"}
                </ObjectUploader>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rider Photo Upload */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
              Profile Photo
            </CardTitle>
            <CardDescription>
              Upload a clear photo of yourself for identification
            </CardDescription>
            {hasPhoto && (
              <Badge variant="outline" className="w-fit mx-auto">
                <Check className="h-3 w-3 mr-1" />
                Uploaded
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPhoto ? (
              <div className="text-center space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-800">Profile photo uploaded</p>
                  <p className="text-xs text-green-600 mt-1">
                    Waiting for admin verification
                  </p>
                </div>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  allowedFileTypes={["image/*"]}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={handleRiderPhotoUploadComplete}
                  buttonClassName="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Replace Profile Photo
                </ObjectUploader>
              </div>
            ) : (
              <div className="text-center">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4">
                  <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No profile photo uploaded</p>
                  <p className="text-sm text-gray-500">
                    Take a clear headshot photo
                  </p>
                </div>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  allowedFileTypes={["image/*"]}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={handleRiderPhotoUploadComplete}
                  buttonClassName="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingPhoto ? "Uploading..." : "Upload Profile Photo"}
                </ObjectUploader>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Requirements Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Document Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Driver's License Photo:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Must be a valid, current license</li>
                <li>• Photo should be clear and readable</li>
                <li>• Include both front and back if applicable</li>
                <li>• No expired licenses accepted</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Profile Photo:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Clear headshot photo</li>
                <li>• Face must be clearly visible</li>
                <li>• No sunglasses or face coverings</li>
                <li>• Professional appearance preferred</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> All documents are reviewed by our admin team for verification.
              This process typically takes 24-48 hours. You'll receive a notification once your
              documents are approved.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
