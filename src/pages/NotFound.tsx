import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background animate-fade-in">
      <div className="text-center px-6">
        {/* Animated illustration */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-scale-in">
            <MapPin className="h-16 w-16 text-primary/60" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent/20 animate-pulse" />
          <div className="absolute -bottom-1 -left-4 w-6 h-6 rounded-full bg-warning/20 animate-pulse delay-300" />
        </div>
        
        <h1 className="text-7xl font-bold text-primary mb-2">404</h1>
        <h2 className="text-xl font-semibold text-foreground mb-2">Page not found</h2>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <Button asChild className="gradient-primary shadow-glow hover:opacity-90 transition-opacity">
          <Link to="/" className="gap-2">
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
