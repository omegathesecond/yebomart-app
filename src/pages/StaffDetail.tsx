import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/types';
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
    return formatCurrency(amount);
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
      case 'positive': return <CheckCircleIcon className="w-5 h-5 text-ok" />;
      case 'warning': return <ExclamationTriangleIcon className="w-5 h-5 text-brick" />;
      default: return <InformationCircleIcon className="w-5 h-5 text-body" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <UserCircleIcon className="w-16 h-16 mx-auto text-mist mb-4" />
        <h2 className="text-xl font-semibold text-ink mb-2">Staff member not found</h2>
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
          className="p-2 hover:bg-shade rounded-sharp transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-mute" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-ink">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink flex items-center gap-2">
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
            className={`px-4 py-2 rounded-sharp text-sm font-medium transition-colors ${
              period === days
                ? 'bg-brand text-ink'
                : 'bg-shade text-body hover:bg-shade'
            }`}
          >
            {days} days
          </button>
        ))}
      </div>

      {/* Contact Info */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-body">
            <PhoneIcon className="w-4 h-4 text-mist" />
            <span className="text-sm">{user.phone}</span>
          </div>
          {user.email && (
            <div className="flex items-center gap-2 text-body">
              <EnvelopeIcon className="w-4 h-4 text-mist" />
              <span className="text-sm">{user.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-body">
            <CalendarIcon className="w-4 h-4 text-mist" />
            <span className="text-sm">Joined {formatDate(user.createdAt)}</span>
          </div>
          {user.lastLoginAt && (
            <div className="flex items-center gap-2 text-body">
              <ClockIcon className="w-4 h-4 text-mist" />
              <span className="text-sm">Last active {formatDateTime(user.lastLoginAt)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ok/20 rounded-sharp">
              <CurrencyDollarIcon className="w-5 h-5 text-ok" />
            </div>
            <div>
              <p className="text-xs text-mute">Revenue</p>
              <p className="m text-lg font-bold text-ink">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sand/20 rounded-sharp">
              <ShoppingCartIcon className="w-5 h-5 text-body" />
            </div>
            <div>
              <p className="text-xs text-mute">Sales</p>
              <p className="text-lg font-bold text-ink">{stats.transactionCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-wash rounded-sharp">
              <ChartBarIcon className="w-5 h-5 text-brick" />
            </div>
            <div>
              <p className="text-xs text-mute">Avg Sale</p>
              <p className="m text-lg font-bold text-ink">{formatCurrency(stats.averageTransaction)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-bad/20 rounded-sharp">
              <XCircleIcon className="w-5 h-5 text-bad" />
            </div>
            <div>
              <p className="text-xs text-mute">Void Rate</p>
              <p className="text-lg font-bold text-ink">{stats.voidRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-brick" />
            AI Insights
          </h3>
          <div className="space-y-2">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-shade/50 rounded-sharp">
                {getInsightIcon(insight.type)}
                <p className="text-sm text-body">{insight.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Revenue Chart */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink mb-4">Revenue Trend</h3>
        {dailySales.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailySales}>
              <CartesianGrid vertical={false} stroke="rgba(26,24,20,0.12)" />
              <XAxis 
                dataKey="date" 
                stroke="rgba(26,24,20,0.28)"
                tick={{ fontSize: 10, fill: '#78716c' }}
                tickLine={false}
                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                stroke="rgba(26,24,20,0.28)"
                tick={{ fontSize: 10, fill: '#78716c' }}
                tickLine={false}
                tickFormatter={(val) => formatCurrency(Number(val))} 
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fdfbf7', border: '1px solid rgba(26,24,20,0.28)', borderRadius: 2, fontSize: 12 }}
                labelStyle={{ color: '#1a1814', fontWeight: 600 }}
                formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Line type="monotone" dataKey="revenue" stroke="#1a1814" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-mist text-sm">
            No sales data for this period
          </div>
        )}
      </Card>

      {/* Daily Transactions Chart */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink mb-4">Daily Transactions</h3>
        {dailySales.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailySales}>
              <CartesianGrid vertical={false} stroke="rgba(26,24,20,0.12)" />
              <XAxis 
                dataKey="date" 
                stroke="rgba(26,24,20,0.28)"
                tick={{ fontSize: 10, fill: '#78716c' }}
                tickLine={false}
                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis stroke="rgba(26,24,20,0.28)" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fdfbf7', border: '1px solid rgba(26,24,20,0.28)', borderRadius: 2, fontSize: 12 }}
                labelStyle={{ color: '#1a1814', fontWeight: 600 }}
                formatter={(value) => [Number(value), 'Transactions']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Bar dataKey="transactions" fill="#1a1814" maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-mist text-sm">
            No transaction data for this period
          </div>
        )}
      </Card>

      {/* Recent Transactions */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink mb-4">Recent Sales</h3>
        {recentSales.length > 0 ? (
          <div className="space-y-2">
            {recentSales.slice(0, 10).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 bg-shade/50 rounded-sharp">
                <div>
                  <p className="m text-sm font-medium text-ink">{formatCurrency(sale.totalAmount)}</p>
                  <p className="text-xs text-mute">{sale.itemCount} items • {sale.paymentMethod}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(sale.status)}
                  <p className="text-xs text-mist mt-1">{formatDateTime(sale.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-mist text-sm">
            No recent sales
          </div>
        )}
      </Card>
    </div>
  );
}
