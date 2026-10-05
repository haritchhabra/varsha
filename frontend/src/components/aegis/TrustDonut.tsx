import React, { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

const TrustDonut: React.FC = () => {
  const options: Highcharts.Options = {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      height: 420,
      width: 420,
    },
    title: { text: '' },
    tooltip: { valueSuffix: '%', style: { fontSize: '11px' } },
    plotOptions: {
      pie: {
        borderWidth: 2,
        borderColor: '#ffffff',
        shadow: false,
      }
    },
    credits: { enabled: false },
    series: [{
      type: 'pie',
      name: 'Weight',
      innerSize: '68%',
      borderRadius: 6,
      dataLabels: [{
        enabled: true,
        format: '{point.name}',
        style: { color: 'var(--text-muted)', fontSize: '9px', fontFamily: 'JetBrains Mono', fontWeight: '500', textOutline: 'none' },
        distance: 12,
      }],
      data: [
        { name: 'NWP Output', y: 40, color: '#06b6d4' },
        { name: 'Convection', y: 35, color: '#3b82f6' },
        { name: 'Terrain', y: 25, color: '#818cf8' },
      ],
    }],
  }

  const HighchartsReactComponent = (HighchartsReact as any).default || HighchartsReact

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <HighchartsReactComponent highcharts={Highcharts} options={options} />
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', marginTop: -8 }}>
        P(r) WEIGHT DISTRIBUTION
      </div>
    </div>
  )
}

export default TrustDonut
