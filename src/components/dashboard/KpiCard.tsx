import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  variant?: "default" | "accent";
  delay?: number;
}

export function KpiCard({ 
  title, 
  value, 
  change, 
  changeLabel = "vs last month",
  icon: Icon,
  variant = "default",
  delay = 0
}: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div 
      className={cn(
        "p-6 rounded-xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-fade-in",
        variant === "default" && "bg-card border-border hover:border-primary/20",
        variant === "accent" && "gradient-primary border-transparent text-primary-foreground shadow-glow"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-medium",
            variant === "default" ? "text-muted-foreground" : "text-primary-foreground/80"
          )}>
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5">
              {isPositive && (
                <TrendingUp className={cn(
                  "h-4 w-4",
                  variant === "default" ? "text-success" : "text-primary-foreground"
                )} />
              )}
              {isNegative && (
                <TrendingDown className={cn(
                  "h-4 w-4",
                  variant === "default" ? "text-destructive" : "text-primary-foreground/70"
                )} />
              )}
              <span className={cn(
                "text-sm font-medium",
                variant === "default" && isPositive && "text-success",
                variant === "default" && isNegative && "text-destructive",
                variant === "accent" && "text-primary-foreground/90"
              )}>
                {isPositive && "+"}{change}%
              </span>
              <span className={cn(
                "text-sm",
                variant === "default" ? "text-muted-foreground" : "text-primary-foreground/70"
              )}>
                {changeLabel}
              </span>
            </div>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-lg transition-transform duration-300 group-hover:scale-110",
          variant === "default" ? "bg-primary/10" : "bg-primary-foreground/20"
        )}>
          <Icon className={cn(
            "h-5 w-5",
            variant === "default" ? "text-primary" : "text-primary-foreground"
          )} />
        </div>
      </div>
    </div>
  );
}