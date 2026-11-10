import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, PieChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, GraphicComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent, GraphicComponent, CanvasRenderer]);

export const PALETTE = ['#FF8A3D', '#FFC46B', '#7ECBB5', '#7BA7E8', '#C89BE8', '#F49CB4', '#8FD0E8', '#B5CC7A', '#E8A78B', '#9C9CE8', '#7F8C99'];

export const baseTooltip = {
  trigger: 'axis' as const,
  backgroundColor: 'rgba(44,44,42,.92)',
  borderWidth: 0,
  textStyle: { color: '#fff', fontSize: 12 },
};

export function Chart({ option, height = 260, onClick }: { option: any; height?: number; onClick?: (p: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    if (onClick) chart.on('click', onClick);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => { chart.dispose(); ro.disconnect(); chartRef.current = null; };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} style={{ width: '100%', height }} />;
}
