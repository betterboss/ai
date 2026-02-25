'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#5d47fa', '#7a64ff', '#9d8cff', '#34d399', '#f59e0b', '#f87171'];

const darkTooltipStyle = {
  backgroundColor: '#1a1b26',
  border: '1px solid rgba(93,71,250,0.3)',
  borderRadius: '8px',
  padding: '10px 14px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const darkLabelStyle = {
  color: '#e5e7eb',
  fontSize: '0.82em',
  fontWeight: 600,
};

const darkItemStyle = {
  color: '#9ca3af',
  fontSize: '0.8em',
};

export default function LineChartComponent({
  data = [],
  dataKey = 'value',
  xKey = 'name',
  lines,
  width = '100%',
  height = 300,
  title,
  colors = COLORS,
  showLegend = false,
  showGrid = true,
  showDots = true,
  curved = true,
  formatValue,
}) {
  const tickStyle = { fill: '#6b7280', fontSize: 12 };

  const formatter = formatValue
    ? (val) => formatValue(val)
    : undefined;

  const lineEntries = lines
    ? lines.map((l, i) => ({
        dataKey: l.dataKey || l,
        name: l.name || l.dataKey || l,
        color: l.color || colors[i % colors.length],
        dashed: l.dashed || false,
      }))
    : [{ dataKey, name: dataKey, color: colors[0], dashed: false }];

  return (
    <div style={styles.wrapper}>
      {title && <h3 style={styles.title}>{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsLineChart
          data={data}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
          )}
          <XAxis dataKey={xKey} tick={tickStyle} axisLine={false} tickLine={false} />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={formatter} />
          <Tooltip
            contentStyle={darkTooltipStyle}
            labelStyle={darkLabelStyle}
            itemStyle={darkItemStyle}
            formatter={formatter}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ color: '#9ca3af', fontSize: '0.82em', paddingTop: '8px' }}
            />
          )}
          {lineEntries.map((entry) => (
            <Line
              key={entry.dataKey}
              type={curved ? 'monotone' : 'linear'}
              dataKey={entry.dataKey}
              name={entry.name}
              stroke={entry.color}
              strokeWidth={2.5}
              strokeDasharray={entry.dashed ? '6 3' : undefined}
              dot={showDots ? { fill: entry.color, strokeWidth: 0, r: 4 } : false}
              activeDot={{ fill: entry.color, stroke: '#0a0b0f', strokeWidth: 2, r: 6 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

const styles = {
  wrapper: {
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '20px',
  },
  title: {
    color: '#e5e7eb',
    fontSize: '0.95em',
    fontWeight: 700,
    margin: '0 0 16px 0',
    letterSpacing: '-0.01em',
  },
};
