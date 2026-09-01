import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

const linkClass = "text-muted-foreground transition-colors hover:text-foreground";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/30 backdrop-blur">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="gradient-surface flex h-8 w-8 items-center justify-center rounded-lg">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="text-lg font-bold">TruthGuard</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Technology for a more trustworthy digital world.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Platform</h3>
          <p>
            <Link to="/detect" className={linkClass}>
              Detect
            </Link>
          </p>
          <p>
            <Link to="/dashboard" className={linkClass}>
              Dashboard
            </Link>
          </p>
          <p>
            <Link to="/history" className={linkClass}>
              History
            </Link>
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Resources</h3>
          <p>
            <Link to="/learn" className={linkClass}>
              Learn
            </Link>
          </p>
          <p>
            <Link to="/about" className={linkClass}>
              About
            </Link>
          </p>
          <p>
            <a href="mailto:hello@truthguard.app" className={linkClass}>
              Contact
            </a>
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Legal</h3>
          <p>
            <Link to="/about" hash="privacy" className={linkClass}>
              Privacy
            </Link>
          </p>
          <p>
            <Link to="/about" hash="terms" className={linkClass}>
              Terms
            </Link>
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} TruthGuard. Detection results are AI-assisted estimates, not
        absolute proof.
      </div>
    </footer>
  );
}
