export function PrivacyToast() {
  return (
    <section className="privacy-toast-shell" aria-label="Privacy reminder">
      <div className="privacy-toast-container" tabIndex={0}>
        <span className="privacy-toast-message" role="status">
          Privacy is our #1 priority!
        </span>
        <span className="privacy-toast-toaster-group" aria-hidden="true">
          <svg
            className="privacy-toast-toaster"
            width="100%"
            height="100%"
            viewBox="0 0 88 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width={88} height={50} fill="transparent" />
            <path
              className="privacy-toast-block"
              d="M13.9561 1.74707H67.7607C73.9513 1.74707 78.9695 6.76558 78.9697 12.9561V48.0791H2.74707V12.9561C2.74733 6.76574 7.76574 1.74732 13.9561 1.74707Z"
              fill="#4B9EC8"
              stroke="#F8FBFD"
              strokeWidth="1.49457"
            />
            <rect x="2.5" y="43.3478" width="76.7174" height="4.97826" fill="#9B6BAE" stroke="#F8FBFD" />
            <path
              className="privacy-toast-lever"
              d="M84.2008 13.3305C84.8197 13.3305 85.3217 13.8318 85.3219 14.4507V17.4399C85.3219 18.059 84.8199 18.561 84.2008 18.561H80.0914V13.3305H84.2008Z"
              fill="#D96E6E"
              stroke="#F8FBFD"
              strokeWidth="0.747283"
            />
            <path
              d="M8.22558 18.9348C8.22558 18.9348 6.95407 11.7886 10.1771 8.8166C12.9835 6.22883 19.9348 7.13024 19.9348 7.13024"
              stroke="white"
              strokeOpacity="0.45"
              strokeWidth="1.49457"
            />
            <circle className="privacy-toast-timer" cx="67.7609" cy="24.913" r="2.98913" fill="#F9E3E3" />
            <circle cx="67.7609" cy="24.913" r="3.36277" stroke="white" strokeOpacity="0.65" strokeWidth="0.747283" strokeLinecap="square" />
            <circle cx="67.7609" cy="33.8804" r="2.98913" fill="#F9E3E3" />
            <circle cx="67.7609" cy="33.8804" r="3.36277" stroke="white" strokeOpacity="0.65" strokeWidth="0.747283" strokeLinecap="square" />
          </svg>
        </span>
      </div>
    </section>
  );
}
