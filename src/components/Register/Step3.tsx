import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, RotateCcw, Check, AlertTriangle, User, CreditCard } from 'lucide-react';

export interface RegisterStep3Data {
  captureType: 'selfie' | 'id';
  imageData: string; // base64 encoded image
  imageBlob: Blob;
}

interface RegisterStep3Props {
  onNext: (data: RegisterStep3Data) => void;
  onBack?: () => void;
}

type CaptureMode = 'selfie' | 'id' | null;
type CameraState = 'idle' | 'requesting' | 'active' | 'error';
type CaptureState = 'none' | 'captured' | 'previewing';

export function RegisterStep3({ onNext, onBack }: RegisterStep3Props) {
  // State management
  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [captureState, setCaptureState] = useState<CaptureState>('none');
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start video stream
  const startVideoStream = useCallback(async (mode: 'selfie' | 'id') => {
    setError(null);
    setCameraState('requesting');
    
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: mode === 'selfie' ? 'user' : 'environment'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Wait for video element to be available
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      videoRef.current.srcObject = stream;
      
      // Wait for video to start playing before setting state to active
      await videoRef.current.play();
      setCameraState('active');
      
    } catch (err) {
      console.error('Camera access error:', err);
      let errorMessage = 'Unable to access camera. ';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage += 'Please allow camera permissions and try again.';
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'No camera found on this device.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage += 'Camera is not supported in this browser.';
        } else {
          errorMessage += 'Please check your camera settings and try again.';
        }
      }
      
      setError(errorMessage);
      setCameraState('error');
      
      // Clean up stream if it was created
      stopCamera();
    }
  }, [stopCamera]);

  // Effect to handle camera initialization when mode changes
  useEffect(() => {
    if (captureMode && captureState === 'none') {
      // Small delay to ensure video element is rendered
      const timer = setTimeout(() => {
        startVideoStream(captureMode);
      }, 100);
      
      return () => clearTimeout(timer);
    } else if (!captureMode) {
      stopCamera();
      setCameraState('idle');
    }
  }, [captureMode, captureState, startVideoStream, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle mode selection
  const handleModeSelect = (mode: 'selfie' | 'id') => {
    setCaptureMode(mode);
    setCaptureState('none');
    setCapturedImage(null);
    setImageBlob(null);
    setError(null);
  };

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || cameraState !== 'active') {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob and base64
    canvas.toBlob((blob) => {
      if (blob) {
        setImageBlob(blob);
        const reader = new FileReader();
        reader.onload = () => {
          setCapturedImage(reader.result as string);
          setCaptureState('captured');
          stopCamera();
          setCameraState('idle');
        };
        reader.readAsDataURL(blob);
      }
    }, 'image/jpeg', 0.8);
  }, [cameraState, stopCamera]);

  // Retake photo
  const retakePhoto = () => {
    setCaptureState('none');
    setCapturedImage(null);
    setImageBlob(null);
    setError(null);
    // The useEffect will handle restarting the camera
  };

  // Handle continue
  const handleContinue = () => {
    if (captureMode && capturedImage && imageBlob) {
      onNext({
        captureType: captureMode,
        imageData: capturedImage,
        imageBlob: imageBlob
      });
    }
  };

  const isReadyToContinue = captureState === 'captured' && capturedImage && imageBlob;

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Photo Verification</h1>
          <p className="text-gray-600">Step 3 of 3: Identity Verification</p>
        </div>

        {/* Warning Message */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Live camera required</strong> – uploading images is not allowed for verification.
            </p>
          </div>
        </div>

        {/* Mode Selection */}
        {!captureMode && (
          <div className="space-y-4 mb-8">
            <p className="text-center text-gray-700 font-medium mb-6">
              Choose what you'd like to photograph:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleModeSelect('selfie')}
                className="p-6 border-2 border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group"
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                    <User className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Take Selfie</h3>
                  <p className="text-sm text-gray-600">
                    Take a photo of yourself for identity verification
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeSelect('id')}
                className="p-6 border-2 border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group"
              >
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                    <CreditCard className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Photograph ID</h3>
                  <p className="text-sm text-gray-600">
                    Take a photo of your government-issued ID
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Camera Interface */}
        {captureMode && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {captureMode === 'selfie' ? 'Take Your Selfie' : 'Photograph Your ID'}
              </h3>
              <p className="text-sm text-gray-600">
                {captureMode === 'selfie' 
                  ? 'Position your face in the center of the frame'
                  : 'Make sure your ID is clearly visible and well-lit'
                }
              </p>
            </div>

            {/* Camera Feed or Preview */}
            <div className="relative">
              {captureState === 'captured' && capturedImage ? (
                // Image Preview
                <div className="relative">
                  <img
                    src={capturedImage}
                    alt="Captured photo"
                    className="w-full h-80 object-cover rounded-xl border-4 border-green-200"
                  />
                  <div className="absolute top-4 right-4 bg-green-500 text-white p-2 rounded-full">
                    <Check className="w-5 h-5" />
                  </div>
                </div>
              ) : (
                // Camera Feed Container
                <div className="relative bg-gray-900 rounded-xl overflow-hidden">
                  {/* Video Element - Always present when captureMode is active */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-80 object-cover ${
                      cameraState === 'active' ? 'block' : 'hidden'
                    }`}
                  />
                  
                  {/* Loading State Overlay */}
                  {cameraState === 'requesting' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <div className="text-center text-white">
                        <Camera className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                        <p>Requesting camera access...</p>
                        <p className="text-sm text-gray-300 mt-2">Please allow camera permissions</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Error State Overlay */}
                  {cameraState === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                      <div className="text-center text-red-700 p-6">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                        <p className="font-medium mb-2">Camera Error</p>
                        <p className="text-sm">{error}</p>
                        <button
                          onClick={() => {
                            setError(null);
                            setCameraState('idle');
                            // Trigger camera restart
                            setTimeout(() => {
                              if (captureMode) {
                                startVideoStream(captureMode);
                              }
                            }, 100);
                          }}
                          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Camera overlay guide - only show when camera is active */}
                  {cameraState === 'active' && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-4 border-2 border-white border-dashed rounded-xl opacity-50"></div>
                      {captureMode === 'selfie' && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white rounded-full opacity-30"></div>
                      )}
                    </div>
                  )}
                  
                  {/* Fallback when no specific state matches */}
                  {cameraState === 'idle' && (
                    <div className="h-80 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-400">Initializing camera...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex justify-center space-x-4">
              {captureState === 'captured' ? (
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Retake Photo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={cameraState !== 'active'}
                  className={`flex items-center px-8 py-4 rounded-lg font-medium transition-all ${
                    cameraState === 'active'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Camera className="w-6 h-6 mr-2" />
                  Capture Photo
                </button>
              )}
            </div>

            {/* Back to selection */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCaptureMode(null);
                  setCaptureState('none');
                  setCapturedImage(null);
                  setImageBlob(null);
                  setError(null);
                  setCameraState('idle');
                }}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                ← Choose different option
              </button>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex space-x-4 mt-8">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!isReadyToContinue}
            className={`
              ${onBack ? 'flex-1' : 'w-full'} py-3 px-4 rounded-lg font-medium transition-all duration-200 ease-in-out
              ${isReadyToContinue
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Complete Registration
          </button>
        </div>
      </div>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}