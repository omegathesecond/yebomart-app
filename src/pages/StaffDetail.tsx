import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatSZL } from '@/types';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowLeftIcon,
  UserCircleIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  XCircleIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface StaffDetailData {
  user: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt?: string;
  };
  stats: {
    period: { start: string; end: string };
    totalRevenue: number;
    transactionCount: number;
    averageTransaction: number;
    largestTransaction: number;
    voidCount: number;
    voidRate: number;
  };
  dailySales: Array<{
    date: string;
    transactions: number;
    revenue: number;
  }>;
  recentSales: Array<{
    id: string;
    totalAmount: number;
    status: string;
    paymentMethod: string;
    itemCount: number;
    createdAt: string;
  }>;
  insights: Array<{
    type: 'positive' | 'warning' | 'info';
    text: string;
  }>;
}

export function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<StaffDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);
      const { data: result } = await api.getStaffDetail(id, period);
      if (result) {
        setData(result);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [id, period]);

  const formatCurrency = (amount: number) => {
    return formatSZL(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner': return <Badge variant="success">Owner</Badge>;
      case 'manager': return <Badge variant="warning">Manager</Badge>;
      default: return <Badge variant="default">Cashier</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <Badge variant="success">Completed</Badge>;
      case 'VOIDED': return <Badge variant="danger">Voided</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive': return <CheckCircleIcon className="w-5 h-5 text-emerald-400" />;
      case 'warning': return <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" />;
      default: return <InformationCircleIcon className="w-5 h-5 text-blue-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <UserCircleIcon className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Staff member not found</h2>
        <Button variant="secondary" onClick={() => navigate('/staff')}>
          ← Back to Staff
        </Button>
      </div>
    );
  }

  const { user, stats, dailySales, recentSales, insights } = data;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/staff')}
          className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {user.name}
                {getRoleBadge(user.role)}
              </h1>
              {!user.isActive && <Badge variant="danger">Inactive</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {[7, 30, 90].map((days) => (
          <button
            key={days}
            onClick={() => setPeriod(days)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              period === days
                ? 'bg-amber-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {days} days
          </button>
        ))}
      </div>

      {/* Contact Info */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-slate-300">
            <PhoneIcon className="w-4 h-4 text-slate-500" />
            <span className="text-sm">{user.phone}</span>
          </div>
          {user.email && (
            <div className="flex items-center gap-2 text-slate-300">
              <EnvelopeIcon className="w-4 h-4 text-slate-500" />
              <span className="text-sm">{user.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-300">
            <CalendarIcon className="w-4 h-4 text-slate-500" />
            <span className="text-sm">Joined {formatDate(user.createdAt)}</span>
          </div>
          {user.lastLoginAt && (
            <div className="flex items-center gap-2 text-slate-300">
              <ClockIcon className="w-4 h-4 text-slate-500" />
              <span className="text-sm">Last active {formatDateTime(user.lastLoginAt)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <CurrencyDollarIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Revenue</p>
              <p className="text-lg font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <ShoppingCartIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Sales</p>
              <p className="text-lg font-bold text-white">{stats.transactionCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <ChartBarIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Avg Sale</p>
              <p className="text-lg font-bold text-white">{formatCurrency(stats.averageTransaction)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-xl">
              <XCircleIcon className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Void Rate</p>
              <p className="text-lg font-bold text-white">{stats.voidRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-amber-500" />
            AI Insights
          </h3>
          <div className="space-y-2">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-slate-700/50 rounded-lg">
                {getInsightIcon(insight.type)}
                <p className="text-sm text-slate-300">{insight.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Revenue Chart */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Revenue Trend</h3>
        {dailySales.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="date" 
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                stroke="#94a3b8" 
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => formatSZL(Number(val))} 
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f8fafc' }}
                formatter={(value) => [formatSZL(Number(value)), 'Revenue']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
            No sales data for this period
          </div>
        )}
      </Card>

      {/* Daily Transactions Chart */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Daily Transactions</h3>
        {dailySales.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="date" 
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#f8fafc' }}
                formatter={(value) => [Number(value), 'Transactions']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Bar dataKey="transactions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
            No transaction data for this period
          </div>
        )}
      </Card>

      {/* Recent Transactions */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Sales</h3>
        {recentSales.length > 0 ? (
          <div className="space-y-2">
            {recentSales.slice(0, 10).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-white">{formatCurrency(sale.totalAmount)}</p>
                  <p className="text-xs text-slate-400">{sale.itemCount} items • {sale.paymentMethod}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(sale.status)}
                  <p className="text-xs text-slate-500 mt-1">{formatDateTime(sale.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm">
            No recent sales
          </div>
        )}
      </Card>
    </div>
  );
}
