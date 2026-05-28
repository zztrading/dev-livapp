import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, Shield, ShieldCheck, User, Loader2, Search, RefreshCw, Trash2, Ban, CheckCircle, MoreHorizontal, KeyRound, Flame, BookOpen, CreditCard, TrendingUp, UserCheck, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AppRole = 'admin' | 'supervisor' | 'user';

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  plan: string | null;
  created_at: string | null;
  total_lessons_completed: number | null;
  power_score: number | null;
  coins: number | null;
  streak_days: number | null;
  is_active: boolean;
  role: AppRole;
}

type PendingAction =
  | { type: 'role'; userId: string; newRole: AppRole }
  | { type: 'suspend'; userId: string }
  | { type: 'reactivate'; userId: string }
  | { type: 'delete'; userId: string }
  | { type: 'reset_password'; userId: string };

const ROLE_CONFIG: Record<AppRole, { label: string; color: string; icon: typeof Shield; description: string }> = {
  admin: {
    label: 'Admin',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: Shield,
    description: 'Acesso total ao sistema completo',
  },
  supervisor: {
    label: 'Supervisor',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: ShieldCheck,
    description: 'Aulas, trilhas, admin (criar aulas, gestão manual, debugs, guias)',
  },
  user: {
    label: 'Usuário',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: User,
    description: 'Acesso padrão: aulas, pagamentos, créditos, navegação',
  },
};

export default function AdminUserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, plan, created_at, total_lessons_completed, power_score, coins, streak_days, is_active')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const roleMap = new Map<string, AppRole>();
      rolesData?.forEach((r) => {
        const existing = roleMap.get(r.user_id);
        if (!existing || (r.role === 'admin') || (r.role === 'supervisor' && existing === 'user')) {
          roleMap.set(r.user_id, r.role as AppRole);
        }
      });

      const usersWithRoles: UserWithRole[] = (usersData || []).map((u) => ({
        ...u,
        is_active: u.is_active ?? true,
        role: roleMap.get(u.id) || 'user',
      }));

      setUsers(usersWithRoles);
    } catch (err) {
      console.error('[UserManagement] Error:', err);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name || 'Usuário';

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setUpdating(true);

    try {
      if (pendingAction.type === 'role') {
        const { userId, newRole } = pendingAction;
        const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
        if (deleteError) throw deleteError;

        if (newRole !== 'user') {
          const { error: insertError } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
          if (insertError) throw insertError;
        }

        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        toast.success(`${getUserName(userId)} agora é ${ROLE_CONFIG[newRole].label}`);
      } else if (pendingAction.type === 'suspend') {
        const { userId } = pendingAction;
        const { error } = await supabase.from('users').update({ is_active: false }).eq('id', userId);
        if (error) throw error;

        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u)));
        toast.success(`${getUserName(userId)} foi suspenso`);
      } else if (pendingAction.type === 'reactivate') {
        const { userId } = pendingAction;
        const { error } = await supabase.from('users').update({ is_active: true }).eq('id', userId);
        if (error) throw error;

        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u)));
        toast.success(`${getUserName(userId)} foi reativado`);
      } else if (pendingAction.type === 'delete') {
        const { userId } = pendingAction;
        await supabase.from('user_roles').delete().eq('user_id', userId);
        await supabase.from('user_progress').delete().eq('user_id', userId);
        await supabase.from('points_history').delete().eq('user_id', userId);
        await supabase.from('user_achievements').delete().eq('user_id', userId);
        await supabase.from('user_gamification_events').delete().eq('user_id', userId);
        await supabase.from('user_streaks').delete().eq('user_id', userId);

        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) throw error;

        setUsers((prev) => prev.filter((u) => u.id !== userId));
        toast.success(`Usuário deletado permanentemente`);
      } else if (pendingAction.type === 'reset_password') {
        const { userId } = pendingAction;
        if (!newPassword || newPassword.length < 6) {
          toast.error('A senha deve ter no mínimo 6 caracteres');
          setUpdating(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('admin-reset-password', {
          body: { user_id: userId, new_password: newPassword },
        });
        // supabase-js trata non-2xx como FunctionsHttpError — precisamos ler o body p/ ver a razão real
        if (error || data?.error) {
          let reason = data?.error || (error as any)?.message || 'Falha ao alterar senha';
          if (!data?.error && error) {
            try {
              const ctx: any = (error as any).context;
              if (ctx && typeof ctx.json === 'function') {
                const body = await ctx.json();
                if (body?.error) reason = body.error;
              } else if (ctx?.body) {
                const body = await new Response(ctx.body).json();
                if (body?.error) reason = body.error;
              }
            } catch { /* ignore */ }
          }
          throw new Error(reason);
        }
        toast.success(`Senha de ${getUserName(userId)} alterada com sucesso`);
        setNewPassword('');
      }
    } catch (err: any) {
      console.error('[UserManagement] Action error:', err);
      toast.error(err?.message || 'Erro ao executar ação');
    } finally {
      setUpdating(false);
      setPendingAction(null);
    }
  };

  const getDialogContent = () => {
    if (!pendingAction) return { title: '', description: '' };
    const name = getUserName(pendingAction.userId);

    switch (pendingAction.type) {
      case 'role':
        return {
          title: 'Confirmar alteração de permissão',
          description: `Deseja alterar o papel de "${name}" para ${ROLE_CONFIG[pendingAction.newRole].label}?\n${ROLE_CONFIG[pendingAction.newRole].description}`,
        };
      case 'suspend':
        return {
          title: '⚠️ Suspender usuário',
          description: `"${name}" será suspenso e ficará inativo. Ele não conseguirá acessar a plataforma. Você pode reativá-lo depois.`,
        };
      case 'reactivate':
        return {
          title: 'Reativar usuário',
          description: `"${name}" será reativado e poderá acessar a plataforma novamente.`,
        };
      case 'delete':
        return {
          title: '🚨 Deletar usuário PERMANENTEMENTE',
          description: `ATENÇÃO: "${name}" será removido permanentemente do sistema, junto com todo o seu progresso, conquistas e dados. Esta ação NÃO pode ser desfeita.`,
        };
      case 'reset_password':
        return {
          title: '🔑 Alterar senha do usuário',
          description: `Digite a nova senha para "${name}". A senha deve ter no mínimo 6 caracteres.`,
        };
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'suspended' && !u.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    supervisors: users.filter((u) => u.role === 'supervisor').length,
    regular: users.filter((u) => u.role === 'user').length,
    suspended: users.filter((u) => !u.is_active).length,
    active: users.filter((u) => u.is_active).length,
  };

  // Plan distribution
  const planCounts = users.reduce<Record<string, number>>((acc, u) => {
    const p = (u.plan || 'basico').toLowerCase();
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const planEntries = Object.entries(planCounts).sort((a, b) => b[1] - a[1]);

  // Aggregates
  const totalLessons = users.reduce((s, u) => s + (u.total_lessons_completed || 0), 0);
  const avgLessons = users.length ? totalLessons / users.length : 0;
  const totalStreak = users.reduce((s, u) => s + (u.streak_days || 0), 0);
  const avgStreak = users.length ? totalStreak / users.length : 0;
  const maxStreak = users.reduce((m, u) => Math.max(m, u.streak_days || 0), 0);
  const totalXP = users.reduce((s, u) => s + (u.power_score || 0), 0);
  const avgXP = users.length ? totalXP / users.length : 0;
  const engagedUsers = users.filter((u) => (u.total_lessons_completed || 0) > 0).length;
  const engagementRate = users.length ? (engagedUsers / users.length) * 100 : 0;

  const dialogContent = getDialogContent();

  const formatNum = (n: number, digits = 0) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Admin
        </Button>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground">
            Métricas agregadas em tempo real, permissões, suspensões e remoções
          </p>
        </div>

        {/* ============ DASHBOARD DE MÉTRICAS (read-only) ============ */}
        <section aria-labelledby="metrics-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="metrics-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Visão Geral
            </h2>
            <span className="text-xs text-muted-foreground">
              Atualizado · {loading ? 'carregando...' : 'agora'}
            </span>
          </div>

          {/* Primary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="!bg-card border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Users className="w-3.5 h-3.5" /> Total de usuários
                </div>
                <p className="text-3xl font-bold">{formatNum(stats.total)}</p>
                <p className="text-xs text-emerald-500 mt-1">{stats.active} ativos</p>
              </CardContent>
            </Card>
            <Card className="!bg-card border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <UserCheck className="w-3.5 h-3.5" /> Engajamento
                </div>
                <p className="text-3xl font-bold text-emerald-500">{formatNum(engagementRate, 0)}%</p>
                <p className="text-xs text-muted-foreground mt-1">{engagedUsers} com aulas concluídas</p>
              </CardContent>
            </Card>
            <Card className="!bg-card border-orange-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Flame className="w-3.5 h-3.5" /> Streak médio
                </div>
                <p className="text-3xl font-bold text-orange-500">{formatNum(avgStreak, 1)}</p>
                <p className="text-xs text-muted-foreground mt-1">máximo: {maxStreak} dias</p>
              </CardContent>
            </Card>
            <Card className="!bg-card border-violet-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <BookOpen className="w-3.5 h-3.5" /> Progresso médio
                </div>
                <p className="text-3xl font-bold text-violet-500">{formatNum(avgLessons, 1)}</p>
                <p className="text-xs text-muted-foreground mt-1">aulas / usuário</p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="!bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="w-3.5 h-3.5" /> XP médio
                </div>
                <p className="text-2xl font-bold">{formatNum(avgXP, 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">total: {formatNum(totalXP)}</p>
              </CardContent>
            </Card>
            <Card className="!bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Activity className="w-3.5 h-3.5" /> Aulas concluídas
                </div>
                <p className="text-2xl font-bold">{formatNum(totalLessons)}</p>
                <p className="text-xs text-muted-foreground mt-1">soma geral</p>
              </CardContent>
            </Card>
            <Card className="!bg-card border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Shield className="w-3.5 h-3.5" /> Equipe
                </div>
                <p className="text-2xl font-bold">
                  <span className="text-red-400">{stats.admins}</span>
                  <span className="text-muted-foreground text-sm font-normal"> + </span>
                  <span className="text-amber-400">{stats.supervisors}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">admins + supervisores</p>
              </CardContent>
            </Card>
            <Card className="!bg-card border-orange-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Ban className="w-3.5 h-3.5" /> Suspensos
                </div>
                <p className="text-2xl font-bold text-orange-400">{stats.suspended}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.total ? formatNum((stats.suspended / stats.total) * 100, 1) : 0}% do total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Plans distribution */}
          <Card className="!bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Distribuição por plano
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {planEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              ) : (
                planEntries.map(([plan, count]) => {
                  const pct = stats.total ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={plan} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize font-medium">{plan}</span>
                        <span className="text-muted-foreground">
                          {count} <span className="text-xs">({formatNum(pct, 1)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>

        {/* ============ TABELA DE GESTÃO ============ */}
        <div className="flex items-center justify-between pt-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Lista de Usuários
          </h2>
          <span className="text-xs text-muted-foreground">
            {users.length > 0 && `${users.length} registro${users.length === 1 ? '' : 's'}`}
          </span>
        </div>


        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
              <SelectItem value="user">Usuário</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>XP / Coins</TableHead>
                    <TableHead>Aulas</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const roleConfig = ROLE_CONFIG[user.role];
                      const RoleIcon = roleConfig.icon;
                      return (
                        <TableRow key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.is_active ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
                                Ativo
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs">
                                Suspenso
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {user.plan || 'basico'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {user.power_score || 0} XP / {user.coins || 0} 🪙
                            </span>
                          </TableCell>
                          <TableCell>{user.total_lessons_completed || 0}</TableCell>
                          <TableCell>
                            <Badge className={`${roleConfig.color} border text-xs`}>
                              <RoleIcon className="w-3 h-3 mr-1" />
                              {roleConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Select
                                value={user.role}
                                onValueChange={(newRole: string) =>
                                  setPendingAction({ type: 'role', userId: user.id, newRole: newRole as AppRole })
                                }
                              >
                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">
                                    <span className="flex items-center gap-1">
                                      <Shield className="w-3 h-3" /> Admin
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="supervisor">
                                    <span className="flex items-center gap-1">
                                      <ShieldCheck className="w-3 h-3" /> Supervisor
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="user">
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" /> Usuário
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {user.is_active ? (
                                    <DropdownMenuItem
                                      onClick={() => setPendingAction({ type: 'suspend', userId: user.id })}
                                      className="text-orange-400"
                                    >
                                      <Ban className="w-4 h-4 mr-2" />
                                      Suspender
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => setPendingAction({ type: 'reactivate', userId: user.id })}
                                      className="text-emerald-400"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Reativar
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setNewPassword('');
                                      setPendingAction({ type: 'reset_password', userId: user.id });
                                    }}
                                    className="text-blue-400"
                                  >
                                    <KeyRound className="w-4 h-4 mr-2" />
                                    Alterar senha
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setPendingAction({ type: 'delete', userId: user.id })}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Deletar permanentemente
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Role Legend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Legenda de Permissões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.entries(ROLE_CONFIG) as [AppRole, typeof ROLE_CONFIG[AppRole]][]).map(
              ([role, config]) => {
                const Icon = config.icon;
                return (
                  <div key={role} className="flex items-start gap-3">
                    <Badge className={`${config.color} border text-xs shrink-0`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                );
              }
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {dialogContent.description}
            </AlertDialogDescription>
            {pendingAction?.type === 'reset_password' && (
              <div className="mt-3">
                <Input
                  type="password"
                  placeholder="Nova senha (mín. 6 caracteres)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  autoFocus
                />
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating} onClick={() => setNewPassword('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={updating || (pendingAction?.type === 'reset_password' && newPassword.length < 6)}
              className={
                pendingAction?.type === 'delete'
                  ? 'bg-destructive hover:bg-destructive/90'
                  : pendingAction?.type === 'suspend'
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : pendingAction?.type === 'reset_password'
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : ''
              }
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {pendingAction?.type === 'delete'
                ? 'Deletar permanentemente'
                : pendingAction?.type === 'suspend'
                ? 'Suspender'
                : pendingAction?.type === 'reset_password'
                ? 'Alterar senha'
                : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
