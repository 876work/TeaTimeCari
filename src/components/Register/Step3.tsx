import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Camera, RotateCcw, Check, AlertTriangle, CreditCard, ShieldCheck } from 'lucide-react';
import { RegistrationProgress } from './RegistrationProgress';
import type { RegisterStep1Data } from '../RegisterStep1';
import type { RegisterStep2Data } from './Step2';
import { debugError } from '@/lib/debugLogger';

export interface RegisterStep3Data {
  captureType: 'selfie' | 'id';
  imageData: string;
  imageBlob: Blob;
}

interface RegisterStep3Props {
  onNext: (data: RegisterStep3Data) => void;
  onBack?: () => void;
  initialData?: RegisterStep3Data;
  registrationData?: {
    step1?: RegisterStep1Data;
    step2?: RegisterStep2Data;
  };
}

type CaptureMode = 'selfie' | 'id' | null;
type CameraState = 'idle' | 'requesting' | 'active' | 'error';
type CaptureState = 'none' | 'captured' | 'previewing';

export function RegisterStep3({
  onNext,
  onBack,
  initialData,
  registrationData,
}: RegisterStep3Props) {
  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [captureState, setCaptureState] = useState<CaptureState>(
    initialData?.imageData ? 'captured' : 'none',
  );
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(initialData?.imageData || null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(initialData?.imageBlob || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasConfirmedPhotoNotice, setHasConfirmedPhotoNotice] = useState(Boolean(initialData?.imageData));

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startVideoStream = useCallback(
    async (mode: 'selfie' | 'id') => {
      setError(null);
      setCameraState('requesting');

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 640 },
            height: { ideal: 640 },
            facingMode: mode === 'selfie' ? 'user' : 'environment',
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (!videoRef.current) {
          throw new Error('Video element not available');
        }

        videoRef.current.srcObject = stream;

        await videoRef.current.play();
        setCameraState('active');
      } catch (err) {
        debugError('Camera access error:', err);

        let errorMessage = 'Unable to access camera. ';

        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            errorMessage += 'Allow camera access to take your verification photo and try again.';
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
        stopCamera();
      }
    },
    [stopCamera],
  );

  useEffect(() => {
    if (initialData?.captureType && !captureMode) {
      setCaptureMode(initialData.captureType);
    }
  }, [initialData?.captureType, captureMode]);

  useEffect(() => {
    if (captureMode && hasConfirmedPhotoNotice && captureState === 'none') {
      const timer = setTimeout(() => {
        startVideoStream(captureMode);
      }, 100);

      return () => clearTimeout(timer);
    }

    if (!captureMode) {
      stopCamera();
      setCameraState('idle');
    }

    return undefined;
  }, [captureMode, captureState, hasConfirmedPhotoNotice, startVideoStream, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleStartCapture = (mode: 'selfie' | 'id') => {
    setCaptureMode(initialData?.captureType || mode);
    setCaptureState('none');
    setCapturedImage(null);
    setImageBlob(null);
    setError(null);
    setHasConfirmedPhotoNotice(true);
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || cameraState !== 'active') {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    const maxDimension = 960;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
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
      },
      'image/jpeg',
      0.72,
    );
  }, [cameraState, stopCamera]);

  const retakePhoto = () => {
    setCaptureState('none');
    setCapturedImage(null);
    setImageBlob(null);
    setError(null);
  };

  const handleContinue = async () => {
    if (captureMode && capturedImage && imageBlob) {
      setIsSubmitting(true);
      setError(null);

      try {
        onNext({
          captureType: captureMode,
          imageData: capturedImage,
          imageBlob,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Please try again.';

        debugError('Error submitting registration:', err);
        setError(`Failed to submit registration: ${message}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const isReadyToContinue = captureState === 'captured' && capturedImage && imageBlob;

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <RegistrationProgress currentStep={3} className="mb-6" />

        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#D6EBF5] rounded-full flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-[#4B9EC8]" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Photo Verification
          </h1>

          <p className="text-gray-600">Step 3 of 3: Identity Verification</p>

          <p className="mt-2 text-sm text-slate-500">
            After submission, a team member usually reviews applications within 24–48 hours.
          </p>
        </div>

        {!captureMode && (
          <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#4B9EC8] shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Quick photo check
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Take a quick live selfie so we can confirm new accounts are real. Your photo is used only for account review, visible only to authorized Tea Time Cari reviewers, and never shown on your profile or posts.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-600">
                  We keep verification photos only as long as reasonably needed for review, fraud prevention, safety, legal, audit, or dispute needs. You can contact support to request deletion, subject to legal and safety exceptions.
                </p>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  We use a live camera check so submitted photos are current. Uploads are not accepted for verification.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleStartCapture('selfie')}
                className="rounded-lg bg-[#4B9EC8] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3382AA]"
              >
                Start selfie
              </button>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handleStartCapture('id')}
                  className="flex flex-1 items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-blue-50"
                >
                  <CreditCard className="mr-2 h-4 w-4 text-[#D96E6E]" />
                  Use ID instead
                </button>

                <Link
                  to="/privacy-policy"
                  state={{ returnTo: '/signup/photo-verification', fromSignup: true }}
                  className="flex-1 rounded-lg border border-blue-200 bg-white px-4 py-3 text-center text-sm font-semibold text-[#3382AA] transition-colors hover:bg-blue-50"
                >
                  Privacy details
                </Link>
              </div>
            </div>
          </div>
        )}

        {captureMode && hasConfirmedPhotoNotice && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {captureMode === 'selfie' ? 'Take Your Selfie' : 'Photograph Your ID'}
              </h3>

              <p className="text-sm text-gray-600">
                {captureMode === 'selfie'
                  ? 'Center your face and take a clear photo. Your camera turns off after capture.'
                  : 'Make sure your ID is clearly visible and well-lit. Your camera turns off after capture.'}
              </p>
            </div>

            <div className="relative">
              {captureState === 'captured' && capturedImage ? (
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
                <div className="relative bg-gray-900 rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-80 object-cover ${
                      cameraState === 'active' ? 'block' : 'hidden'
                    }`}
                  />

                  {cameraState === 'requesting' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <div className="text-center text-white">
                        <Camera className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                        <p>Opening your camera...</p>
                        <p className="text-sm text-gray-300 mt-2">
                          Allow camera access to take your verification photo
                        </p>
                      </div>
                    </div>
                  )}

                  {cameraState === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                      <div className="text-center text-red-700 p-6">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                        <p className="font-medium mb-2">We couldn’t open your camera</p>
                        <p className="text-sm">{error}</p>

                        <div className="mt-4 rounded-lg bg-white/80 p-3 text-left text-xs text-red-800">
                          <p className="font-semibold">Try these quick fixes:</p>
                          <ul className="mt-2 list-disc space-y-1 pl-4">
                            <li>Allow camera access for this site.</li>
                            <li>Open this page in Safari or Chrome.</li>
                            <li>Try again from your phone if this device has no camera.</li>
                          </ul>
                          <a href="/contact-us" className="mt-2 inline-flex font-semibold text-red-700 underline">
                            Contact support if you cannot continue
                          </a>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setCameraState('idle');

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

                  {cameraState === 'active' && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-4 border-2 border-white border-dashed rounded-xl opacity-50" />
                      {captureMode === 'selfie' && (
                        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full opacity-30" />
                      )}
                    </div>
                  )}

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
                  Take photo
                </button>
              )}
            </div>

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
                  setHasConfirmedPhotoNotice(false);
                  setCameraState('idle');
                }}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                ← Choose different option
              </button>
            </div>
          </div>
        )}

        {isReadyToContinue && (
          <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-lg font-bold text-slate-900">Looks good?</h2>
            <p className="mt-1 text-sm text-slate-600">
              Submit your application for review, or retake the photo if needed.
            </p>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-500">Full name</dt>
                <dd className="text-slate-900">{registrationData?.step1?.fullName || 'Not provided'}</dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">Username</dt>
                <dd className="text-slate-900">
                  {registrationData?.step1?.username ? `@${registrationData.step1.username}` : 'Not provided'}
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">Email</dt>
                <dd className="text-slate-900">{registrationData?.step1?.email || 'Not provided'}</dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">Phone</dt>
                <dd className="text-slate-900">{registrationData?.step1?.phone || 'Not provided'}</dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">Gender</dt>
                <dd className="text-slate-900">{registrationData?.step2?.gender || 'Not provided'}</dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">Verification method</dt>
                <dd className="text-slate-900">
                  {captureMode === 'selfie' ? 'Live selfie capture' : 'ID document photo'}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {isReadyToContinue && (
          <p className="mt-6 text-center text-xs leading-5 text-slate-600">
            By submitting this form, you agree to our{' '}
            <Link
              to="/terms-of-service"
              className="font-semibold text-[#4B9EC8] underline underline-offset-2 transition-colors hover:text-[#3382AA]"
            >
              Terms of Service
            </Link>{' '}
            and our{' '}
            <Link
              to="/privacy-policy"
              state={{ returnTo: '/signup/photo-verification', fromSignup: true }}
              className="font-semibold text-[#4B9EC8] underline underline-offset-2 transition-colors hover:text-[#3382AA]"
            >
              Privacy Policy
            </Link>
            .
          </p>
        )}

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
            disabled={!isReadyToContinue || isSubmitting}
            className={`
              ${onBack ? 'flex-1' : 'w-full'} py-3 px-4 rounded-lg font-medium transition-all duration-200 ease-in-out
              ${
                isReadyToContinue && !isSubmitting
                  ? 'bg-gradient-to-r from-[#4B9EC8] to-[#D96E6E] hover:from-[#3382AA] hover:to-[#BC5050] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02]'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin h-5 w-5 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Submitting...
              </div>
            ) : (
              'Submit Application'
            )}
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}