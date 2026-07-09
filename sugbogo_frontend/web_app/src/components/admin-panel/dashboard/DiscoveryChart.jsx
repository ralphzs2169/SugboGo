import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Cell, LabelList } from 'recharts';

const placeholderData = [
  {
    label: "PROFILE VIEWS",
    numericValue: 12400, // Actual number for scaling height
    displayValue: "12.4K", // Label displayed on top
    color: "#f27e13",
  },
  {
    label: "POCKET SAVES",
    numericValue: 2800,
    displayValue: "2.8K",
    color: "#4a3225",
  },
  {
    label: "REVIEWS",
    numericValue: 312,
    displayValue: "312",
    color: "#dec3af",
  },
  {
    label: "VOUCHES",
    numericValue: 84,
    displayValue: "84",
    color: "#f6e7d9",
  },
];

function DiscoveryChart() {
  return (
    <div className="mt-10 h-[200px] w-full border-b border-stroke pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={placeholderData} 
          margin={{ top: 25, right: 10, left: 10, bottom: 5 }}
          barCategoryGap="5%" // Adds natural spacing between categories
        >
          {/* X Axis config to replicate the clean text labels without lines */}
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}
            dy={10} // Pushes the text labels down slightly
          />

          {/* The Bar mapping with rounded top corners */}
          <Bar 
            dataKey="numericValue" 
            maxBarSize={150} 
            radius={[12, 12, 0, 0]}
          >
            {placeholderData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color} 
                className="transition-opacity duration-300 hover:opacity-90 cursor-pointer"
              />
            ))}
            
            {/* Value Label positioning on top of the bars */}
            <LabelList
              dataKey="displayValue"
              position="top"
              fill="var(--color-text-primary)"
              fontSize={12}
              fontWeight={800}
              offset={10}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DiscoveryChart;