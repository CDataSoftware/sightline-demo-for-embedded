import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", revenue: 4200, target: 4000 },
  { month: "Feb", revenue: 3800, target: 4200 },
  { month: "Mar", revenue: 5100, target: 4400 },
  { month: "Apr", revenue: 4600, target: 4600 },
  { month: "May", revenue: 5400, target: 4800 },
  { month: "Jun", revenue: 6200, target: 5000 },
  { month: "Jul", revenue: 5800, target: 5200 },
  { month: "Aug", revenue: 6800, target: 5400 },
  { month: "Sep", revenue: 7200, target: 5600 },
  { month: "Oct", revenue: 6900, target: 5800 },
  { month: "Nov", revenue: 7800, target: 6000 },
  { month: "Dec", revenue: 8400, target: 6200 },
];

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(239 84% 67%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(239 84% 67%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="targetGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(174 72% 46%)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="hsl(174 72% 46%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
        <XAxis 
          dataKey="month" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: "hsl(220 9% 46%)", fontSize: 12 }}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: "hsl(220 9% 46%)", fontSize: 12 }}
          tickFormatter={(value) => `$${value / 1000}k`}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(0 0% 100%)", 
            border: "1px solid hsl(220 13% 91%)",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
          }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
        />
        <Area
          type="monotone"
          dataKey="target"
          stroke="hsl(174 72% 46%)"
          strokeWidth={2}
          fill="url(#targetGradient)"
          strokeDasharray="5 5"
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="hsl(239 84% 67%)"
          strokeWidth={2}
          fill="url(#revenueGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}