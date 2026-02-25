'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
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

export default function BarChartComponent({
  data = [],
  dataKey = 'value',
  xKey = 'name',
  bars,
  width = '100%',
  height = 300,
  title,
  horizontal = false,
  colors = COLORS,
  showLegend = false,
  showGrid = true,
  formatValue,
  barSize,
  stacked = false,
}) {
  const tickStyle = { fill: '#6b7280', fontSize: 12 };

  const formatter = formatValue
    ? (val) => formatValue(val)
    : undefined;

  const barEntries = bars
    ? bars.map((b, i) => ({
        dataKey: b.dataKey || b,
        name: b.name || b.dataKey || b,
        color: b.color || colors[i % colors.length],
        stackId: stacked ? 'stack' : undefined,
      }))
    : [{ dataKey, name: dataKey, color: colors[0] }];

  return (
    <div style={styles.wrapper}>
      {title && <h3 style={styles.title}>{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={!horizontal}
              horizontal={horizontal || true}
            />
          )}
          {horizontal ? (
            <>
              <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={formatter} />
              <YAxis type="category" dataKey={xKey} tick={tickStyle} axisLine={false} tickLine={false} width={100} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={formatter} />
            </>
          )}
          <Tooltip
            contentStyle={darkTooltipStyle}
            labelStyle={darkLabelStyle}
            itemStyle={darkItemStyle}
            cursor={{ fill: 'rgba(93,71,250,0.08)' }}
            formatter={formatter}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ color: '#9ca3af', fontSize: '0.82em', paddingTop: '8px' }}
            />
          )}
          {barEntries.map((entry, i) => (
            <Bar
              key={entry.dataKey}
              dataKey={entry.dataKey}
              name={entry.name}
              fill={entry.color}
              radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
              barSize={barSize}
              stackId={entry.stackId}
            >
              {!bars && data.map((_, idx) => (
                <Cell key={idx} fill={colors[idx % colors.length]} />
              ))}
            </Bar>
          ))}
        </RechartsBarChart>
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
