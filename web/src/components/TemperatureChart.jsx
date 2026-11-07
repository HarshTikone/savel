import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { createMockSeries } from '../data/mockHomes'
export default function TemperatureChart({ home }) {
  const data = createMockSeries(home)
  return <div className="temp-chart" aria-label={`Simulated observed and predicted indoor temperatures for home ${home.id}`}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{top:10,right:14,left:-16,bottom:3}}>
        <CartesianGrid stroke="#25384a" strokeDasharray="3 5" vertical={false}/>
        <XAxis dataKey="t" stroke="#8294a5" tick={{fontSize:10}} tickLine={false} axisLine={false} interval={3}/>
        <YAxis stroke="#8294a5" tick={{fontSize:11}} tickLine={false} axisLine={false} domain={[30,75]} unit="°" />
        <Tooltip contentStyle={{background:'#152536',border:'1px solid #35516a',borderRadius:7,color:'#e5ecf3'}} labelStyle={{color:'#b6c6d5'}} formatter={(v,n)=>[`${Number(v).toFixed(1)} °F`,n]} />
        <Legend iconType="line" wrapperStyle={{fontSize:11,color:'#c5d1de'}}/>
        <ReferenceLine y={60} stroke="#e3b067" strokeDasharray="4 4" label={{value:'60°F',position:'insideTopRight',fill:'#e3b067',fontSize:10}}/>
        <ReferenceLine y={50} stroke="#f07878" strokeDasharray="4 4" label={{value:'50°F',position:'insideTopRight',fill:'#f07878',fontSize:10}}/>
        <Line type="monotone" name="Observed" dataKey="observed" stroke="#85cfda" strokeWidth={2.6} dot={false} connectNulls={false} isAnimationActive={false}/>
        <Line type="monotone" name="Estimated" dataKey="estimated" stroke="#a5adbd" strokeDasharray="2 5" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false}/>
        <Line type="monotone" name="Predicted" dataKey="predicted" stroke="#e0b16c" strokeDasharray="6 4" strokeWidth={2.4} dot={false} connectNulls={false} isAnimationActive={false}/>
      </LineChart>
    </ResponsiveContainer>
  </div>
}
