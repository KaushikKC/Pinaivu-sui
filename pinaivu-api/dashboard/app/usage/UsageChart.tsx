"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface UsageRecord { created_at: string; }

export default function UsageChart({ records }: { records: UsageRecord[] }) {
  const byDay: Record<string, number> = {};
  for (const r of records) { const d = r.created_at.slice(0,10); byDay[d] = (byDay[d]??0)+1; }
  const data = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b)).map(([date,count]) => ({ date: date.slice(5), requests: count }));
  if (data.length === 0) return <p className="text-zinc-600 text-sm py-8 text-center">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{top:0,right:0,left:-20,bottom:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252529" vertical={false} />
        <XAxis dataKey="date" tick={{fill:"#71717a",fontSize:11}} axisLine={false} tickLine={false} />
        <YAxis tick={{fill:"#71717a",fontSize:11}} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{background:"#111113",border:"1px solid #252529",borderRadius:10}} labelStyle={{color:"#d4d4d8"}} itemStyle={{color:"#a5b4fc"}} cursor={{fill:"#1a1a1e"}} />
        <Bar dataKey="requests" fill="#6366f1" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
