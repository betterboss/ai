'use client';

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
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

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

export default function PieChartComponent({
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  width = '100%',
  height = 300,
  title,
  colors = COLORS,
  showLegend = true,
  donut = false,
  formatValue,
}) {
  const formatter = formatValue
    ? (val) => formatValue(val)
    : undefined;

  return (
    <div style={styles.wrapper}>
      {title && <h3 style={styles.title}>{title}</h3>}
      <ResponsiveContainer width={width} height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={donut ? '55%' : 0}
            outerRadius="80%"
            paddingAngle={2}
            label={renderCustomLabel}
            labelLine={false}
            stroke="rgba(10,11,15,0.8)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={darkTooltipStyle}
            labelStyle={darkLabelStyle}
            itemStyle={darkItemStyle}
            formatter={formatter}
          />
          {showLegend && (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ color: '#9ca3af', fontSize: '0.8em', paddingTop: '12px' }}
              formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
            />
          )}
        </RechartsPieChart>
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
