import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import PixelBox from "../components/ui/PixelBox";
import PixelButton from "../components/ui/PixelButton";
import { useAuth } from "../context/useAuth";
import bdZoneLogo from "../assets/Logo/bd-zone-two.png";
import { useSeo } from "../hooks/useSeo";

// Official 4-square Microsoft mark. Kept as a plain inline SVG (not a
// lucide icon — lucide doesn't ship brand marks) so the button reads as
// an authentic "Sign in with Microsoft" control.
function MicrosoftLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function Login() {

  useSeo({ title: "Sign In", path: "/login", noindex: true });

  const { user, status, signInWithMicrosoft } = useAuth();
  const [justSignedIn, setJustSignedIn] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async () => {
    await signInWithMicrosoft();
    setJustSignedIn(true);
  };

  // Send the player home a beat after a successful sign-in, so the success
  // state is actually visible instead of an instant redirect.
  useEffect(() => {
    if (!justSignedIn) return;
    const id = setTimeout(() => navigate("/"), 900);
    return () => clearTimeout(id);
  }, [justSignedIn, navigate]);

  const alreadySignedIn = Boolean(user) && !justSignedIn;

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-80">
        <img src={bdZoneLogo} alt="BDZONE" className="w-full  " />
      </div>

      <PixelBox
        tone="primary"
        className="mt-6 w-full"
        contentClassName="flex flex-col items-center gap-4 px-6! py-8! text-center"
      >
        {alreadySignedIn || justSignedIn ? (
          <>
            <img
              src={user.avatar}
              alt={user.username}
              className="h-16 w-16 rounded-sm ring-2 ring-(--color-success) [image-rendering:pixelated]"
            />
            <div>
              <h1 className="text-[16px] green-gradient-text">
                Signed in as {user.username}
              </h1>
              <p className="mt-1 text-[11.5px] text-(--color-text-muted)">
                {justSignedIn
                  ? "Taking you back to BDZONE…"
                  : "You're already signed in."}
              </p>
            </div>
            {!justSignedIn && (
              <Link to="/">
                <PixelButton tone="primary" size="sm" className="px-5! py-4!">
                  <span className="gold-gradient-text">Back to Home</span>
                </PixelButton>
              </Link>
            )}
          </>
        ) : (
          <>
            <h1 className="text-[18px] gold-gradient-text">
              Sign in to BDZONE
            </h1>
            <p className="text-[11.5px] leading-relaxed text-(--color-text-muted)">
              Minecraft accounts are managed through Microsoft. Sign in with the
              same Microsoft account you use for Minecraft — no separate
              password to set up.
            </p>

            <PixelButton
              tone="neutral"
              filled
              className="mt-2 w-full py-5!"
              onClick={handleSignIn}
              disabled={status === "connecting"}
              aria-busy={status === "connecting"}
            >
              {status === "connecting" ? (
                <span className="text-[12.5px] text-white">
                  Connecting to Microsoft…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2.5 text-[12.5px] text-white">
                  <MicrosoftLogo />
                  Sign in with Microsoft
                </span>
              )}
            </PixelButton>

            <p className="flex items-center gap-1.5 text-[10px] text-(--color-text-dim)">
              <ShieldCheck size={12} />
              Microsoft is the only supported sign-in method
            </p>
          </>
        )}
      </PixelBox>
    </section>
  );
}
