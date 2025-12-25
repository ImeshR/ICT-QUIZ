import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  FileQuestion, 
  BarChart3,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import Footer from '@/components/Footer';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', labelSi: 'මුල් පිටුව' },
  { href: '/dashboard/groups', icon: Users, label: 'Groups', labelSi: 'කණ්ඩායම්' },
  { href: '/dashboard/quizzes', icon: FileQuestion, label: 'Quizzes', labelSi: 'ප්‍රශ්නාවලි' },
  { href: '/dashboard/results', icon: BarChart3, label: 'Results', labelSi: 'ප්‍රතිඵල' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 200));
      // Force full page reload to ensure clean state
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      // Force reload anyway to ensure clean state
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            {/*<img */}
            {/*  src="/quizioo-logo.png" */}
            {/*  alt="Quizioo" */}
            {/*  className="w-10 h-10 rounded-xl object-contain"*/}
            {/*/>*/}
            <span className="font-bold text-lg">Quizioo</span>
          </Link>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-foreground/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <nav className={cn(
        "lg:hidden fixed top-[60px] left-0 right-0 z-50 bg-card border-b border-border transition-all duration-300",
        mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
      )}>
        <div className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                location.pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <item.icon className="w-5 h-5" />
              <div>
                <span className="font-medium">{item.label}</span>
                <span className="block text-xs opacity-75 font-sinhala">{item.labelSi}</span>
              </div>
            </Link>
          ))}
          <Button 
            variant="ghost" 
            className="w-full justify-start text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex-col">
        <div>
          <Link to="/dashboard" className="flex items-center justify-center">
            <img 
              src="/quizioo-logo.png" 
              alt="Quizioo" 
              className="w-40 h-auto rounded-xl"
            />
            <div>
              {/*<span className="font-bold text-xl">Quizioo</span>*/}
              {/*<span className="block text-xs text-muted-foreground font-sinhala">ප්‍රශ්නාවලි</span>*/}
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                location.pathname === item.href
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "hover:bg-muted"
              )}
            >
              <item.icon className="w-5 h-5" />
              <div>
                <span className="font-medium">{item.label}</span>
                <span className="block text-xs opacity-75 font-sinhala">{item.labelSi}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-[60px] lg:pt-0 min-h-screen flex flex-col">
        <div className="p-4 lg:p-8 flex-1">
          {children}
        </div>
        <Footer />
      </main>
    </div>
  );
}
