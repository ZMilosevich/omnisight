import React, { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import type { Entity } from '../../hooks/useWebSocket';
import { useAppStore } from '../../store/useAppStore';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Core CSS is mandatory
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface IntelPanelProps {
    entities: Record<string, Entity>;
}

const IntelPanel: React.FC<IntelPanelProps> = ({ entities }) => {
    const { activeLayers, setSelectedEntityId } = useAppStore();

    const rowData = Object.values(entities)
        .filter(e => {
            const type = e.type as string;
            if (type === 'security') return activeLayers.has('Security');
            if (type === 'operative') return activeLayers.has('Operatives');
            return activeLayers.has('Transit');
        })
        .map(e => {
            const type = e.type as string;
            return {
                id: e.id,
                source: type === 'security' ? 'GDELT' : (type === 'operative' ? 'FIELD-OPS' : (type === 'aircraft' ? 'ADS-B' : 'AIS')),
                category: type === 'security' ? 'INCIDENT' : (type === 'operative' ? 'PERSONNEL' : (type === 'aircraft' ? 'Transit' : 'Maritime')),
                description: type === 'security'
                    ? `${e.title || 'Security Event'} at Sector ${e.id.slice(-3)}`
                    : type === 'operative'
                        ? `Agent ${e.name} - ${e.status || 'Active'}`
                        : `${type === 'aircraft' ? 'Flight' : 'Vessel'} ${e.callsign || e.id} at ${e.lat.toFixed(3)}, ${e.lng.toFixed(3)}`,
                timestamp: new Date(e.timestamp).toLocaleTimeString()
            };
        });

    const columnDefs = useMemo<ColDef[]>(() => [
        { field: 'timestamp', headerName: 'TIME', minWidth: 90 },
        {
            field: 'category',
            headerName: 'TYPE',
            minWidth: 100,
            cellRenderer: (params: any) => {
                if (params.value === 'INCIDENT') {
                    return (
                        <div className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider leading-tight">
                            {params.value}
                        </div>
                    );
                }
                return <span className="text-white/70">{params.value}</span>;
            }
        },
        { field: 'description', headerName: 'INTEL SOURCE', minWidth: 200 },
    ], []);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        cellStyle: { display: 'flex', alignItems: 'center' }
    }), []);

    const getRowId = useCallback((params: any) => params.data.id, []);

    const activeCount = Object.keys(entities).length;

    return (
        <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border-l border-white/10 p-6 overflow-hidden">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${activeCount > 0 ? 'bg-blue-500 animate-pulse' : 'bg-white/20'} shadow-[0_0_10px_rgba(59,130,246,0.5)]`} />
                    <h2 className="text-2xl font-bold tracking-tight text-white uppercase italic">Intel Center</h2>
                </div>
                <div className={`px-3 py-1 ${activeCount > 0 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'} border rounded text-[10px] font-bold uppercase tracking-widest leading-none`}>
                    {activeCount > 0 ? 'Live Streaming' : 'Waiting for AOI'}
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <div>
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-tighter">Active Signals</span>
                    <div className="text-3xl font-bold text-blue-400 mt-1">{activeCount.toLocaleString()}</div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-tighter">Latency</span>
                    <div className="text-l font-bold text-emerald-400 mt-2">42ms</div>
                </div>
            </div>

            {/* Live Feed Table - Total Override */}
            <div className="flex-grow bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden ag-theme-alpine-dark w-full"
                style={{
                    colorScheme: 'dark',
                    '--ag-background-color': '#0a0a0a',
                    '--ag-header-background-color': '#111111',
                    '--ag-foreground-color': '#ffffff',
                    '--ag-header-foreground-color': '#3b82f6',
                    '--ag-odd-row-background-color': '#0d0d0d',
                    '--ag-border-color': 'rgba(255,255,255,0.1)',
                    '--ag-row-hover-color': '#1a1a1a',
                    '--ag-selected-row-background-color': '#222222',
                    '--ag-font-family': 'monospace',
                    '--ag-cell-horizontal-padding': '8px',
                    '--ag-header-column-separator-display': 'block',
                    '--ag-header-column-separator-color': 'rgba(255,255,255,0.05)',
                } as any}>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    getRowId={getRowId}
                    theme="legacy"
                    gridOptions={{
                        headerHeight: 40,
                        rowHeight: 60,
                    }}
                    alwaysShowHorizontalScroll={true}
                    onGridReady={(params) => {
                        params.api.autoSizeAllColumns();
                    }}
                    onRowDataUpdated={(params) => {
                        params.api.autoSizeAllColumns();
                    }}
                    rowSelection="single"
                    onRowClicked={(e) => e.data && setSelectedEntityId(e.data.id)}
                />
            </div>

            {/* Source Attribution */}
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-mono uppercase tracking-widest text-white/20">
                <span>System 01-A</span>
                <span className="text-blue-500/50">Data Source: Simulated</span>
            </div>
        </div>
    );
};

export default IntelPanel;
