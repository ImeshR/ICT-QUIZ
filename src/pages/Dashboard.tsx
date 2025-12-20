import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Users, FileQuestion, BarChart3, Plus, ArrowRight } from 'lucide-react';

interface Stats {
  groups: number;
  students: number;
  quizzes: number;
  attempts: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ groups: 0, students: 0, quizzes: 0, attempts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    
    try {
      // RLS policies should automatically filter by teacher_id, but we'll be explicit for safety
      const [groupsRes, quizzesRes] = await Promise.all([
        supabase.from('groups').select('id', { count: 'exact' }).eq('teacher_id', user.id),
        supabase.from('quiz_sessions').select('id', { count: 'exact' }).eq('teacher_id', user.id),
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (quizzesRes.error) throw quizzesRes.error;

      const groupIds = groupsRes.data?.map(g => g.id) || [];
      
      let studentsCount = 0;
      let attemptsCount = 0;

      if (groupIds.length > 0) {
        const studentsRes = await supabase
          .from('students')
          .select('id', { count: 'exact' })
          .in('group_id', groupIds);
        studentsCount = studentsRes.count || 0;
      }

      const quizIds = quizzesRes.data?.map(q => q.id) || [];
      if (quizIds.length > 0) {
        const attemptsRes = await supabase
          .from('quiz_attempts')
          .select('id', { count: 'exact' })
          .in('quiz_session_id', quizIds);
        attemptsCount = attemptsRes.count || 0;
      }

      setStats({
        groups: groupsRes.count || 0,
        students: studentsCount,
        quizzes: quizzesRes.count || 0,
        attempts: attemptsCount,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      title: 'Groups', 
      titleSi: 'කණ්ඩායම්', 
      value: stats.groups, 
      icon: Users, 
      color: 'bg-primary',
      href: '/dashboard/groups'
    },
    { 
      title: 'Students', 
      titleSi: 'සිසුන්', 
      value: stats.students, 
      icon: Users, 
      color: 'bg-secondary',
      href: '/dashboard/groups'
    },
    { 
      title: 'Quizzes', 
      titleSi: 'ප්‍රශ්නාවලි', 
      value: stats.quizzes, 
      icon: FileQuestion, 
      color: 'bg-accent',
      href: '/dashboard/quizzes'
    },
    { 
      title: 'Attempts', 
      titleSi: 'උත්සාහයන්', 
      value: stats.attempts, 
      icon: BarChart3, 
      color: 'bg-quiz-green',
      href: '/dashboard/results'
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground font-sinhala">සාදරයෙන් පිළිගනිමු - Welcome</p>
          </div>
          <div className="flex gap-3">
            <Link to="/dashboard/groups">
              <Button variant="outline" className="btn-bounce">
                <Plus className="w-4 h-4 mr-2" />
                New Group
              </Button>
            </Link>
            <Link to="/dashboard/quizzes">
              <Button className="gradient-primary btn-bounce">
                <Plus className="w-4 h-4 mr-2" />
                New Quiz
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Link key={stat.title} to={stat.href}>
              <Card className="card-elevated hover:shadow-lg transition-all duration-300 cursor-pointer animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                    <span className="block text-xs text-muted-foreground font-sinhala">{stat.titleSi}</span>
                  </CardTitle>
                  <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {loading ? '...' : stat.value}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Manage Groups
                <span className="text-sm font-normal text-muted-foreground font-sinhala ml-2">කණ්ඩායම් කළමනාකරණය</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Create class groups and add students. Each student gets a unique code for quiz access.
              </p>
              <Link to="/dashboard/groups">
                <Button variant="outline" className="w-full btn-bounce">
                  Go to Groups
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-accent" />
                Create Quiz
                <span className="text-sm font-normal text-muted-foreground font-sinhala ml-2">ප්‍රශ්නාවලියක් සාදන්න</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Create engaging quizzes with multiple question types, images, and Sinhala support.
              </p>
              <Link to="/dashboard/quizzes">
                <Button className="w-full gradient-primary btn-bounce">
                  Create Quiz
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
