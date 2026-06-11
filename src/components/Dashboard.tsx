import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  DollarSign, 
  ShoppingBag, 
  CreditCard, 
  TrendingUp,
  Receipt,
  ArrowRight,
  Calculator
} from 'lucide-react';
import { getTransactions } from '../data';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16'];

export default function Dashboard() {
  const allTransactions = useMemo(() => getTransactions(), []);

  const [selectedProduct, setSelectedProduct] = useState<string>('All');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [forecastGrowth, setForecastGrowth] = useState<number>(10);

  const [pieChartDimension, setPieChartDimension] = useState<'Payment Method' | 'Product'>('Payment Method');
  const [pieRankMode, setPieRankMode] = useState<'Top 5' | 'Bottom 5'>('Top 5');

  const uniqueProducts = useMemo(() => {
    return ['All', ...Array.from(new Set(allTransactions.map(t => t.product)))].sort();
  }, [allTransactions]);

  const uniquePaymentMethods = useMemo(() => {
    return ['All', ...Array.from(new Set(allTransactions.map(t => t.paymentMethod)))].sort();
  }, [allTransactions]);

  const { minDate, maxDate } = useMemo(() => {
    if (allTransactions.length === 0) return { minDate: '', maxDate: '' };
    const dates = allTransactions.map(t => t.date);
    return {
      minDate: dates.reduce((min, d) => d < min ? d : min, dates[0]),
      maxDate: dates.reduce((max, d) => d > max ? d : max, dates[0])
    };
  }, [allTransactions]);

  const transactions = useMemo(() => {
    return allTransactions.filter(t => {
      const productMatch = selectedProduct === 'All' || t.product === selectedProduct;
      const paymentMatch = selectedPaymentMethod === 'All' || t.paymentMethod === selectedPaymentMethod;
      const afterStart = !startDate || t.date >= startDate;
      const beforeEnd = !endDate || t.date <= endDate;
      return productMatch && paymentMatch && afterStart && beforeEnd;
    });
  }, [allTransactions, selectedProduct, selectedPaymentMethod, startDate, endDate]);

  // Calculate top level KPIs
  const { totalRevenue, totalOrders, aov } = useMemo(() => {
    const revenue = transactions.reduce((sum, t) => sum + t.price, 0);
    const uniqueOrders = new Set(transactions.map(t => t.orderNumber)).size;
    return {
      totalRevenue: revenue,
      totalOrders: uniqueOrders,
      aov: uniqueOrders > 0 ? revenue / uniqueOrders : 0
    };
  }, [transactions]);

  const forecastedRevenue = totalRevenue * (1 + forecastGrowth / 100);

  // Aggregation for Line Chart (Revenue over time)
  const revenueByDate = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      map.set(t.date, (map.get(t.date) || 0) + t.price);
    });
    return Array.from(map.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  // Aggregation for Bar Chart (Revenue by Product)
  const revenueByProduct = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      map.set(t.product, (map.get(t.product) || 0) + t.price);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort descending
  }, [transactions]);

  // Aggregation for Pie Chart
  const pieChartData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      const key = pieChartDimension === 'Payment Method' ? t.paymentMethod : t.product;
      map.set(key, (map.get(key) || 0) + t.price);
    });
    
    let sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (pieChartDimension === 'Product' && sorted.length > 5) {
      let selected: {name: string, value: number}[];
      let others: {name: string, value: number}[];
      
      if (pieRankMode === 'Top 5') {
        selected = sorted.slice(0, 5);
        others = sorted.slice(5);
      } else {
        selected = sorted.slice(-5);
        others = sorted.slice(0, -5);
      }
      
      const othersSum = others.reduce((sum, item) => sum + item.value, 0);
      return [...selected, { name: 'Others', value: othersSum }];
    }

    return sorted;
  }, [transactions, pieChartDimension, pieRankMode]);

  // Formatters
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  };

  const { averageDailyRevenue, estimatedDaysToReach } = useMemo(() => {
    if (transactions.length === 0) return { averageDailyRevenue: 0, estimatedDaysToReach: 0 };
    const dates = transactions.map(t => t.date);
    const min = dates.reduce((min, d) => d < min ? d : min, dates[0]);
    const max = dates.reduce((max, d) => d > max ? d : max, dates[0]);
    
    const minTime = new Date(min).getTime();
    const maxTime = new Date(max).getTime();
    const days = Math.max(1, Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24)));
    
    const avgDaily = totalRevenue / days;
    const estDays = avgDaily > 0 ? forecastedRevenue / avgDaily : 0;
    
    return { averageDailyRevenue: avgDaily, estimatedDaysToReach: estDays };
  }, [transactions, totalRevenue, forecastedRevenue]);

  const targetUnits = useMemo(() => {
    if (totalRevenue === 0) return [];
    
    const productPrices = new Map<string, number>();
    const productCounts = new Map<string, number>();
    transactions.forEach(t => {
      productPrices.set(t.product, (productPrices.get(t.product) || 0) + t.price);
      productCounts.set(t.product, (productCounts.get(t.product) || 0) + 1);
    });
    
    const averagePrices = new Map<string, number>();
    for (const [product, count] of productCounts.entries()) {
      averagePrices.set(product, productPrices.get(product)! / count);
    }
    
    return revenueByProduct.map(productRev => {
      const share = productRev.value / totalRevenue;
      const targetRev = forecastedRevenue * share;
      const unitPrice = averagePrices.get(productRev.name) || 0;
      const unitsNeeded = unitPrice > 0 ? Math.ceil(targetRev / unitPrice) : 0;
      return {
        name: productRev.name,
        unitsNeeded,
        additionalUnits: unitsNeeded - Math.round(productRev.value / unitPrice)
      };
    }).filter(item => item.unitsNeeded > 0);
  }, [transactions, revenueByProduct, totalRevenue, forecastedRevenue]);

  return (
    <div className="min-h-screen font-sans text-white relative z-0">
      <div className="fixed inset-0 dashboard-bg -z-10"></div>
      <div className="px-4 py-8 sm:px-6 lg:px-8 mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="mb-8 md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
              Sales Dashboard
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Interactive overview of store performance and trends.
            </p>
          </div>
        </div>

        {/* Filters and Chat Config */}
        <div className="glass p-4 mb-8 flex flex-col space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex flex-col space-y-1">
              <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Product</label>
              <select 
                value={selectedProduct} 
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400 [&>option]:text-black"
              >
                {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div className="flex flex-col space-y-1">
              <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Payment Method</label>
              <select 
                value={selectedPaymentMethod} 
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400 [&>option]:text-black"
              >
                {uniquePaymentMethods.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div className="flex flex-col space-y-1">
              <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                min={minDate}
                max={endDate || maxDate}
                className="bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400 [color-scheme:dark]"
              />
            </div>

            <div className="flex flex-col space-y-1 flex-1 max-w-[200px]">
              <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || minDate}
                max={maxDate}
                className="bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="glass p-6 flex flex-col space-y-2">
            <p className="text-xs font-semibold text-white/50 tracking-widest uppercase">Total Revenue</p>
            <p className="text-3xl font-semibold text-white">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-sky-400">+12.5% vs last month</p>
          </div>
          
          <div className="glass p-6 flex flex-col space-y-2">
            <p className="text-xs font-semibold text-white/50 tracking-widest uppercase">Total Orders</p>
            <p className="text-3xl font-semibold text-white">{totalOrders}</p>
            <p className="text-xs text-emerald-400">+4.2% daily active</p>
          </div>
          
          <div className="glass p-6 flex flex-col space-y-2">
            <p className="text-xs font-semibold text-white/50 tracking-widest uppercase">Avg Order Value</p>
            <p className="text-3xl font-semibold text-white">{formatCurrency(aov)}</p>
            <p className="text-xs text-rose-400">-0.4% from peak</p>
          </div>

          <div className="glass p-6 flex flex-col space-y-2">
            <p className="text-xs font-semibold text-white/50 tracking-widest uppercase">Total Items Sold</p>
            <p className="text-3xl font-semibold text-white">{transactions.length}</p>
            <p className="text-xs text-emerald-400">+18s improvement</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Main Revenue Chart */}
          <div className="glass p-6 lg:col-span-3 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-white">Revenue Over Time</h3>
              <div className="text-xs text-white/50">Daily sales performance</div>
            </div>
            <div className="h-[350px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueByDate} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase' }}
                    dy={10}
                  />
                  <YAxis 
                    tickFormatter={(val) => '$' + val} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    dx={-10}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    labelFormatter={formatDate}
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#0ea5e9" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Product Performance Array */}
          <div className="glass p-6 lg:col-span-2 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-white">Sales by Product</h3>
              <div className="text-xs text-white/50">Top performing items by revenue</div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByProduct} layout="vertical" margin={{ top: 10, right: 30, left: 50, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" tickFormatter={(val) => '$' + val} axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} width={120} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24}>
                    {revenueByProduct.map((entry, index) => (
                      <Cell key={'cell-' + index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="glass p-6 lg:col-span-1 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-white">Revenue Breakdown</h3>
              <div className="flex items-center gap-2">
                {pieChartDimension === 'Product' && (
                  <select 
                    value={pieRankMode} 
                    onChange={(e) => setPieRankMode(e.target.value as any)}
                    className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-400 [&>option]:text-black"
                  >
                    <option value="Top 5">Top 5</option>
                    <option value="Bottom 5">Bottom 5</option>
                  </select>
                )}
                <select 
                  value={pieChartDimension} 
                  onChange={(e) => setPieChartDimension(e.target.value as any)}
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-400 [&>option]:text-black"
                >
                  <option value="Payment Method">By Payment</option>
                  <option value="Product">By Product</option>
                </select>
              </div>
            </div>
            <div className="h-[300px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="40%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={'cell-' + index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={72} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Forecasting Section */}
        <div className="glass p-6 mb-8 flex flex-col md:flex-row gap-8 items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg text-white font-semibold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-sky-400" />
              Revenue Forecast Simulator
            </h3>
            <p className="text-sm text-white/50 mt-1 mb-6">
              Adjust the expected growth rate to forecast revenue and view required unit sales.
            </p>
            
            <div className="max-w-md flex flex-col space-y-4">
              <div className="flex items-center justify-between text-sm text-white">
                <span>Growth Rate: <span className="font-semibold text-sky-400">{forecastGrowth > 0 ? '+' : ''}{forecastGrowth}%</span></span>
                <span className="font-semibold text-2xl text-white">{formatCurrency(forecastedRevenue)}</span>
              </div>
              <input 
                type="range" 
                min="-50" 
                max="100" 
                step="1" 
                value={forecastGrowth}
                onChange={(e) => setForecastGrowth(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
              <div className="text-xs text-sky-400 mt-2 bg-sky-500/10 px-3 py-2 rounded">
                 Based on your current average daily revenue ({formatCurrency(averageDailyRevenue)}/day), it will take roughly <strong>{Math.ceil(estimatedDaysToReach)} days</strong> to reach this total.
              </div>
            </div>
          </div>
          
          <div className="flex-1 bg-white/5 rounded-xl border border-white/10 p-4 w-full">
            <h4 className="text-sm font-semibold text-white mb-3">Required Sales to Hit Forecast</h4>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
               {targetUnits.map(item => (
                 <div key={item.name} className="flex items-center justify-between">
                   <span className="text-xs text-white/70">{item.name}</span>
                   <div className="flex items-center gap-2">
                     {item.additionalUnits > 0 && <span className="text-[10px] text-emerald-400">+{item.additionalUnits} units</span>}
                     {item.additionalUnits < 0 && <span className="text-[10px] text-rose-400">{item.additionalUnits} units</span>}
                     <span className="text-sm text-white font-semibold">{item.unitsNeeded} total</span>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="glass overflow-hidden flex flex-col mb-8">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-lg text-white">Recent Transactions</h3>
              <p className="text-sm text-white/50">A detailed list of all orders.</p>
            </div>
            <button className="text-sm font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto p-2">
            <table className="min-w-full w-full border-collapse">
              <thead>
                <tr className="text-white/50 border-b border-white/10">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Order ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.slice(0, 10).map((transaction, idx) => (
                  <tr key={transaction.orderNumber + '-' + idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white font-medium">
                      {transaction.orderNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white/70">
                      {transaction.product}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white/70">
                      {transaction.date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white/70">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-sky-500/10 text-sky-400 text-xs font-semibold uppercase">
                        {transaction.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-white">
                      {formatCurrency(transaction.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
