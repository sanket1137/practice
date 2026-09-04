import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as ChartTooltip,
    XAxis,
    YAxis,
} from 'recharts';

/** Titled chart container: title + optional subtitle + right-side actions. */
export function ChartCard({ title, subtitle, actions, height = 280, children }: {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    height?: number;
    children: ReactNode;
}) {
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h4" component="h3">{title}</Typography>
                        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
                    </Box>
                    {actions}
                </Box>
                <Box sx={{ height, width: '100%' }}>{children}</Box>
            </CardContent>
        </Card>
    );
}

export const useChartPalette = () => {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    return {
        grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(23,24,28,0.07)',
        axis: theme.palette.text.disabled,
        tooltipBg: dark ? '#191b22' : '#ffffff',
        tooltipBorder: dark ? 'rgba(255,255,255,0.1)' : 'rgba(23,24,28,0.12)',
        text: theme.palette.text.primary,
        primary: theme.palette.primary.main,
        purple: theme.palette.secondary.main,
        success: theme.palette.success.main,
        warning: theme.palette.warning.main,
        error: theme.palette.error.main,
    };
};

export interface TrendSeries {
    key: string;
    name: string;
    color?: string;
    /** 'left' (default) or 'right' — enables a dual-axis chart. */
    axis?: 'left' | 'right';
    /** Formats this series' value in the tooltip. */
    format?: (v: number) => string;
}

/**
 * Gradient area chart over daily rows. Theme-aware axes, grid, and tooltip;
 * supports two series on independent axes (e.g. revenue vs plays).
 */
export function TrendAreaChart({ data, xKey, series }: {
    data: Record<string, unknown>[];
    xKey: string;
    series: TrendSeries[];
}) {
    const p = useChartPalette();
    const colorOf = (s: TrendSeries, i: number) => s.color ?? [p.primary, p.purple, p.success][i % 3];
    const hasRight = series.some((s) => s.axis === 'right');

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: hasRight ? 0 : 8, bottom: 0, left: -12 }}>
                <defs>
                    {series.map((s, i) => (
                        <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={colorOf(s, i)} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={colorOf(s, i)} stopOpacity={0.02} />
                        </linearGradient>
                    ))}
                </defs>
                <CartesianGrid stroke={p.grid} vertical={false} />
                <XAxis dataKey={xKey} stroke={p.axis} tick={{ fontSize: 11, fill: p.axis }}
                    axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" stroke={p.axis} tick={{ fontSize: 11, fill: p.axis }}
                    axisLine={false} tickLine={false} width={44}
                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v))} />
                {hasRight && (
                    <YAxis yAxisId="right" orientation="right" stroke={p.axis}
                        tick={{ fontSize: 11, fill: p.axis }} axisLine={false} tickLine={false} width={40}
                        tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                )}
                <ChartTooltip
                    cursor={{ stroke: p.axis, strokeDasharray: '3 3' }}
                    contentStyle={{
                        background: p.tooltipBg, border: `1px solid ${p.tooltipBorder}`,
                        borderRadius: 10, fontSize: 12, color: p.text,
                    }}
                    labelStyle={{ color: p.text, fontWeight: 600 }}
                    formatter={(value: number | string, name: string) => {
                        const s = series.find((x) => x.name === name);
                        const num = typeof value === 'number' ? value : Number(value);
                        return [s?.format ? s.format(num) : num.toLocaleString(), name];
                    }}
                />
                {series.map((s, i) => (
                    <Area
                        key={s.key}
                        yAxisId={s.axis === 'right' ? 'right' : 'left'}
                        type="monotone"
                        dataKey={s.key}
                        name={s.name}
                        stroke={colorOf(s, i)}
                        strokeWidth={2}
                        fill={`url(#grad-${s.key})`}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                ))}
            </AreaChart>
        </ResponsiveContainer>
    );
}

export interface PacingPoint {
    date: string;
    delivered: number;
    deliveredCum: number;
    targetCum: number;
    [key: string]: unknown;
}

/**
 * The "am I on track" chart: cumulative delivered plays as a filled area
 * against a dashed straight-line target. Reads at a glance — area above the
 * dashes = ahead of plan, below = behind.
 */
export function PacingChart({ data, mini = false }: { data: PacingPoint[]; mini?: boolean }) {
    const p = useChartPalette();
    const rows = data.map((d) => ({
        ...d,
        day: new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    }));
    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: mini ? -20 : -8 }}>
                <defs>
                    <linearGradient id="pacing-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={p.primary} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={p.primary} stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                {!mini && <CartesianGrid stroke={p.grid} vertical={false} />}
                <XAxis dataKey="day" stroke={p.axis} tick={{ fontSize: mini ? 9 : 11, fill: p.axis }}
                    axisLine={false} tickLine={false} hide={mini} />
                <YAxis stroke={p.axis} tick={{ fontSize: 11, fill: p.axis }} axisLine={false} tickLine={false}
                    width={44} hide={mini}
                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v))} />
                {!mini && (
                    <ChartTooltip
                        contentStyle={{
                            background: p.tooltipBg, border: `1px solid ${p.tooltipBorder}`,
                            borderRadius: 10, fontSize: 12, color: p.text,
                        }}
                        labelStyle={{ color: p.text, fontWeight: 600 }}
                        formatter={(value: number | string, name: string) => {
                            const num = typeof value === 'number' ? value : Number(value);
                            return [num.toLocaleString(), name];
                        }}
                    />
                )}
                <Area type="monotone" dataKey="deliveredCum" name="Delivered" stroke={p.primary}
                    strokeWidth={2} fill="url(#pacing-grad)" dot={false} activeDot={{ r: 4 }} />
                <Line type="linear" dataKey="targetCum" name="Target" stroke={p.axis}
                    strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

export interface DonutSlice {
    name: string;
    value: number;
    color?: string;
    [key: string]: unknown;
}

/** Donut with a center headline and a compact legend below. */
export function DonutChart({ data, centerLabel, centerValue, format }: {
    data: DonutSlice[];
    centerLabel?: string;
    centerValue?: string;
    format?: (v: number) => string;
}) {
    const p = useChartPalette();
    const palette = [p.primary, p.purple, p.success, p.warning, p.error, '#22c1d8', '#e561b8'];
    const total = data.reduce((s, d) => s + d.value, 0);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ position: 'relative', flex: 1, minHeight: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name"
                            innerRadius="68%" outerRadius="92%" paddingAngle={2} strokeWidth={0}>
                            {data.map((d, i) => (
                                <Cell key={d.name} fill={d.color ?? palette[i % palette.length]} />
                            ))}
                        </Pie>
                        <ChartTooltip
                            contentStyle={{
                                background: p.tooltipBg, border: `1px solid ${p.tooltipBorder}`,
                                borderRadius: 10, fontSize: 12, color: p.text,
                            }}
                            formatter={(value: number | string) => {
                                const num = typeof value === 'number' ? value : Number(value);
                                return format ? format(num) : num.toLocaleString();
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {(centerLabel || centerValue) && (
                    <Box sx={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                    }}>
                        {centerValue && <Typography variant="h4" sx={{ fontVariantNumeric: 'tabular-nums' }}>{centerValue}</Typography>}
                        {centerLabel && <Typography variant="caption" color="text.secondary">{centerLabel}</Typography>}
                    </Box>
                )}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, justifyContent: 'center', pt: 1 }}>
                {data.map((d, i) => (
                    <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: d.color ?? palette[i % palette.length] }} />
                        <Typography variant="caption" color="text.secondary">
                            {d.name}{total > 0 ? ` · ${((d.value / total) * 100).toFixed(0)}%` : ''}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
