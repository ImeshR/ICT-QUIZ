import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

const VERSION = '1.0.0';
const CURRENT_YEAR = new Date().getFullYear();

interface FooterProps {
  transparent?: boolean;
}

export default function Footer({ transparent = false }: FooterProps) {
  return (
    <footer className={cn(
      "w-full py-4 px-4 border-t",
      transparent 
        ? "border-primary-foreground/20 bg-transparent" 
        : "border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    )}>
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className={cn(
            "font-bold text-sm",
            transparent ? "text-primary-foreground" : ""
          )}>ICT Quiz</span>
          <span className={cn(
            "text-xs",
            transparent ? "text-primary-foreground/80" : "text-muted-foreground"
          )}>v{VERSION}</span>
        </div>
        <div className={cn(
          "text-xs",
          transparent ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          © {CURRENT_YEAR} ICT Quiz. All rights reserved. Made with 💜
        </div>
      </div>
    </footer>
  );
}

