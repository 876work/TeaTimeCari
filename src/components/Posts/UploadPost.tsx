import React, { useState, useEffect, useRef } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Image, Upload, X, CheckCircle, AlertCircle, Loader2, Camera, ArrowRight } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { isApprovedRegistrationStatus } from '@/lib/auth/approvalStatus';
import { debugError, debugLog } from '@/lib/debugLogger';

interface UserData {
  id: string;
  username: string;
  gender: 'Male' | 'Female';
  status: string;
}

export function UploadPost() {
  const supabase = useSupabaseClient();
  const session = useSession();
  
  // State management
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current user data and verify status
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!session?.user?.id) {
        setError('Please log in to upload posts.');
        setUserLoading(false);
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase
          .from('registrations')
          .select('id, username, gender, status')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          debugError('Error fetching user data:', userError);
          setError('Failed to load user data. Please try again.');
          setUserLoading(false);
          return;
        }

        if (!userData) {
          setError('User registration not found. Please complete registration first.');
          setUserLoading(false);
          return;
        }

        if (!isApprovedRegistrationStatus(userData.status)) {
          setError('Access denied. Your account must be approved to upload posts.');
          setUserLoading(false);
          return;
        }

        setCurrentUser(userData);
      } catch (err: unknown) {
        debugError('Error in fetchCurrentUser:', err);
        setError('An unexpected error occurred while loading user data.');
      } finally {
        setUserLoading(false);
      }
    };

    fetchCurrentUser();
  }, [session, supabase]);

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, GIF, etc.)');
      return;
    }

    // Validate file size (10MB limit before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      // Compression options
      const options = {
        maxSizeMB: 1, // Maximum file size in MB
        maxWidthOrHeight: 1920, // Maximum width or height
        useWebWorker: true,
        fileType: 'image/jpeg', // Convert to JPEG for consistency
        initialQuality: 0.8, // Initial quality
      };

      // Compress and strip EXIF data
      const compressedFile = await imageCompression(file, options);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(compressedFile);
      
      setSelectedFile(compressedFile);
      setPreviewUrl(previewUrl);
      
      debugLog('Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      debugLog('Compressed file size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
      
    } catch (err: unknown) {
      debugError('Error processing image:', err);
      setError('Failed to process image. Please try a different file.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear selected file
  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
  };

  // Handle post submission
  const handleSubmit = async () => {
    if (!selectedFile || !currentUser) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const fileExtension = 'jpg'; // We convert all to JPEG
      const fileName = `${crypto.randomUUID()}.${fileExtension}`;
      const filePath = `posts/${currentUser.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setUploadProgress(50);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded image');
      }

      setUploadProgress(75);

      // Insert post record into database
      const { error: insertError } = await supabase
        .from('posts')
        .insert([{
          user_id: currentUser.id,
          username: currentUser.username,
          gender: currentUser.gender,
          photo_url: urlData.publicUrl
        }]);

      if (insertError) {
        // If database insert fails, try to clean up the uploaded file
        await supabase.storage.from('posts').remove([filePath]);
        throw new Error(`Failed to create post: ${insertError.message}`);
      }

      setUploadProgress(100);
      setSuccess(true);

      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

    } catch (err: unknown) {
      debugError('Error uploading post:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload post. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Navigate to feed
  const goToFeed = () => {
    window.location.href = '/feed';
  };

  // Loading state for user verification
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]">
        <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Verifying access...</p>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Error state or access denied
  if (error && !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]">
        <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Go Back Home
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4B9EC8] via-[#9B6BAE] to-[#D96E6E]">
        <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Post Uploaded Successfully!</h2>
            <p className="text-gray-600 mb-6">
              Your post has been uploaded and is now visible in your gender feed.
            </p>
            <div className="space-y-3">
              <button
                onClick={goToFeed}
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <span>View Feed</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setError(null);
                }}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#A3C6E0] to-[#E0A3A3]">
      <div className="container mx-auto px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#D6EBF5] rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-[#4B9EC8]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload a Photo</h1>
            <p className="text-gray-600">
              Share a photo for feedback from the {currentUser?.gender} community
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* File Upload Area */}
          {!selectedFile && (
            <div className="mb-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`block w-full p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                  isProcessing
                    ? 'border-[#4B9EC8] bg-[#D6EBF5]'
                    : 'border-gray-300 hover:border-[#4B9EC8] hover:bg-[#D6EBF5]'
                }`}
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-[#4B9EC8] animate-spin mb-4" />
                    <p className="text-[#4B9EC8] font-medium">Processing image...</p>
                    <p className="text-sm text-gray-500 mt-1">Compressing and removing metadata</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Image className="w-12 h-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 font-medium mb-2">Click to select an image</p>
                    <p className="text-sm text-gray-500">
                      Supports JPG, PNG, GIF • Max 10MB
                    </p>
                  </div>
                )}
              </label>
            </div>
          )}

          {/* Image Preview */}
          {selectedFile && previewUrl && (
            <div className="mb-6">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-80 object-cover rounded-xl border-2 border-gray-200"
                />
                <button
                  onClick={clearSelection}
                  className="absolute top-3 right-3 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-600">
                  File size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ✓ EXIF metadata removed • ✓ Compressed for optimal upload
                </p>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!selectedFile || isUploading || isProcessing}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              selectedFile && !isUploading && !isProcessing
                ? 'bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] hover:from-[#3382AA] hover:to-[#BC5050] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isUploading ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Uploading Post...
              </div>
            ) : isProcessing ? (
              <div className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Processing Image...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Upload className="w-5 h-5 mr-2" />
                Submit Post
              </div>
            )}
          </button>

          {/* Info */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Privacy Notice:</strong> Your post will be visible to other {currentUser?.gender} users in the community feed. All EXIF metadata is automatically removed for privacy.
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}