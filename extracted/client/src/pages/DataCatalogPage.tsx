import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Pencil, Trash2, Database, ArrowRightLeft, CheckCircle2, XCircle,
  Play, FileDown, FileSpreadsheet, Search, BookOpen, Server,
  Shield, Link2, Activity, Clock, Building2, Layers,
  Globe, Lock, ChevronDown, ChevronLeft, Key, Loader2, Download,
  Network, LayoutList,
  GitBranch, BarChart3, AlertTriangle,
  Zap, Target, RefreshCw, CircleDot
} from "lucide-react";
import { exportToPDF, exportToExcel } from '@/lib/exports';
import { useConfirmDialog, ConfirmDialog } from '@/components/ConfirmDialog';
import { dmoNavGroups } from "@/lib/navigation";
import { KpiCard } from "@/components/Quality";
import { LoadingButton } from "@/components/LoadingButton";

const ndmoClassificationLabels: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  public: { label: "عام", color: "hub-badge-success", icon: Globe },
  restricted: { label: "مقيد", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Building2 },
  confidential: { label: "سري", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Lock },
  top_secret: { label: "سري للغاية", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: Shield },
};

const systemTypeLabels: Record<string, string> = {
  erp: "نظام تخطيط الموارد (ERP)",
  crm: "إدارة علاقات العملاء (CRM)",
  hrms: "إدارة الموارد البشرية",
  financial: "النظام المالي",
  racing: "إدارة السباقات",
  membership: "إدارة العضويات",
  stable: "إدارة الإسطبلات",
  medical: "النظام الطبي البيطري",
  ticketing: "نظام التذاكر والحجوزات",
  broadcast: "البث والإعلام",
  security: "الأمن والمراقبة",
  iot: "إنترنت الأشياء (IoT)",
  database: "قاعدة بيانات",
  api: "خدمة API",
  file_system: "نظام ملفات",
  data_warehouse: "مستودع بيانات",
  other: "أخرى",
};

const systemCategoryLabels: Record<string, string> = {
  core: "أساسي",
  operational: "تشغيلي",
  analytical: "تحليلي",
  support: "مساند",
  integration: "تكاملي",
};

const dbTypeLabels: Record<string, string> = {
  mysql: "MySQL", postgresql: "PostgreSQL", oracle: "Oracle",
  sqlserver: "SQL Server", mongodb: "MongoDB", redis: "Redis",
  elasticsearch: "Elasticsearch"
};

const dataTypeLabels: Record<string, string> = {
  structured: "مهيكلة", semi_structured: "شبه مهيكلة", unstructured: "غير مهيكلة",
};

const frequencyLabels: Record<string, string> = {
  realtime: "فوري", hourly: "كل ساعة", daily: "يومي",
  weekly: "أسبوعي", monthly: "شهري", on_demand: "عند الطلب",
};

const categoryLabels: Record<string, string> = {
  business: "أعمال", technical: "تقني", compliance: "امتثال",
  security: "أمن", general: "عام"
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار", success: "ناجح", failed: "فشل", testing: "جاري الاختبار"
};

const retentionLabels: Record<string, string> = {
  "1_year": "سنة واحدة", "3_years": "3 سنوات", "5_years": "5 سنوات",
  "7_years": "7 سنوات", "10_years": "10 سنوات", permanent: "دائم",
};

const domainLabels: Record<string, string> = {
  horses: "بيانات الخيل", races: "بيانات السباقات", members: "بيانات الأعضاء",
  employees: "بيانات الموظفين", finance: "بيانات مالية", operations: "بيانات تشغيلية",
  medical: "بيانات طبية", facility: "بيانات المنشآت", media: "بيانات إعلامية",
  compliance: "بيانات الامتثال", other: "أخرى",
};

function SchemaTableCard({ table }: { table: any }) {
  const [expanded, setExpanded] = useState(false);
  const columns: any[] = table.columns || [];
  const hasPK = columns.some((c: any) => c.isPrimaryKey);
  const hasFK = columns.some((c: any) => c.isForeignKey);

  return (
    <div className="border border-white/10 rounded-lg bg-[hsl(222_47%_15%)]/50 overflow-hidden hover:border-white/20 transition-colors">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-right"
        onClick={() => setExpanded(!expanded)}
        data-testid={`schema-table-${table.tableName}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Database className="h-4 w-4 text-[hsl(43_74%_66%)] flex-shrink-0" />
          <span className="font-medium text-white text-sm truncate">{table.tableName}</span>
          {hasPK && <span title="يحتوي مفتاح أساسي"><Key className="h-3 w-3 text-amber-400 flex-shrink-0" /></span>}
          {hasFK && <span title="يحتوي مفتاح خارجي"><Link2 className="h-3 w-3 text-blue-400 flex-shrink-0" /></span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mr-2">
          <span className="text-xs text-white/30">{table.columnsCount || columns.length} عمود</span>
          {table.rowsEstimate > 0 && (
            <span className="text-xs text-white/20 font-mono">{Number(table.rowsEstimate).toLocaleString('ar-SA')}</span>
          )}
          {expanded ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronLeft className="h-4 w-4 text-white/40" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-white/10">
          {columns.length === 0 ? (
            <div className="px-4 py-3 text-xs text-white/40">
              لا توجد بيانات أعمدة — قم باكتشاف الجداول للحصول على التفاصيل الكاملة
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
              {columns.map((col: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 hover:bg-white/5">
                  <div className="flex items-center gap-2">
                    {col.isPrimaryKey && <span title="Primary Key"><Key className="h-3 w-3 text-amber-400 flex-shrink-0" /></span>}
                    {col.isForeignKey && !col.isPrimaryKey && <span title="Foreign Key"><Link2 className="h-3 w-3 text-blue-400 flex-shrink-0" /></span>}
                    {!col.isPrimaryKey && !col.isForeignKey && <div className="w-3 h-3 flex-shrink-0" />}
                    <span className="text-sm text-white/80">{col.name}</span>
                    {!col.nullable && <span className="text-[10px] text-red-400/70 font-bold">*</span>}
                  </div>
                  <span className="font-mono text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded whitespace-nowrap">
                    {col.type}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-2 border-t border-white/5 flex gap-3 text-[10px] text-white/30">
            {hasPK && <span className="flex items-center gap-1"><Key className="h-2.5 w-2.5 text-amber-400" /> مفتاح أساسي</span>}
            {hasFK && <span className="flex items-center gap-1"><Link2 className="h-2.5 w-2.5 text-blue-400" /> مفتاح خارجي</span>}
            <span className="flex items-center gap-1 text-red-400/50">* حقل إلزامي</span>
          </div>
        </div>
      )}
    </div>
  );
}

const FLOW_COLORS: Record<string, string> = {
  etl: '#f59e0b',
  api: '#3b82f6',
  batch: '#8b5cf6',
  realtime: '#10b981',
  file: '#6b7280',
  manual: '#ec4899',
};

function DataFlowDiagram({ systems, flowMappings, systemTypeLabels }: {
  systems: any[];
  flowMappings: any[];
  systemTypeLabels: Record<string, string>;
}) {
  const [hoveredFlow, setHoveredFlow] = useState<number | null>(null);

  if (systems.length === 0) return null;

  const nodeW = 148;
  const nodeH = 64;
  const colGap = 80;
  const rowGap = 90;
  const pad = 50;

  const cols = Math.max(1, Math.ceil(Math.sqrt(systems.length)));
  const positions: Record<number, { x: number; y: number }> = {};
  systems.forEach((sys: any, i: number) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[sys.id] = {
      x: pad + col * (nodeW + colGap),
      y: pad + row * (nodeH + rowGap),
    };
  });

  const totalRows = Math.ceil(systems.length / cols);
  const svgW = pad * 2 + cols * (nodeW + colGap) - colGap;
  const svgH = pad * 2 + totalRows * (nodeH + rowGap) - rowGap;

  const activeFlows = flowMappings.filter((f: any) => f.status === 'active');

  return (
    <div className="overflow-auto rounded-lg bg-[hsl(222_47%_11%)]/60 p-4 border border-white/10">
      <div className="flex gap-4 mb-4 flex-wrap">
        {Object.entries(FLOW_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-white/50">
            <span className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
            {type.toUpperCase()}
          </span>
        ))}
      </div>
      <svg width={svgW} height={svgH} style={{ minWidth: svgW }}>
        <defs>
          {Object.entries(FLOW_COLORS).map(([type, color]) => (
            <marker key={type} id={`arrow-${type}`} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          ))}
          <marker id="arrow-default" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
          </marker>
        </defs>

        {activeFlows.map((flow: any, i: number) => {
          const src = positions[flow.sourceSystemId];
          const tgt = positions[flow.targetSystemId];
          if (!src || !tgt || flow.sourceSystemId === flow.targetSystemId) return null;
          const color = FLOW_COLORS[flow.flowType] || '#6b7280';
          const markerId = FLOW_COLORS[flow.flowType] ? `arrow-${flow.flowType}` : 'arrow-default';
          const x1 = src.x + nodeW;
          const y1 = src.y + nodeH / 2;
          const x2 = tgt.x;
          const y2 = tgt.y + nodeH / 2;
          const cpx = (x1 + x2) / 2;
          const isHovered = hoveredFlow === i;

          return (
            <g key={i} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredFlow(i)}
              onMouseLeave={() => setHoveredFlow(null)}>
              <path d={`M ${x1} ${y1} C ${cpx} ${y1} ${cpx} ${y2} ${x2} ${y2}`}
                fill="none" stroke={color}
                strokeWidth={isHovered ? 2.5 : 1.5}
                strokeOpacity={isHovered ? 1 : 0.6}
                markerEnd={`url(#${markerId})`}
              />
              {isHovered && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6}
                  textAnchor="middle" fill={color} fontSize="10"
                  fontFamily="Cairo, sans-serif" fontWeight="600">
                  {flow.flowNameAr || flow.flowName}
                </text>
              )}
            </g>
          );
        })}

        {systems.map((sys: any) => {
          const pos = positions[sys.id];
          if (!pos) return null;
          const healthy = sys.healthStatus === 'healthy';
          const label = (sys.nameAr || sys.name || '').substring(0, 16);
          const sublabel = (systemTypeLabels[sys.systemType] || sys.systemType || '').substring(0, 20);

          return (
            <g key={sys.id}>
              <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx="8"
                fill="hsl(222 47% 16%)"
                stroke={healthy ? 'hsl(43 74% 66% / 0.5)' : 'rgba(255,255,255,0.08)'}
                strokeWidth="1.5"
              />
              <circle cx={pos.x + 12} cy={pos.y + 12} r="4"
                fill={healthy ? '#10b981' : '#ef4444'} />
              <text x={pos.x + nodeW / 2} y={pos.y + nodeH / 2 - 6}
                textAnchor="middle" fill="white" fontSize="12" fontWeight="600"
                fontFamily="Cairo, sans-serif">
                {label}
              </text>
              <text x={pos.x + nodeW / 2} y={pos.y + nodeH / 2 + 12}
                textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="9"
                fontFamily="Cairo, sans-serif">
                {sublabel}
              </text>
            </g>
          );
        })}
      </svg>
      {activeFlows.length === 0 && (
        <p className="text-center text-white/40 text-sm py-4">لا توجد تدفقات نشطة لعرضها</p>
      )}
    </div>
  );
}

const TRANSFORM_LABELS: Record<string, string> = {
  direct: 'نقل مباشر', aggregation: 'تجميع', calculation: 'حساب',
  merge: 'دمج', split: 'تقسيم', filter: 'تصفية', enrichment: 'إثراء',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  database: 'قاعدة بيانات', api: 'واجهة API', file: 'ملف', manual: 'يدوي',
};

const DIMENSION_META: Record<string, { label: string; icon: any; color: string }> = {
  completeness: { label: 'الاكتمال', icon: Target, color: 'text-blue-400' },
  accuracy: { label: 'الدقة', icon: Zap, color: 'text-green-400' },
  consistency: { label: 'الاتساق', icon: RefreshCw, color: 'text-purple-400' },
  timeliness: { label: 'الحداثة', icon: Clock, color: 'text-amber-400' },
  uniqueness: { label: 'التفرد', icon: CircleDot, color: 'text-cyan-400' },
  validity: { label: 'الصلاحية', icon: CheckCircle2, color: 'text-emerald-400' },
};

function DataLineageMap({ lineageItems, discoveredTables, connections }: {
  lineageItems: any[];
  discoveredTables: any[];
  connections: any[];
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  if (lineageItems.length === 0) return null;

  const getNodeLabel = (type: string, connId: number | null, tableId: number | null) => {
    if (tableId) {
      const tbl = discoveredTables.find((t: any) => t.id === tableId);
      if (tbl) return tbl.tableName;
    }
    if (connId) {
      const conn = connections.find((c: any) => c.id === connId);
      if (conn) return conn.connectionNameAr || conn.connectionName;
    }
    return SOURCE_TYPE_LABELS[type] || type;
  };

  const nodeW = 140;
  const nodeH = 52;
  const hGap = 100;
  const vGap = 28;
  const pad = 40;
  const transformW = 90;
  const transformH = 32;

  const items = lineageItems.filter((l: any) => l.isActive !== false);
  const svgH = pad * 2 + items.length * (nodeH + vGap) - vGap;
  const svgW = pad * 2 + nodeW * 2 + hGap * 2 + transformW;

  return (
    <div className="overflow-auto rounded-lg bg-[hsl(222_47%_11%)]/60 p-4 border border-white/10">
      <div className="flex gap-4 mb-3 flex-wrap text-xs text-white/40">
        {Object.entries(TRANSFORM_LABELS).slice(0, 5).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(43_74%_66%)]" />{v}</span>
        ))}
      </div>
      <svg width={svgW} height={svgH} style={{ minWidth: svgW }}>
        <defs>
          <marker id="lineage-arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(43 74% 66%)" />
          </marker>
        </defs>
        {items.map((item: any, i: number) => {
          const y = pad + i * (nodeH + vGap);
          const srcLabel = getNodeLabel(item.sourceType, item.sourceConnectionId, item.sourceTableId);
          const tgtLabel = getNodeLabel(item.targetType, item.targetConnectionId, item.targetTableId);
          const txLabel = TRANSFORM_LABELS[item.transformationType] || item.transformationType || '—';
          const srcX = pad;
          const txX = pad + nodeW + hGap - transformW / 2;
          const tgtX = pad + nodeW + hGap * 2;
          const isHovered = hoveredNode === `${i}`;

          return (
            <g key={i} onMouseEnter={() => setHoveredNode(`${i}`)} onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'default' }}>
              <rect x={srcX} y={y} width={nodeW} height={nodeH} rx="8"
                fill={isHovered ? 'hsl(222 47% 20%)' : 'hsl(222 47% 16%)'}
                stroke="hsl(43 74% 66% / 0.4)" strokeWidth="1" />
              <text x={srcX + nodeW / 2} y={y + 20} textAnchor="middle"
                fill="white" fontSize="11" fontWeight="600" fontFamily="Cairo, sans-serif">
                {srcLabel.substring(0, 16)}
              </text>
              <text x={srcX + nodeW / 2} y={y + 36} textAnchor="middle"
                fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="Cairo, sans-serif">
                {SOURCE_TYPE_LABELS[item.sourceType] || item.sourceType}
              </text>

              <line x1={srcX + nodeW} y1={y + nodeH / 2} x2={txX} y2={y + nodeH / 2}
                stroke="hsl(43 74% 66% / 0.5)" strokeWidth="1.5" markerEnd="url(#lineage-arrow)" />

              <rect x={txX} y={y + (nodeH - transformH) / 2} width={transformW} height={transformH} rx="14"
                fill="hsl(43 74% 66% / 0.15)" stroke="hsl(43 74% 66% / 0.3)" strokeWidth="1" />
              <text x={txX + transformW / 2} y={y + nodeH / 2 + 4} textAnchor="middle"
                fill="hsl(43 74% 66%)" fontSize="10" fontFamily="Cairo, sans-serif">
                {txLabel}
              </text>

              <line x1={txX + transformW} y1={y + nodeH / 2} x2={tgtX} y2={y + nodeH / 2}
                stroke="hsl(43 74% 66% / 0.5)" strokeWidth="1.5" markerEnd="url(#lineage-arrow)" />

              <rect x={tgtX} y={y} width={nodeW} height={nodeH} rx="8"
                fill={isHovered ? 'hsl(222 47% 20%)' : 'hsl(222 47% 16%)'}
                stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              <text x={tgtX + nodeW / 2} y={y + 20} textAnchor="middle"
                fill="white" fontSize="11" fontWeight="600" fontFamily="Cairo, sans-serif">
                {tgtLabel.substring(0, 16)}
              </text>
              <text x={tgtX + nodeW / 2} y={y + 36} textAnchor="middle"
                fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="Cairo, sans-serif">
                {SOURCE_TYPE_LABELS[item.targetType] || item.targetType}
              </text>

              {isHovered && item.name && (
                <text x={svgW / 2} y={y - 6} textAnchor="middle"
                  fill="hsl(43 74% 66%)" fontSize="10" fontWeight="600" fontFamily="Cairo, sans-serif">
                  {item.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function QualityScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className="absolute text-xl font-bold text-white">{score}%</span>
    </div>
  );
}

export default function DataCatalogPage() {
  const { toast } = useToast();
  const { confirm: confirmAction, dialogProps } = useConfirmDialog();
  const [activeTab, setActiveTab] = useState("systems");
  const [searchQuery, setSearchQuery] = useState("");

  const [isSystemDialogOpen, setIsSystemDialogOpen] = useState(false);
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);
  const [isFlowDialogOpen, setIsFlowDialogOpen] = useState(false);
  const [isDictionaryDialogOpen, setIsDictionaryDialogOpen] = useState(false);
  const [isDiscoverDialogOpen, setIsDiscoverDialogOpen] = useState(false);

  const [editingSystem, setEditingSystem] = useState<any>(null);
  const [editingConnection, setEditingConnection] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingFlow, setEditingFlow] = useState<any>(null);
  const [editingDictionary, setEditingDictionary] = useState<any>(null);
  const [discoveredTablesData, setDiscoveredTablesData] = useState<any[]>([]);
  const [discoveringConnectionName, setDiscoveringConnectionName] = useState("");
  const [discoveryMeta, setDiscoveryMeta] = useState<{ connectionId?: number; systemId?: number; databaseName?: string }>({});
  const [selectedDiscoveredTables, setSelectedDiscoveredTables] = useState<Set<string>>(new Set());
  const [expandedDiscoveredTable, setExpandedDiscoveredTable] = useState<string | null>(null);

  const initialSystemForm = {
    name: "", nameAr: "", systemType: "erp", category: "core",
    apiEndpoint: "", ipAddress: "", port: 443, protocol: "https",
    authType: "api_key", description: "", vendor: "", version: "",
    environment: "production", criticality: "medium",
    dataClassification: "internal", integrationDirection: "read_only",
    slaUptime: "99.5", healthCheckUrl: "",
  };
  const [systemForm, setSystemForm] = useState(initialSystemForm);

  const initialConnectionForm = {
    connectionName: "", connectionNameAr: "", databaseType: "mysql",
    host: "", port: "3306", databaseName: "", username: "",
    encryptedPassword: "", sslEnabled: false, schemaName: "",
    isReadOnly: true, description: "", dataClassification: "confidential",
    systemId: "", connectionString: "", useConnectionString: false,
  };
  const [connectionForm, setConnectionForm] = useState(initialConnectionForm);

  const initialAssetForm = {
    name: "", nameEn: "", description: "", dataType: "structured",
    system: "", systemId: "", classification: "internal", owner: "",
    source: "", format: "", updateFrequency: "", retentionPeriod: "",
    databaseName: "", schemaName: "", tableName: "",
    totalRecords: "", totalColumns: "",
  };
  const [assetForm, setAssetForm] = useState(initialAssetForm);

  const initialFlowForm = {
    flowName: "", flowNameAr: "", sourceSystemId: "", targetSystemId: "",
    flowType: "etl", frequency: "daily", dataVolume: "", status: "active",
  };
  const [flowForm, setFlowForm] = useState(initialFlowForm);

  const initialDictionaryForm = {
    term: "", termEn: "", definition: "", category: "general",
    dataType: "", columnName: "", businessRule: "",
  };
  const [dictionaryForm, setDictionaryForm] = useState(initialDictionaryForm);

  const [selectedSchemaConnectionId, setSelectedSchemaConnectionId] = useState<string>("");
  const [schemaSearchQuery, setSchemaSearchQuery] = useState("");
  const [flowDiagramMode, setFlowDiagramMode] = useState(false);

  const [isLineageDialogOpen, setIsLineageDialogOpen] = useState(false);
  const [editingLineage, setEditingLineage] = useState<any>(null);
  const initialLineageForm = {
    name: "", sourceType: "database", targetType: "database",
    sourceConnectionId: "", sourceTableId: "", targetConnectionId: "", targetTableId: "",
    transformationType: "direct", transformationLogic: "",
    frequency: "daily", dataFlowDirection: "downstream",
  };
  const [lineageForm, setLineageForm] = useState(initialLineageForm);

  const { data: systems = [] } = useQuery<any[]>({ queryKey: ["/api/external-systems"] });
  const { data: connections = [] } = useQuery<any[]>({ queryKey: ["/api/database-connections"] });
  const { data: assets = [] } = useQuery<any[]>({ queryKey: ["/api/data-assets"] });
  const { data: flowMappings = [] } = useQuery<any[]>({ queryKey: ["/api/data-flow-mappings"] });
  const { data: dictionaryTerms = [] } = useQuery<any[]>({ queryKey: ["/api/data-dictionary"] });
  const { data: schemaDiscoveredTables = [], isLoading: isLoadingSchema } = useQuery<any[]>({
    queryKey: [`/api/discovered-tables?connectionId=${selectedSchemaConnectionId}&withColumns=true`],
    enabled: !!selectedSchemaConnectionId,
  });
  const { data: allDiscoveredTables = [] } = useQuery<any[]>({ queryKey: ["/api/discovered-tables"] });
  const { data: lineageItems = [] } = useQuery<any[]>({ queryKey: ["/api/data-lineage"] });
  const { data: qualityHealth, isLoading: isLoadingHealth, refetch: refetchHealth } = useQuery<any>({ queryKey: ["/api/data-quality/health"] });
  const { data: qualityRules = [] } = useQuery<any[]>({ queryKey: ["/api/data-quality"] });

  const getSystemName = (id: number | string | null) => {
    if (!id) return "-";
    const sys = systems.find((s: any) => s.id === Number(id));
    return sys ? (sys.nameAr || sys.name) : "-";
  };

  const createSystemMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/external-systems", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-systems"] });
      setIsSystemDialogOpen(false);
      setSystemForm(initialSystemForm);
      toast({ title: "تم تسجيل النظام بنجاح" });
    },
    onError: () => toast({ title: "فشل في تسجيل النظام", variant: "destructive" }),
  });

  const updateSystemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/external-systems/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-systems"] });
      setIsSystemDialogOpen(false);
      setEditingSystem(null);
      toast({ title: "تم تحديث النظام" });
    },
    onError: () => toast({ title: "فشل في تحديث النظام", variant: "destructive" }),
  });

  const deleteSystemMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/external-systems/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-systems"] });
      toast({ title: "تم حذف النظام" });
    },
    onError: () => toast({ title: "فشل في حذف النظام", variant: "destructive" }),
  });

  const healthCheckMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/external-systems/${id}/health-check`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-systems"] });
      toast({ title: "تم فحص حالة النظام" });
    },
    onError: () => toast({ title: "فشل فحص الاتصال", variant: "destructive" }),
  });

  const createConnectionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/database-connections", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database-connections"] });
      setIsConnectionDialogOpen(false);
      setConnectionForm(initialConnectionForm);
      toast({ title: "تم إضافة الاتصال بنجاح" });
    },
    onError: () => toast({ title: "فشل في إضافة اتصال قاعدة البيانات", variant: "destructive" }),
  });

  const updateConnectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/database-connections/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database-connections"] });
      setIsConnectionDialogOpen(false);
      setEditingConnection(null);
      toast({ title: "تم تحديث الاتصال" });
    },
    onError: () => toast({ title: "فشل في تحديث اتصال قاعدة البيانات", variant: "destructive" }),
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/database-connections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database-connections"] });
      toast({ title: "تم حذف الاتصال" });
    },
    onError: () => toast({ title: "فشل في حذف اتصال قاعدة البيانات", variant: "destructive" }),
  });

  const testConnectionMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/database-connections/${id}/test`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/database-connections"] });
      toast({ title: "تم اختبار الاتصال بنجاح" });
    },
    onError: () => toast({ title: "فشل اختبار الاتصال", variant: "destructive" }),
  });

  const discoverTablesMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/database-connections/${id}/discover-tables`);
      return res.json();
    },
    onSuccess: (data: any) => {
      const rawTables = data.tables || [];
      const tables = rawTables.map((t: any) => ({
        name: t.name || t.tableName,
        type: t.type || t.tableType || 'table',
        rows: t.rows ?? t.estimatedRows ?? t.rowCount ?? 0,
        columnsCount: t.columnsCount || t.columns?.length || 0,
        columns: (t.columns || []).map((c: any) => ({
          name: c.name || c.columnName,
          type: c.type || c.dataType,
          nullable: c.nullable ?? true,
          isPrimaryKey: c.isPrimaryKey ?? false,
          isForeignKey: c.isForeignKey ?? false,
        })),
        primaryKey: t.primaryKey || null,
      }));
      setDiscoveredTablesData(tables);
      setDiscoveryMeta({ connectionId: data.connectionId, systemId: data.systemId, databaseName: data.databaseName });
      setSelectedDiscoveredTables(new Set());
      setExpandedDiscoveredTable(null);
      setIsDiscoverDialogOpen(true);
      toast({ title: `تم اكتشاف ${data.tablesCount || tables.length} جدول` });
    },
    onError: () => toast({ title: "فشل في اكتشاف الجداول", variant: "destructive" }),
  });

  const registerDiscoveredAssetsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/data-assets/register-from-discovery", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-dictionary"] });
      setIsDiscoverDialogOpen(false);
      toast({ title: `تم تسجيل ${data.registered} أصل بيانات بنجاح` });
    },
    onError: () => toast({ title: "فشل في تسجيل الأصول", variant: "destructive" }),
  });

  const createAssetMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/data-assets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-assets"] });
      setIsAssetDialogOpen(false);
      setAssetForm(initialAssetForm);
      toast({ title: "تم تسجيل أصل البيانات بنجاح" });
    },
    onError: () => toast({ title: "فشل في تسجيل أصل البيانات", variant: "destructive" }),
  });

  const updateAssetMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/data-assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-assets"] });
      setIsAssetDialogOpen(false);
      setEditingAsset(null);
      toast({ title: "تم تحديث أصل البيانات" });
    },
    onError: () => toast({ title: "فشل في تحديث أصل البيانات", variant: "destructive" }),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/data-assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-assets"] });
      toast({ title: "تم حذف أصل البيانات" });
    },
    onError: () => toast({ title: "فشل في حذف أصل البيانات", variant: "destructive" }),
  });

  const createFlowMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/data-flow-mappings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-flow-mappings"] });
      setIsFlowDialogOpen(false);
      setFlowForm(initialFlowForm);
      toast({ title: "تم إضافة التدفق بنجاح" });
    },
    onError: () => toast({ title: "فشل في إضافة تدفق البيانات", variant: "destructive" }),
  });

  const updateFlowMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/data-flow-mappings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-flow-mappings"] });
      setIsFlowDialogOpen(false);
      setEditingFlow(null);
      toast({ title: "تم تحديث التدفق" });
    },
    onError: () => toast({ title: "فشل في تحديث تدفق البيانات", variant: "destructive" }),
  });

  const deleteFlowMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/data-flow-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-flow-mappings"] });
      toast({ title: "تم حذف التدفق" });
    },
    onError: () => toast({ title: "فشل في حذف تدفق البيانات", variant: "destructive" }),
  });

  const createDictionaryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/data-dictionary", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-dictionary"] });
      setIsDictionaryDialogOpen(false);
      setDictionaryForm(initialDictionaryForm);
      toast({ title: "تم إضافة المصطلح بنجاح" });
    },
    onError: () => toast({ title: "فشل في إضافة مصطلح القاموس", variant: "destructive" }),
  });

  const updateDictionaryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/data-dictionary/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-dictionary"] });
      setIsDictionaryDialogOpen(false);
      setEditingDictionary(null);
      toast({ title: "تم تحديث المصطلح" });
    },
    onError: () => toast({ title: "فشل في تحديث مصطلح القاموس", variant: "destructive" }),
  });

  const deleteDictionaryMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/data-dictionary/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-dictionary"] });
      toast({ title: "تم حذف المصطلح" });
    },
    onError: () => toast({ title: "فشل في حذف مصطلح القاموس", variant: "destructive" }),
  });

  const createLineageMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/data-lineage", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-lineage"] });
      setIsLineageDialogOpen(false);
      toast({ title: "تم إضافة مسار البيانات" });
    },
    onError: () => toast({ title: "فشل في إضافة المسار", variant: "destructive" }),
  });

  const updateLineageMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/data-lineage/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-lineage"] });
      setIsLineageDialogOpen(false);
      setEditingLineage(null);
      toast({ title: "تم تحديث مسار البيانات" });
    },
    onError: () => toast({ title: "فشل في تحديث المسار", variant: "destructive" }),
  });

  const deleteLineageMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/data-lineage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-lineage"] });
      toast({ title: "تم حذف مسار البيانات" });
    },
    onError: () => toast({ title: "فشل في حذف المسار", variant: "destructive" }),
  });

  const runAllQualityMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/data-quality/run-all"),
    onSuccess: () => {
      refetchHealth();
      queryClient.invalidateQueries({ queryKey: ["/api/data-quality"] });
      toast({ title: "تم تشغيل فحص الجودة بنجاح" });
    },
    onError: () => toast({ title: "فشل في تشغيل فحص الجودة", variant: "destructive" }),
  });

  const handleEditLineage = (item: any) => {
    setEditingLineage(item);
    setLineageForm({
      name: item.name || "",
      sourceType: item.sourceType || "database",
      targetType: item.targetType || "database",
      sourceConnectionId: item.sourceConnectionId?.toString() || "",
      sourceTableId: item.sourceTableId?.toString() || "",
      targetConnectionId: item.targetConnectionId?.toString() || "",
      targetTableId: item.targetTableId?.toString() || "",
      transformationType: item.transformationType || "direct",
      transformationLogic: item.transformationLogic || "",
      frequency: item.frequency || "daily",
      dataFlowDirection: item.dataFlowDirection || "downstream",
    });
    setIsLineageDialogOpen(true);
  };

  const handleSubmitLineage = () => {
    const data = {
      ...lineageForm,
      sourceConnectionId: lineageForm.sourceConnectionId ? Number(lineageForm.sourceConnectionId) : null,
      sourceTableId: lineageForm.sourceTableId ? Number(lineageForm.sourceTableId) : null,
      targetConnectionId: lineageForm.targetConnectionId ? Number(lineageForm.targetConnectionId) : null,
      targetTableId: lineageForm.targetTableId ? Number(lineageForm.targetTableId) : null,
    };
    if (editingLineage) {
      updateLineageMutation.mutate({ id: editingLineage.id, data });
    } else {
      createLineageMutation.mutate(data);
    }
  };

  const handleEditSystem = (sys: any) => {
    setEditingSystem(sys);
    setSystemForm({
      name: sys.name || "", nameAr: sys.nameAr || "", systemType: sys.systemType || "erp",
      category: sys.category || "core", apiEndpoint: sys.apiEndpoint || "",
      ipAddress: sys.ipAddress || "", port: sys.port || 443, protocol: sys.protocol || "https",
      authType: sys.authType || "api_key", description: sys.description || "",
      vendor: sys.vendor || "", version: sys.version || "",
      environment: sys.environment || "production", criticality: sys.criticality || "medium",
      dataClassification: sys.dataClassification || "internal",
      integrationDirection: sys.integrationDirection || "read_only",
      slaUptime: sys.slaUptime?.toString() || "99.5", healthCheckUrl: sys.healthCheckUrl || "",
    });
    setIsSystemDialogOpen(true);
  };

  const handleSubmitSystem = () => {
    if (!systemForm.name.trim() && !systemForm.nameAr.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم النظام", variant: "destructive" });
      return;
    }
    const data = { ...systemForm, port: Number(systemForm.port), slaUptime: systemForm.slaUptime };
    if (editingSystem) {
      updateSystemMutation.mutate({ id: editingSystem.id, data });
    } else {
      createSystemMutation.mutate(data);
    }
  };

  const handleEditConnection = (conn: any) => {
    setEditingConnection(conn);
    setConnectionForm({
      connectionName: conn.connectionName || "", connectionNameAr: conn.connectionNameAr || "",
      databaseType: conn.databaseType || "mysql", host: conn.host || "",
      port: conn.port?.toString() || "3306", databaseName: conn.databaseName || "",
      username: conn.username || "", encryptedPassword: "", sslEnabled: conn.sslEnabled || false,
      schemaName: conn.schemaName || "", isReadOnly: conn.isReadOnly !== false,
      description: conn.description || "", dataClassification: conn.dataClassification || "confidential",
      systemId: conn.systemId?.toString() || "",
    });
    setIsConnectionDialogOpen(true);
  };

  const handleSubmitConnection = () => {
    if (!connectionForm.connectionName.trim() && !connectionForm.connectionNameAr.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم الاتصال", variant: "destructive" });
      return;
    }
    if (connectionForm.useConnectionString) {
      if (!connectionForm.connectionString.trim()) {
        toast({ title: "تنبيه", description: "يرجى إدخال رابط الاتصال (Connection String)", variant: "destructive" });
        return;
      }
    } else {
      if (!connectionForm.host.trim()) {
        toast({ title: "تنبيه", description: "يرجى إدخال عنوان الخادم (Host)", variant: "destructive" });
        return;
      }
      if (!connectionForm.databaseName.trim()) {
        toast({ title: "تنبيه", description: "يرجى إدخال اسم قاعدة البيانات", variant: "destructive" });
        return;
      }
    }
    const { connectionName, connectionNameAr, databaseName, ...rest } = connectionForm;
    const data = {
      ...rest,
      name: connectionName,
      nameAr: connectionNameAr,
      database: databaseName,
      port: parseInt(connectionForm.port) || 3306,
      systemId: connectionForm.systemId ? Number(connectionForm.systemId) : null,
    };
    if (editingConnection) {
      updateConnectionMutation.mutate({ id: editingConnection.id, data });
    } else {
      createConnectionMutation.mutate(data);
    }
  };

  const handleEditAsset = (asset: any) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name || "", nameEn: asset.nameEn || "", description: asset.description || "",
      dataType: asset.dataType || "structured", system: asset.system || "",
      systemId: asset.systemId?.toString() || "", classification: asset.classification || "internal",
      owner: asset.owner || "", source: asset.source || "", format: asset.format || "",
      updateFrequency: asset.updateFrequency || "", retentionPeriod: asset.retentionPeriod || "",
      databaseName: asset.databaseName || "", schemaName: asset.schemaName || "",
      tableName: asset.tableName || "", totalRecords: asset.totalRecords?.toString() || "",
      totalColumns: asset.totalColumns?.toString() || "",
    });
    setIsAssetDialogOpen(true);
  };

  const handleSubmitAsset = () => {
    if (!assetForm.name.trim() && !assetForm.nameEn.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم الأصل البياني", variant: "destructive" });
      return;
    }
    const data = {
      ...assetForm,
      systemId: assetForm.systemId ? Number(assetForm.systemId) : null,
      totalRecords: assetForm.totalRecords ? Number(assetForm.totalRecords) : null,
      totalColumns: assetForm.totalColumns ? Number(assetForm.totalColumns) : null,
    };
    if (editingAsset) {
      updateAssetMutation.mutate({ id: editingAsset.id, data });
    } else {
      createAssetMutation.mutate(data);
    }
  };

  const handleEditDictionary = (entry: any) => {
    setEditingDictionary(entry);
    setDictionaryForm({
      term: entry.term || "", termEn: entry.termEn || "", definition: entry.definition || "",
      category: entry.category || "general", dataType: entry.dataType || "",
      columnName: entry.columnName || "", businessRule: entry.businessRule || "",
    });
    setIsDictionaryDialogOpen(true);
  };

  const handleSubmitDictionary = () => {
    if (!dictionaryForm.term.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال المصطلح", variant: "destructive" });
      return;
    }
    if (editingDictionary) {
      updateDictionaryMutation.mutate({ id: editingDictionary.id, data: dictionaryForm });
    } else {
      createDictionaryMutation.mutate(dictionaryForm);
    }
  };

  const handleEditFlow = (flow: any) => {
    setEditingFlow(flow);
    setFlowForm({
      flowName: flow.flowName || "", flowNameAr: flow.flowNameAr || "",
      sourceSystemId: flow.sourceSystemId?.toString() || "", targetSystemId: flow.targetSystemId?.toString() || "",
      flowType: flow.flowType || "etl", frequency: flow.frequency || "daily",
      dataVolume: flow.dataVolume || "", status: flow.status || "active",
    });
    setIsFlowDialogOpen(true);
  };

  const handleSubmitFlow = () => {
    if (!flowForm.flowName.trim() && !flowForm.flowNameAr.trim()) {
      toast({ title: "تنبيه", description: "يرجى إدخال اسم تدفق البيانات", variant: "destructive" });
      return;
    }
    const data = {
      ...flowForm,
      sourceSystemId: flowForm.sourceSystemId ? Number(flowForm.sourceSystemId) : null,
      targetSystemId: flowForm.targetSystemId ? Number(flowForm.targetSystemId) : null,
    };
    if (editingFlow) {
      updateFlowMutation.mutate({ id: editingFlow.id, data });
    } else {
      createFlowMutation.mutate(data);
    }
  };

  const handleDiscoverTables = (conn: any) => {
    setDiscoveringConnectionName(conn.connectionName || conn.connectionNameAr || "");
    discoverTablesMutation.mutate(conn.id);
  };

  const handleExportPDF = () => {
    const allData = [
      ...systems.map((s: any) => ({ name: s.nameAr || s.name, type: systemTypeLabels[s.systemType] || s.systemType, category: 'نظام', status: s.healthStatus === 'healthy' ? 'متصل' : 'غير متصل' })),
      ...assets.map((a: any) => ({ name: a.name, type: dataTypeLabels[a.dataType] || a.dataType, category: 'أصل بيانات', status: ndmoClassificationLabels[a.classification]?.label || a.classification })),
    ];
    exportToPDF({ title: 'فهرس البيانات المركزي - NDMO', subtitle: 'نادي سباقات الخيل - مركز التحكم', columns: [{ header: 'الاسم', key: 'name', width: 40 }, { header: 'النوع', key: 'type', width: 25 }, { header: 'الفئة', key: 'category', width: 30 }, { header: 'الحالة', key: 'status', width: 25 }], data: allData, filename: `data-catalog-ndmo-${new Date().toISOString().split('T')[0]}`, orientation: 'landscape' });
  };

  const handleExportExcel = () => {
    const allData = [
      ...systems.map((s: any) => ({ name: s.nameAr || s.name, type: systemTypeLabels[s.systemType] || s.systemType, category: 'نظام', classification: ndmoClassificationLabels[s.dataClassification]?.label || s.dataClassification, status: s.healthStatus === 'healthy' ? 'متصل' : 'غير متصل' })),
      ...assets.map((a: any) => ({ name: a.name, type: dataTypeLabels[a.dataType] || a.dataType, category: 'أصل بيانات', classification: ndmoClassificationLabels[a.classification]?.label || a.classification, status: a.status })),
    ];
    exportToExcel({ title: 'فهرس البيانات المركزي', columns: [{ header: 'الاسم', key: 'name' }, { header: 'النوع', key: 'type' }, { header: 'الفئة', key: 'category' }, { header: 'التصنيف', key: 'classification' }, { header: 'الحالة', key: 'status' }], data: allData, filename: `data-catalog-ndmo-${new Date().toISOString().split('T')[0]}` });
  };

  const stats = {
    totalSystems: systems.length,
    healthySystems: systems.filter((s: any) => s.healthStatus === 'healthy').length,
    totalAssets: assets.length,
    restrictedAssets: assets.filter((a: any) => a.classification === 'restricted').length,
    totalConnections: connections.length,
    activeConnections: connections.filter((c: any) => c.testStatus === 'success').length,
    totalFlows: flowMappings.length,
    totalTerms: dictionaryTerms.length,
  };

  const ClassificationBadge = ({ value }: { value: string }) => {
    const cls = ndmoClassificationLabels[value];
    if (!cls) return <Badge variant="outline">{value}</Badge>;
    const Icon = cls.icon;
    return <Badge className={cls.color}><Icon className="h-3 w-3 ml-1" />{cls.label}</Badge>;
  };

  const HealthBadge = ({ status }: { status: string }) => {
    if (status === 'healthy') return <Badge className="hub-badge-success"><CheckCircle2 className="h-3 w-3 ml-1" />متصل</Badge>;
    if (status === 'unhealthy' || status === 'error') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"><XCircle className="h-3 w-3 ml-1" />غير متصل</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 ml-1" />غير محدد</Badge>;
  };

  return (
    <DashboardLayout
      title="فهرس البيانات المركزي"
      subtitle="إدارة وفهرسة الأنظمة والبيانات وفق معايير NDMO"
      navGroups={dmoNavGroups}
      portalName="مكتب إدارة البيانات"
    >
      <div className="space-y-5" dir="rtl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="الأنظمة المسجلة" value={stats.totalSystems} icon={Server} color="navy" sublabel={`${stats.healthySystems} متصل`} data-testid="text-total-systems" />
          <KpiCard label="أصول البيانات" value={stats.totalAssets} icon={Layers} color="gold" sublabel={`${stats.restrictedAssets} مقيد`} data-testid="text-total-assets" />
          <KpiCard label="اتصالات قواعد البيانات" value={stats.totalConnections} icon={Database} color="success" sublabel={`${stats.activeConnections} نشط`} data-testid="text-total-connections" />
          <KpiCard label="تدفقات البيانات" value={stats.totalFlows} icon={ArrowRightLeft} color="info" sublabel={`${stats.totalTerms} مصطلح`} data-testid="text-total-flows" />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث في الفهرس..." className="pr-9 bg-[hsl(222_47%_15%)]/50 border-white/10 text-white placeholder:text-white/40" data-testid="input-catalog-search" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="border-white/10 text-white/70" data-testid="button-export-pdf">
              <FileDown className="w-4 h-4 ml-1" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="border-white/10 text-white/70" data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 ml-1" />Excel
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full overflow-x-auto bg-[hsl(222_47%_15%)]/50 gap-0.5 p-1">
            <TabsTrigger value="systems" className="flex-1 min-w-[80px] text-xs" data-testid="tab-systems">الأنظمة</TabsTrigger>
            <TabsTrigger value="assets" className="flex-1 min-w-[80px] text-xs" data-testid="tab-assets">أصول البيانات</TabsTrigger>
            <TabsTrigger value="connections" className="flex-1 min-w-[80px] text-xs" data-testid="tab-connections">الاتصالات</TabsTrigger>
            <TabsTrigger value="flows" className="flex-1 min-w-[80px] text-xs" data-testid="tab-flows">تدفق البيانات</TabsTrigger>
            <TabsTrigger value="schema" className="flex-1 min-w-[80px] text-xs" data-testid="tab-schema">المخطط</TabsTrigger>
            <TabsTrigger value="lineage" className="flex-1 min-w-[80px] text-xs" data-testid="tab-lineage">تتبع البيانات</TabsTrigger>
            <TabsTrigger value="quality" className="flex-1 min-w-[80px] text-xs" data-testid="tab-quality">الجودة</TabsTrigger>
            <TabsTrigger value="dictionary" className="flex-1 min-w-[80px] text-xs" data-testid="tab-dictionary">القاموس</TabsTrigger>
          </TabsList>

          {/* ========== TAB: الأنظمة المسجلة ========== */}
          <TabsContent value="systems" className="mt-4">
            <Card className="bg-[hsl(222_47%_13%)]/80 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-white">سجل الأنظمة الداخلية</CardTitle>
                  <p className="text-xs text-white/40 mt-1">تسجيل وربط أنظمة نادي سباقات الخيل عبر API</p>
                </div>
                <Button onClick={() => { setEditingSystem(null); setSystemForm(initialSystemForm); setIsSystemDialogOpen(true); }} className="btn-gold" data-testid="button-add-system">
                  <Plus className="h-4 w-4 ml-2" />تسجيل نظام جديد
                </Button>
              </CardHeader>
              <CardContent>
                {systems.length === 0 ? (
                  <div className="text-center py-12">
                    <Server className="h-16 w-16 mx-auto mb-4 text-white/40" />
                    <p className="text-white/50 text-lg font-medium">لا توجد أنظمة مسجلة</p>
                    <p className="text-white/50 text-sm mt-2">سجّل أنظمة النادي الداخلية لبدء فهرسة البيانات</p>
                    <Button onClick={() => { setEditingSystem(null); setSystemForm(initialSystemForm); setIsSystemDialogOpen(true); }} className="btn-gold mt-4" data-testid="button-add-system-empty">
                      <Plus className="h-4 w-4 ml-2" />تسجيل أول نظام
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-white/50">النظام</TableHead>
                        <TableHead className="text-white/50">النوع</TableHead>
                        <TableHead className="text-white/50">الفئة</TableHead>
                        <TableHead className="text-white/50">نقطة الاتصال (API)</TableHead>
                        <TableHead className="text-white/50">التصنيف</TableHead>
                        <TableHead className="text-white/50">الحالة</TableHead>
                        <TableHead className="text-white/50">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systems.filter((s: any) => !searchQuery || (s.nameAr || s.name || '').includes(searchQuery)).map((sys: any) => (
                        <TableRow key={sys.id} className="border-white/5" data-testid={`row-system-${sys.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-white">{sys.nameAr || sys.name}</div>
                              {sys.nameAr && sys.name && <div className="text-xs text-white/40">{sys.name}</div>}
                              {sys.vendor && <div className="text-[10px] text-white/50">{sys.vendor} {sys.version}</div>}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-white/60 border-white/15">{systemTypeLabels[sys.systemType] || sys.systemType}</Badge></TableCell>
                          <TableCell><span className="text-white/60 text-sm">{systemCategoryLabels[sys.category] || sys.category}</span></TableCell>
                          <TableCell>
                            {sys.apiEndpoint ? (
                              <div className="flex items-center gap-1">
                                <Link2 className="h-3 w-3 hub-stat-gold/60" />
                                <span className="font-mono text-xs text-white/50 max-w-[180px] truncate" title={sys.apiEndpoint}>{sys.apiEndpoint}</span>
                              </div>
                            ) : sys.ipAddress ? (
                              <span className="font-mono text-xs text-white/50">{sys.ipAddress}:{sys.port}</span>
                            ) : <span className="text-white/50 text-xs">غير محدد</span>}
                          </TableCell>
                          <TableCell><ClassificationBadge value={sys.dataClassification || 'internal'} /></TableCell>
                          <TableCell><HealthBadge status={sys.healthStatus || 'unknown'} /></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => healthCheckMutation.mutate(sys.id)} title="فحص الاتصال" disabled={healthCheckMutation.isPending} data-testid={`button-health-check-${sys.id}`}>
                                <Activity className="h-4 w-4 text-emerald-400" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleEditSystem(sys)} data-testid={`button-edit-system-${sys.id}`}>
                                <Pencil className="h-4 w-4 text-white/50" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteSystemMutation.mutate(sys.id), { title: 'حذف النظام', description: `هل أنت متأكد من حذف "${sys.nameAr || sys.name}"؟ سيتم حذف جميع الاتصالات المرتبطة.` })} data-testid={`button-delete-system-${sys.id}`}>
                                <Trash2 className="h-4 w-4 text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: أصول البيانات ========== */}
          <TabsContent value="assets" className="mt-4">
            <Card className="bg-[hsl(222_47%_13%)]/80 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-white">أصول البيانات</CardTitle>
                  <p className="text-xs text-white/40 mt-1">فهرسة أصول البيانات مع تصنيفات NDMO (ملكية / حساسية / احتفاظ)</p>
                </div>
                <Button onClick={() => { setEditingAsset(null); setAssetForm(initialAssetForm); setIsAssetDialogOpen(true); }} className="btn-gold" data-testid="button-add-asset">
                  <Plus className="h-4 w-4 ml-2" />تسجيل أصل بيانات
                </Button>
              </CardHeader>
              <CardContent>
                {assets.length === 0 ? (
                  <div className="text-center py-12">
                    <Layers className="h-16 w-16 mx-auto mb-4 text-white/40" />
                    <p className="text-white/50 text-lg font-medium">لا توجد أصول بيانات مسجلة</p>
                    <p className="text-white/50 text-sm mt-2">سجّل أصول البيانات من الأنظمة الداخلية وصنّفها وفق NDMO</p>
                    <Button onClick={() => { setEditingAsset(null); setAssetForm(initialAssetForm); setIsAssetDialogOpen(true); }} className="btn-gold mt-4" data-testid="button-add-asset-empty">
                      <Plus className="h-4 w-4 ml-2" />تسجيل أول أصل
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-white/50">اسم الأصل</TableHead>
                        <TableHead className="text-white/50">النظام المصدر</TableHead>
                        <TableHead className="text-white/50">نوع البيانات</TableHead>
                        <TableHead className="text-white/50">التصنيف (NDMO)</TableHead>
                        <TableHead className="text-white/50">المالك</TableHead>
                        <TableHead className="text-white/50">التحديث</TableHead>
                        <TableHead className="text-white/50">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assets.filter((a: any) => !searchQuery || (a.name || '').includes(searchQuery)).map((asset: any) => (
                        <TableRow key={asset.id} className="border-white/5" data-testid={`row-asset-${asset.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-white">{asset.name}</div>
                              {asset.tableName && <div className="text-[10px] text-white/50 font-mono">{asset.databaseName ? `${asset.databaseName}.` : ''}{asset.tableName}</div>}
                            </div>
                          </TableCell>
                          <TableCell><span className="text-white/60 text-sm">{getSystemName(asset.systemId) !== '-' ? getSystemName(asset.systemId) : (asset.system || asset.source || '-')}</span></TableCell>
                          <TableCell><Badge variant="outline" className="text-white/60 border-white/15">{dataTypeLabels[asset.dataType] || asset.dataType}</Badge></TableCell>
                          <TableCell><ClassificationBadge value={asset.classification || 'internal'} /></TableCell>
                          <TableCell><span className="text-white/60 text-sm">{asset.owner || '-'}</span></TableCell>
                          <TableCell><span className="text-white/40 text-xs">{frequencyLabels[asset.updateFrequency] || asset.updateFrequency || '-'}</span></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEditAsset(asset)} data-testid={`button-edit-asset-${asset.id}`}>
                                <Pencil className="h-4 w-4 text-white/50" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteAssetMutation.mutate(asset.id), { title: 'حذف أصل البيانات', description: 'هل أنت متأكد من حذف هذا الأصل؟' })} data-testid={`button-delete-asset-${asset.id}`}>
                                <Trash2 className="h-4 w-4 text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: اتصالات قواعد البيانات ========== */}
          <TabsContent value="connections" className="mt-4">
            <Card className="bg-[hsl(222_47%_13%)]/80 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-white">اتصالات قواعد البيانات</CardTitle>
                  <p className="text-xs text-white/40 mt-1">ربط قواعد بيانات الأنظمة الداخلية واكتشاف الجداول</p>
                </div>
                <Button onClick={() => { setEditingConnection(null); setConnectionForm(initialConnectionForm); setIsConnectionDialogOpen(true); }} className="btn-gold" data-testid="button-add-connection">
                  <Plus className="h-4 w-4 ml-2" />إضافة اتصال
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/50">الاسم</TableHead>
                      <TableHead className="text-white/50">النظام</TableHead>
                      <TableHead className="text-white/50">النوع</TableHead>
                      <TableHead className="text-white/50">الخادم</TableHead>
                      <TableHead className="text-white/50">التصنيف</TableHead>
                      <TableHead className="text-white/50">الحالة</TableHead>
                      <TableHead className="text-white/50">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Database className="h-12 w-12 mx-auto mb-3 text-white/30" />
                          <p className="text-white/50 font-medium">لا توجد اتصالات</p>
                          <p className="text-white/40 text-sm mt-1">أضف اتصال بقاعدة بيانات لنظام مسجل لبدء اكتشاف الجداول وفحص الجودة</p>
                        </TableCell>
                      </TableRow>
                    ) : connections.map((conn: any) => (
                      <TableRow key={conn.id} className="border-white/5" data-testid={`row-connection-${conn.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-white">{conn.connectionNameAr || conn.connectionName}</div>
                            {conn.connectionNameAr && conn.connectionName && <div className="text-xs text-white/40">{conn.connectionName}</div>}
                          </div>
                        </TableCell>
                        <TableCell><span className="text-white/60 text-sm">{getSystemName(conn.systemId)}</span></TableCell>
                        <TableCell><Badge variant="outline" className="text-white/60 border-white/15">{dbTypeLabels[conn.databaseType] || conn.databaseType}</Badge></TableCell>
                        <TableCell><span className="font-mono text-xs text-white/50">{conn.host}:{conn.port}</span></TableCell>
                        <TableCell><ClassificationBadge value={conn.dataClassification || 'confidential'} /></TableCell>
                        <TableCell>
                          {conn.testStatus === 'success' ? <Badge className="hub-badge-success"><CheckCircle2 className="h-3 w-3 ml-1" />متصل</Badge>
                            : conn.testStatus === 'failed' ? <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"><XCircle className="h-3 w-3 ml-1" />فشل</Badge>
                            : <Badge variant="secondary">{statusLabels[conn.testStatus] || 'قيد الانتظار'}</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => testConnectionMutation.mutate(conn.id)} title="اختبار الاتصال" data-testid={`button-test-connection-${conn.id}`}><Play className="h-4 w-4 text-emerald-400" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDiscoverTables(conn)} title="اكتشاف الجداول" disabled={discoverTablesMutation.isPending} data-testid={`button-discover-${conn.id}`}><Search className="h-4 w-4 text-blue-400" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleEditConnection(conn)} data-testid={`button-edit-connection-${conn.id}`}><Pencil className="h-4 w-4 text-white/50" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteConnectionMutation.mutate(conn.id), { title: 'حذف الاتصال', description: 'هل أنت متأكد من حذف هذا الاتصال؟' })} data-testid={`button-delete-connection-${conn.id}`}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: تدفق البيانات ========== */}
          <TabsContent value="flows" className="mt-4">
            <Card className="bg-[hsl(222_47%_13%)]/80 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-white">تدفق البيانات بين الأنظمة</CardTitle>
                  <p className="text-xs text-white/40 mt-1">تتبع حركة البيانات بين الأنظمة الداخلية على مستوى الجهة</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-[hsl(222_47%_15%)]/60 rounded-md p-0.5 border border-white/10">
                    <Button
                      size="sm" variant="ghost"
                      className={`h-7 px-2 text-xs gap-1.5 ${!flowDiagramMode ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
                      onClick={() => setFlowDiagramMode(false)}
                      data-testid="button-flow-list-mode"
                    >
                      <LayoutList className="h-3.5 w-3.5" />قائمة
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className={`h-7 px-2 text-xs gap-1.5 ${flowDiagramMode ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
                      onClick={() => setFlowDiagramMode(true)}
                      data-testid="button-flow-diagram-mode"
                    >
                      <Network className="h-3.5 w-3.5" />رسم بياني
                    </Button>
                  </div>
                  <Button onClick={() => { setEditingFlow(null); setFlowForm(initialFlowForm); setIsFlowDialogOpen(true); }} className="btn-gold" data-testid="button-add-flow">
                    <Plus className="h-4 w-4 ml-2" />إضافة تدفق
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {flowDiagramMode ? (
                  systems.length === 0 ? (
                    <div className="text-center py-12">
                      <Network className="h-16 w-16 mx-auto mb-4 text-white/40" />
                      <p className="text-white/50 text-lg font-medium">لا توجد أنظمة مسجلة</p>
                      <p className="text-white/50 text-sm mt-2">أضف أنظمة من تبويب الأنظمة أولاً</p>
                    </div>
                  ) : (
                    <DataFlowDiagram
                      systems={systems}
                      flowMappings={flowMappings}
                      systemTypeLabels={systemTypeLabels}
                    />
                  )
                ) : flowMappings.length === 0 ? (
                  <div className="text-center py-12">
                    <ArrowRightLeft className="h-16 w-16 mx-auto mb-4 text-white/40" />
                    <p className="text-white/50 text-lg font-medium">لا توجد تدفقات مسجلة</p>
                    <p className="text-white/50 text-sm mt-2">حدد كيف تنتقل البيانات بين الأنظمة</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-white/50">اسم التدفق</TableHead>
                        <TableHead className="text-white/50">النظام المصدر</TableHead>
                        <TableHead className="text-white/50">النظام الهدف</TableHead>
                        <TableHead className="text-white/50">النوع</TableHead>
                        <TableHead className="text-white/50">التكرار</TableHead>
                        <TableHead className="text-white/50">الحالة</TableHead>
                        <TableHead className="text-white/50">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flowMappings.map((flow: any) => (
                        <TableRow key={flow.id} className="border-white/5" data-testid={`row-flow-${flow.id}`}>
                          <TableCell className="font-medium text-white">{flow.flowNameAr || flow.flowName}</TableCell>
                          <TableCell className="text-white/60">{getSystemName(flow.sourceSystemId)}</TableCell>
                          <TableCell className="text-white/60">{getSystemName(flow.targetSystemId)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-white/60 border-white/15">{flow.flowType || '-'}</Badge></TableCell>
                          <TableCell className="text-white/50 text-sm">{frequencyLabels[flow.frequency] || flow.frequency || '-'}</TableCell>
                          <TableCell>
                            <Badge className={flow.status === 'active' ? 'hub-badge-success' : 'hub-badge-neutral'}>
                              {flow.status === 'active' ? 'نشط' : 'متوقف'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEditFlow(flow)} data-testid={`button-edit-flow-${flow.id}`}><Pencil className="h-4 w-4 text-white/50" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteFlowMutation.mutate(flow.id), { title: 'حذف التدفق', description: 'هل أنت متأكد من حذف هذا التدفق؟' })} data-testid={`button-delete-flow-${flow.id}`}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: مستعرض المخطط ========== */}
          <TabsContent value="schema" className="mt-4">
            <Card className="bg-[hsl(222_47%_13%)]/80 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">مستعرض مخطط قاعدة البيانات</CardTitle>
                <p className="text-xs text-white/40 mt-1">استعراض بنية الجداول والأعمدة والعلاقات من الأنظمة المربوطة</p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 mb-6 items-center flex-wrap">
                  <Select value={selectedSchemaConnectionId} onValueChange={(v) => { setSelectedSchemaConnectionId(v); setSchemaSearchQuery(""); }} data-testid="select-schema-connection">
                    <SelectTrigger className="w-[300px] bg-[hsl(222_47%_15%)]/50 border-white/10 text-white">
                      <SelectValue placeholder="اختر اتصال قاعدة بيانات..." />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.filter((c: any) => c.testStatus === 'success').map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          <span className="flex items-center gap-2">
                            <Database className="h-3.5 w-3.5" />
                            {c.connectionNameAr || c.connectionName}
                            <span className="text-xs text-muted-foreground">— {dbTypeLabels[c.databaseType] || c.databaseType}</span>
                          </span>
                        </SelectItem>
                      ))}
                      {connections.filter((c: any) => c.testStatus !== 'success').length > 0 && connections.filter((c: any) => c.testStatus === 'success').length === 0 && (
                        <SelectItem value="__none__" disabled>لا توجد اتصالات نشطة — اختبر الاتصال أولاً</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedSchemaConnectionId && (
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                      <Input
                        value={schemaSearchQuery}
                        onChange={e => setSchemaSearchQuery(e.target.value)}
                        placeholder="بحث في الجداول والأعمدة..."
                        className="pr-9 w-[240px] bg-[hsl(222_47%_15%)]/50 border-white/10 text-white placeholder:text-white/40"
                        data-testid="input-schema-search"
                      />
                    </div>
                  )}
                  {selectedSchemaConnectionId && schemaDiscoveredTables.length > 0 && (
                    <span className="text-xs text-white/40">
                      {schemaDiscoveredTables.filter((t: any) => !schemaSearchQuery || t.tableName?.toLowerCase().includes(schemaSearchQuery.toLowerCase())).length} جدول
                    </span>
                  )}
                </div>

                {!selectedSchemaConnectionId ? (
                  <div className="text-center py-16">
                    <Network className="h-16 w-16 mx-auto mb-4 text-white/30" />
                    <p className="text-white/50 text-lg font-medium">اختر اتصالاً لعرض المخطط</p>
                    <p className="text-white/40 text-sm mt-2">سيتم عرض جميع الجداول والأعمدة والعلاقات تلقائياً</p>
                    {connections.filter((c: any) => c.testStatus === 'success').length === 0 && (
                      <Button
                        size="sm" variant="outline"
                        className="mt-4 border-white/20 text-white/60 hover:text-white"
                        onClick={() => setActiveTab("connections")}
                      >
                        <Database className="h-4 w-4 ml-2" />اذهب إلى الاتصالات
                      </Button>
                    )}
                  </div>
                ) : isLoadingSchema ? (
                  <div className="text-center py-16">
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-white/40 animate-spin" />
                    <p className="text-white/50">جاري تحميل المخطط...</p>
                  </div>
                ) : schemaDiscoveredTables.length === 0 ? (
                  <div className="text-center py-16">
                    <Database className="h-12 w-12 mx-auto mb-4 text-white/30" />
                    <p className="text-white/50 text-lg font-medium">لا توجد جداول مكتشفة</p>
                    <p className="text-white/40 text-sm mt-2">قم باكتشاف الجداول من تبويب الاتصالات أولاً</p>
                    <Button
                      size="sm" variant="outline"
                      className="mt-4 border-white/20 text-white/60 hover:text-white"
                      onClick={() => setActiveTab("connections")}
                    >
                      <Play className="h-4 w-4 ml-2" />اذهب إلى الاتصالات
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-3 mb-4 p-3 bg-[hsl(222_47%_15%)]/40 rounded-lg border border-white/5">
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Key className="h-3 w-3 text-amber-400" />مفتاح أساسي
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Link2 className="h-3 w-3 text-blue-400" />مفتاح خارجي
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <span className="text-red-400/70 font-bold text-[10px]">*</span>حقل إلزامي
                      </div>
                      <div className="mr-auto text-xs text-white/30">
                        انقر على الجدول لعرض الأعمدة
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {schemaDiscoveredTables
                        .filter((t: any) => !schemaSearchQuery || t.tableName?.toLowerCase().includes(schemaSearchQuery.toLowerCase()))
                        .map((table: any, idx: number) => (
                          <SchemaTableCard key={idx} table={table} />
                        ))
                      }
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: تتبع البيانات (Data Lineage) ========== */}
          <TabsContent value="lineage" className="mt-4">
            <Card className="bg-[hsl(222_47%_13%)]/80 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-white flex items-center gap-2"><GitBranch className="h-5 w-5 text-[hsl(43_74%_66%)]" />خريطة تتبع البيانات</CardTitle>
                  <p className="text-xs text-white/40 mt-1">تتبع مسار البيانات من المصدر إلى الوجهة مروراً بالتحويلات — متوافق مع NDMO</p>
                </div>
                <Button onClick={() => { setEditingLineage(null); setLineageForm(initialLineageForm); setIsLineageDialogOpen(true); }} className="btn-gold" data-testid="button-add-lineage">
                  <Plus className="h-4 w-4 ml-2" />إضافة مسار
                </Button>
              </CardHeader>
              <CardContent>
                {lineageItems.length === 0 ? (
                  <div className="text-center py-16">
                    <GitBranch className="h-16 w-16 mx-auto mb-4 text-white/30" />
                    <p className="text-white/50 text-lg font-medium">لا توجد مسارات بيانات مسجلة</p>
                    <p className="text-white/40 text-sm mt-2">أضف مسارات تتبع لتوثيق حركة البيانات بين الأنظمة (مطلوب لامتثال NDMO)</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <DataLineageMap
                      lineageItems={lineageItems}
                      discoveredTables={allDiscoveredTables}
                      connections={connections}
                    />
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead className="text-white/50">اسم المسار</TableHead>
                          <TableHead className="text-white/50">المصدر</TableHead>
                          <TableHead className="text-white/50">التحويل</TableHead>
                          <TableHead className="text-white/50">الهدف</TableHead>
                          <TableHead className="text-white/50">التكرار</TableHead>
                          <TableHead className="text-white/50">الاتجاه</TableHead>
                          <TableHead className="text-white/50">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineageItems.map((item: any) => (
                          <TableRow key={item.id} className="border-white/5" data-testid={`row-lineage-${item.id}`}>
                            <TableCell className="font-medium text-white">{item.name || '—'}</TableCell>
                            <TableCell className="text-white/60 text-sm">{SOURCE_TYPE_LABELS[item.sourceType] || item.sourceType}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[hsl(43_74%_66%)] border-[hsl(43_74%_66%)]/30 text-xs">
                                {TRANSFORM_LABELS[item.transformationType] || item.transformationType || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-white/60 text-sm">{SOURCE_TYPE_LABELS[item.targetType] || item.targetType}</TableCell>
                            <TableCell className="text-white/50 text-sm">{frequencyLabels[item.frequency] || item.frequency || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-white/50 border-white/15 text-xs">
                                {item.dataFlowDirection === 'upstream' ? '↑ صعودي' : item.dataFlowDirection === 'bidirectional' ? '↔ ثنائي' : '↓ نزولي'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => handleEditLineage(item)} data-testid={`button-edit-lineage-${item.id}`}><Pencil className="h-4 w-4 text-white/50" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteLineageMutation.mutate(item.id), { title: 'حذف المسار', description: 'هل أنت متأكد من حذف هذا المسار؟' })} data-testid={`button-delete-lineage-${item.id}`}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: جودة البيانات (Data Quality) ========== */}
          <TabsContent value="quality" className="mt-4">
            <Card className="bg-[hsl(222_47%_13%)]/80 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-white flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[hsl(43_74%_66%)]" />لوحة جودة البيانات</CardTitle>
                  <p className="text-xs text-white/40 mt-1">فحص تلقائي لجودة البيانات عبر 6 أبعاد — الاكتمال والدقة والاتساق والحداثة والتفرد والصلاحية</p>
                </div>
                <LoadingButton
                  onClick={() => runAllQualityMutation.mutate()}
                  loading={runAllQualityMutation.isPending}
                  className="btn-gold"
                  data-testid="button-run-quality"
                >
                  <Play className="h-4 w-4 ml-2" />تشغيل فحص الجودة
                </LoadingButton>
              </CardHeader>
              <CardContent>
                {isLoadingHealth ? (
                  <div className="text-center py-16">
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-white/40 animate-spin" />
                    <p className="text-white/50">جاري تحليل جودة البيانات...</p>
                  </div>
                ) : qualityHealth ? (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      <div className="flex flex-col items-center gap-2 p-6 bg-[hsl(222_47%_15%)]/40 rounded-xl border border-white/5 min-w-[160px]">
                        <QualityScoreRing score={qualityHealth.healthScore || 0} size={110} />
                        <span className="text-sm font-medium text-white">الصحة العامة</span>
                        <span className="text-xs text-white/40">{qualityHealth.totalTables || 0} جدول · {(qualityHealth.totalRecords || 0).toLocaleString('ar-SA')} سجل</span>
                      </div>
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="p-4 rounded-lg bg-[hsl(222_47%_15%)]/40 border border-white/5">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-blue-400" />
                            <span className="text-xs text-white/50">الاكتمال</span>
                          </div>
                          <span className="text-2xl font-bold text-white">{qualityHealth.overallCompleteness?.toFixed(1) || '—'}%</span>
                        </div>
                        <div className="p-4 rounded-lg bg-[hsl(222_47%_15%)]/40 border border-white/5">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <span className="text-xs text-white/50">حقول فارغة</span>
                          </div>
                          <span className="text-2xl font-bold text-white">{(qualityHealth.totalNullFields || 0).toLocaleString('ar-SA')}</span>
                        </div>
                        <div className="p-4 rounded-lg bg-[hsl(222_47%_15%)]/40 border border-white/5">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <span className="text-xs text-white/50">جداول بمشاكل</span>
                          </div>
                          <span className="text-2xl font-bold text-white">{qualityHealth.tablesWithIssues?.length || 0}</span>
                        </div>
                      </div>
                    </div>

                    {qualityHealth.tablesWithIssues?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-white/70 mb-3">الجداول التي تحتاج تحسين</h3>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10">
                              <TableHead className="text-white/50">الجدول</TableHead>
                              <TableHead className="text-white/50">عدد السجلات</TableHead>
                              <TableHead className="text-white/50">حقول فارغة</TableHead>
                              <TableHead className="text-white/50">الاكتمال</TableHead>
                              <TableHead className="text-white/50">المشكلة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {qualityHealth.tablesWithIssues.slice(0, 15).map((tbl: any, idx: number) => (
                              <TableRow key={idx} className="border-white/5" data-testid={`row-quality-issue-${idx}`}>
                                <TableCell className="font-mono text-sm text-white">{tbl.tableName}</TableCell>
                                <TableCell className="text-white/60">{(tbl.rowCount || 0).toLocaleString('ar-SA')}</TableCell>
                                <TableCell className="text-amber-400">{(tbl.nullFields || 0).toLocaleString('ar-SA')}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                                      <div className="h-full rounded-full transition-all" style={{
                                        width: `${tbl.completeness || 0}%`,
                                        backgroundColor: (tbl.completeness || 0) >= 90 ? '#10b981' : (tbl.completeness || 0) >= 70 ? '#f59e0b' : '#ef4444'
                                      }} />
                                    </div>
                                    <span className="text-xs text-white/50">{(tbl.completeness || 0).toFixed(1)}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-white/50 text-sm max-w-[200px] truncate">{tbl.issue}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="text-xs text-white/30 text-center pt-2">
                      آخر تحليل: {qualityHealth.analyzedAt ? new Date(qualityHealth.analyzedAt).toLocaleString('ar-SA') : '—'}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 text-white/30" />
                    <p className="text-white/50 text-lg font-medium">لم يتم تشغيل فحص الجودة بعد</p>
                    <p className="text-white/40 text-sm mt-2">اضغط "تشغيل فحص الجودة" لتحليل كل الجداول تلقائياً</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== TAB: قاموس البيانات ========== */}
          <TabsContent value="dictionary" className="mt-4">
            <Card className="bg-[hsl(222_47%_13%)]/80 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-white">قاموس البيانات</CardTitle>
                  <p className="text-xs text-white/40 mt-1">توحيد المصطلحات والتعريفات المستخدمة في الأنظمة</p>
                </div>
                <Button onClick={() => { setEditingDictionary(null); setDictionaryForm(initialDictionaryForm); setIsDictionaryDialogOpen(true); }} className="btn-gold" data-testid="button-add-dictionary">
                  <Plus className="h-4 w-4 ml-2" />إضافة مصطلح
                </Button>
              </CardHeader>
              <CardContent>
                {dictionaryTerms.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-white/40" />
                    <p className="text-white/50 text-lg font-medium">لا توجد مصطلحات</p>
                    <p className="text-white/50 text-sm mt-2">أضف مصطلحات لتوحيد المفاهيم عبر الأنظمة</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-white/50">المصطلح</TableHead>
                        <TableHead className="text-white/50">المصطلح (EN)</TableHead>
                        <TableHead className="text-white/50">التعريف</TableHead>
                        <TableHead className="text-white/50">الفئة</TableHead>
                        <TableHead className="text-white/50">نوع البيانات</TableHead>
                        <TableHead className="text-white/50">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dictionaryTerms.filter((d: any) => !searchQuery || (d.term || '').includes(searchQuery)).map((entry: any) => (
                        <TableRow key={entry.id} className="border-white/5" data-testid={`row-dictionary-${entry.id}`}>
                          <TableCell className="font-medium text-white">{entry.term || '-'}</TableCell>
                          <TableCell className="text-white/50">{entry.termEn || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate text-white/60" title={entry.definition}>{entry.definition || '-'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-white/60 border-white/15">{categoryLabels[entry.category] || entry.category || '-'}</Badge></TableCell>
                          <TableCell className="font-mono text-xs text-white/50">{entry.dataType || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEditDictionary(entry)} data-testid={`button-edit-dictionary-${entry.id}`}><Pencil className="h-4 w-4 text-white/50" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => confirmAction(() => deleteDictionaryMutation.mutate(entry.id), { title: 'حذف المصطلح', description: 'هل أنت متأكد من حذف هذا المصطلح؟' })} data-testid={`button-delete-dictionary-${entry.id}`}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ========== DIALOG: تسجيل/تعديل نظام ========== */}
        <Dialog open={isSystemDialogOpen} onOpenChange={(open) => { setIsSystemDialogOpen(open); if (!open) { setEditingSystem(null); setSystemForm(initialSystemForm); } }}>
          <DialogContent className="sm:max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingSystem ? "تعديل النظام" : "تسجيل نظام داخلي جديد"}</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>اسم النظام (إنجليزي) *</Label><Input value={systemForm.name} onChange={e => setSystemForm({...systemForm, name: e.target.value})} placeholder="Racing Management System" data-testid="input-system-name" /></div>
                <div><Label>اسم النظام (عربي) *</Label><Input value={systemForm.nameAr} onChange={e => setSystemForm({...systemForm, nameAr: e.target.value})} placeholder="نظام إدارة السباقات" data-testid="input-system-name-ar" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>نوع النظام *</Label>
                  <Select value={systemForm.systemType} onValueChange={v => setSystemForm({...systemForm, systemType: v})}>
                    <SelectTrigger data-testid="select-system-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(systemTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الفئة</Label>
                  <Select value={systemForm.category} onValueChange={v => setSystemForm({...systemForm, category: v})}>
                    <SelectTrigger data-testid="select-system-category"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(systemCategoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الأهمية</Label>
                  <Select value={systemForm.criticality} onValueChange={v => setSystemForm({...systemForm, criticality: v})}>
                    <SelectTrigger data-testid="select-system-criticality"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                      <SelectItem value="critical">حرجة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 rounded-md bg-white/5 border border-white/10 space-y-3">
                <p className="text-xs font-medium hub-stat-gold">إعدادات الاتصال (API)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>نقطة النهاية (API Endpoint)</Label><Input value={systemForm.apiEndpoint} onChange={e => setSystemForm({...systemForm, apiEndpoint: e.target.value})} placeholder="https://api.system.local/v1" dir="ltr" data-testid="input-system-api" /></div>
                  <div><Label>رابط فحص الحالة (Health Check)</Label><Input value={systemForm.healthCheckUrl} onChange={e => setSystemForm({...systemForm, healthCheckUrl: e.target.value})} placeholder="https://api.system.local/health" dir="ltr" data-testid="input-system-health-url" /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>عنوان IP</Label><Input value={systemForm.ipAddress} onChange={e => setSystemForm({...systemForm, ipAddress: e.target.value})} placeholder="192.168.1.100" dir="ltr" data-testid="input-system-ip" /></div>
                  <div><Label>المنفذ</Label><Input type="number" value={systemForm.port} onChange={e => setSystemForm({...systemForm, port: Number(e.target.value)})} data-testid="input-system-port" /></div>
                  <div>
                    <Label>البروتوكول</Label>
                    <Select value={systemForm.protocol} onValueChange={v => setSystemForm({...systemForm, protocol: v})}>
                      <SelectTrigger data-testid="select-system-protocol"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="https">HTTPS</SelectItem>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="tcp">TCP</SelectItem>
                        <SelectItem value="ssh">SSH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>نوع المصادقة</Label>
                    <Select value={systemForm.authType} onValueChange={v => setSystemForm({...systemForm, authType: v})}>
                      <SelectTrigger data-testid="select-system-auth"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api_key">API Key</SelectItem>
                        <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="token">Bearer Token</SelectItem>
                        <SelectItem value="certificate">شهادة رقمية</SelectItem>
                        <SelectItem value="none">بدون مصادقة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>اتجاه التكامل</Label>
                    <Select value={systemForm.integrationDirection} onValueChange={v => setSystemForm({...systemForm, integrationDirection: v})}>
                      <SelectTrigger data-testid="select-system-direction"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read_only">قراءة فقط</SelectItem>
                        <SelectItem value="write_only">كتابة فقط</SelectItem>
                        <SelectItem value="read_write">قراءة وكتابة</SelectItem>
                        <SelectItem value="bidirectional">ثنائي الاتجاه</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>تصنيف البيانات (NDMO)</Label>
                  <Select value={systemForm.dataClassification} onValueChange={v => setSystemForm({...systemForm, dataClassification: v})}>
                    <SelectTrigger data-testid="select-system-classification"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ndmoClassificationLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>نسبة التوفر SLA (%)</Label><Input value={systemForm.slaUptime} onChange={e => setSystemForm({...systemForm, slaUptime: e.target.value})} placeholder="99.5" data-testid="input-system-sla" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>المورد / الشركة المطورة</Label><Input value={systemForm.vendor} onChange={e => setSystemForm({...systemForm, vendor: e.target.value})} data-testid="input-system-vendor" /></div>
                <div><Label>الإصدار</Label><Input value={systemForm.version} onChange={e => setSystemForm({...systemForm, version: e.target.value})} placeholder="v2.1.0" data-testid="input-system-version" /></div>
              </div>
              <div><Label>الوصف</Label><Textarea value={systemForm.description} onChange={e => setSystemForm({...systemForm, description: e.target.value})} rows={2} data-testid="input-system-description" /></div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsSystemDialogOpen(false); setEditingSystem(null); }} data-testid="button-cancel-system">إلغاء</Button>
              <LoadingButton onClick={handleSubmitSystem} disabled={!systemForm.name} loading={createSystemMutation.isPending || updateSystemMutation.isPending} loadingText="جاري الحفظ..." className="btn-gold" data-testid="button-submit-system">
                {editingSystem ? "تحديث" : "تسجيل النظام"}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========== DIALOG: اتصال قاعدة بيانات ========== */}
        <Dialog open={isConnectionDialogOpen} onOpenChange={(open) => { setIsConnectionDialogOpen(open); if (!open) { setEditingConnection(null); setConnectionForm(initialConnectionForm); } }}>
          <DialogContent className="sm:max-w-2xl" dir="rtl">
            <DialogHeader><DialogTitle>{editingConnection ? "تعديل الاتصال" : "إضافة اتصال قاعدة بيانات"}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>اسم الاتصال (EN) *</Label><Input value={connectionForm.connectionName} onChange={e => setConnectionForm({...connectionForm, connectionName: e.target.value})} data-testid="input-connection-name" /></div>
                <div><Label>اسم الاتصال (AR)</Label><Input value={connectionForm.connectionNameAr} onChange={e => setConnectionForm({...connectionForm, connectionNameAr: e.target.value})} data-testid="input-connection-name-ar" /></div>
              </div>
              {systems.length > 0 && (
                <div>
                  <Label>ربط بنظام مسجل</Label>
                  <Select value={connectionForm.systemId} onValueChange={v => setConnectionForm({...connectionForm, systemId: v})}>
                    <SelectTrigger data-testid="select-connection-system"><SelectValue placeholder="اختر النظام..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون ربط</SelectItem>
                      {systems.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nameAr || s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>نوع قاعدة البيانات *</Label>
                  <Select value={connectionForm.databaseType} onValueChange={v => {
                    const portMap: Record<string, string> = { mysql: '3306', postgresql: '5432', sqlserver: '1433', oracle: '1521', mongodb: '27017', redis: '6379', elasticsearch: '9200' };
                    setConnectionForm({...connectionForm, databaseType: v, port: portMap[v] || '5432'});
                  }}>
                    <SelectTrigger data-testid="select-database-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(dbTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-end gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 bg-white/5">
                    <Switch checked={connectionForm.useConnectionString} onCheckedChange={v => setConnectionForm({...connectionForm, useConnectionString: v})} data-testid="switch-use-connstring" />
                    <Label className="text-xs whitespace-nowrap">استخدام Connection String</Label>
                  </div>
                </div>
              </div>
              {connectionForm.useConnectionString ? (
                <div className="space-y-2">
                  <Label>رابط الاتصال (Connection String) *</Label>
                  <Textarea
                    value={connectionForm.connectionString}
                    onChange={e => setConnectionForm({...connectionForm, connectionString: e.target.value})}
                    placeholder={connectionForm.databaseType === 'sqlserver'
                      ? 'Server=192.168.1.100;Database=mydb;User Id=sa;Password=pass;'
                      : connectionForm.databaseType === 'mongodb'
                      ? 'mongodb://user:pass@192.168.1.100:27017/mydb'
                      : connectionForm.databaseType === 'mysql'
                      ? 'mysql://user:pass@192.168.1.100:3306/mydb'
                      : connectionForm.databaseType === 'oracle'
                      ? 'oracle://user:pass@192.168.1.100:1521/orcl'
                      : connectionForm.databaseType === 'redis'
                      ? 'redis://user:pass@192.168.1.100:6379'
                      : 'postgresql://user:pass@192.168.1.100:5432/mydb'}
                    rows={2}
                    dir="ltr"
                    className="font-mono text-sm"
                    data-testid="input-connection-string"
                  />
                  <p className="text-xs text-muted-foreground">الصيغة تعتمد على نوع قاعدة البيانات — سيتم استخراج المضيف والمنفذ واسم القاعدة تلقائياً</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>عنوان الخادم *</Label><Input value={connectionForm.host} onChange={e => setConnectionForm({...connectionForm, host: e.target.value})} placeholder="192.168.1.100" dir="ltr" data-testid="input-connection-host" /></div>
                    <div><Label>المنفذ *</Label><Input value={connectionForm.port} onChange={e => setConnectionForm({...connectionForm, port: e.target.value})} data-testid="input-connection-port" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>اسم قاعدة البيانات *</Label><Input value={connectionForm.databaseName} onChange={e => setConnectionForm({...connectionForm, databaseName: e.target.value})} data-testid="input-connection-db-name" /></div>
                    <div><Label>Schema</Label><Input value={connectionForm.schemaName} onChange={e => setConnectionForm({...connectionForm, schemaName: e.target.value})} data-testid="input-connection-schema" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>اسم المستخدم</Label><Input value={connectionForm.username} onChange={e => setConnectionForm({...connectionForm, username: e.target.value})} data-testid="input-connection-username" /></div>
                    <div><Label>كلمة المرور</Label><Input type="password" value={connectionForm.encryptedPassword} onChange={e => setConnectionForm({...connectionForm, encryptedPassword: e.target.value})} data-testid="input-connection-password" /></div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>تصنيف البيانات (NDMO)</Label>
                  <Select value={connectionForm.dataClassification} onValueChange={v => setConnectionForm({...connectionForm, dataClassification: v})}>
                    <SelectTrigger data-testid="select-connection-classification"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ndmoClassificationLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2"><Switch checked={connectionForm.sslEnabled} onCheckedChange={v => setConnectionForm({...connectionForm, sslEnabled: v})} data-testid="switch-ssl" /><Label>تفعيل SSL</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={connectionForm.isReadOnly} onCheckedChange={v => setConnectionForm({...connectionForm, isReadOnly: v})} data-testid="switch-readonly" /><Label>قراءة فقط</Label></div>
                </div>
              </div>
              <div><Label>الوصف</Label><Textarea value={connectionForm.description} onChange={e => setConnectionForm({...connectionForm, description: e.target.value})} rows={2} data-testid="input-connection-description" /></div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsConnectionDialogOpen(false); setEditingConnection(null); }} data-testid="button-cancel-connection">إلغاء</Button>
              <LoadingButton onClick={handleSubmitConnection} loading={createConnectionMutation.isPending || updateConnectionMutation.isPending} loadingText="جاري الحفظ..." className="btn-gold" data-testid="button-submit-connection">{editingConnection ? "تحديث" : "إضافة"}</LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========== DIALOG: أصل بيانات ========== */}
        <Dialog open={isAssetDialogOpen} onOpenChange={(open) => { setIsAssetDialogOpen(open); if (!open) { setEditingAsset(null); setAssetForm(initialAssetForm); } }}>
          <DialogContent className="sm:max-w-2xl" dir="rtl">
            <DialogHeader><DialogTitle>{editingAsset ? "تعديل أصل البيانات" : "تسجيل أصل بيانات جديد"}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>اسم الأصل (عربي) *</Label><Input value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} placeholder="جدول بيانات الخيل" data-testid="input-asset-name" /></div>
                <div><Label>الاسم (إنجليزي)</Label><Input value={assetForm.nameEn} onChange={e => setAssetForm({...assetForm, nameEn: e.target.value})} placeholder="Horses Data Table" data-testid="input-asset-name-en" /></div>
              </div>
              <div><Label>الوصف</Label><Textarea value={assetForm.description} onChange={e => setAssetForm({...assetForm, description: e.target.value})} rows={2} placeholder="وصف تفصيلي لأصل البيانات والغرض منه..." data-testid="input-asset-description" /></div>

              {systems.length > 0 && (
                <div>
                  <Label>النظام المصدر</Label>
                  <Select value={assetForm.systemId} onValueChange={v => setAssetForm({...assetForm, systemId: v, system: systems.find((s: any) => s.id === Number(v))?.name || ''})}>
                    <SelectTrigger data-testid="select-asset-system"><SelectValue placeholder="اختر النظام المصدر..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون ربط</SelectItem>
                      {systems.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nameAr || s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="p-3 rounded-md bg-white/5 border border-white/10 space-y-3">
                <p className="text-xs font-medium hub-stat-gold">تصنيف NDMO</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>تصنيف البيانات *</Label>
                    <Select value={assetForm.classification} onValueChange={v => setAssetForm({...assetForm, classification: v})}>
                      <SelectTrigger data-testid="select-asset-classification"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(ndmoClassificationLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>نوع البيانات</Label>
                    <Select value={assetForm.dataType} onValueChange={v => setAssetForm({...assetForm, dataType: v})}>
                      <SelectTrigger data-testid="select-asset-datatype"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(dataTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>مالك البيانات (Data Owner)</Label><Input value={assetForm.owner} onChange={e => setAssetForm({...assetForm, owner: e.target.value})} placeholder="الإدارة أو الشخص المسؤول" data-testid="input-asset-owner" /></div>
                  <div>
                    <Label>سياسة الاحتفاظ</Label>
                    <Select value={assetForm.retentionPeriod} onValueChange={v => setAssetForm({...assetForm, retentionPeriod: v})}>
                      <SelectTrigger data-testid="select-asset-retention"><SelectValue placeholder="اختر..." /></SelectTrigger>
                      <SelectContent>{Object.entries(retentionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>تكرار التحديث</Label>
                    <Select value={assetForm.updateFrequency} onValueChange={v => setAssetForm({...assetForm, updateFrequency: v})}>
                      <SelectTrigger data-testid="select-asset-frequency"><SelectValue placeholder="اختر..." /></SelectTrigger>
                      <SelectContent>{Object.entries(frequencyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>التنسيق</Label><Input value={assetForm.format} onChange={e => setAssetForm({...assetForm, format: e.target.value})} placeholder="CSV, JSON, XML, SQL Table" data-testid="input-asset-format" /></div>
                </div>
              </div>

              <div className="p-3 rounded-md bg-white/5 border border-white/10 space-y-3">
                <p className="text-xs font-medium text-white/40">معلومات تقنية (اختياري)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>قاعدة البيانات</Label><Input value={assetForm.databaseName} onChange={e => setAssetForm({...assetForm, databaseName: e.target.value})} dir="ltr" data-testid="input-asset-db" /></div>
                  <div><Label>Schema</Label><Input value={assetForm.schemaName} onChange={e => setAssetForm({...assetForm, schemaName: e.target.value})} dir="ltr" data-testid="input-asset-schema" /></div>
                  <div><Label>اسم الجدول</Label><Input value={assetForm.tableName} onChange={e => setAssetForm({...assetForm, tableName: e.target.value})} dir="ltr" data-testid="input-asset-table" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>عدد السجلات</Label><Input type="number" value={assetForm.totalRecords} onChange={e => setAssetForm({...assetForm, totalRecords: e.target.value})} data-testid="input-asset-records" /></div>
                  <div><Label>عدد الأعمدة</Label><Input type="number" value={assetForm.totalColumns} onChange={e => setAssetForm({...assetForm, totalColumns: e.target.value})} data-testid="input-asset-columns" /></div>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsAssetDialogOpen(false); setEditingAsset(null); }} data-testid="button-cancel-asset">إلغاء</Button>
              <LoadingButton onClick={handleSubmitAsset} disabled={!assetForm.name} loading={createAssetMutation.isPending || updateAssetMutation.isPending} loadingText="جاري الحفظ..." className="btn-gold" data-testid="button-submit-asset">{editingAsset ? "تحديث" : "تسجيل الأصل"}</LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========== DIALOG: تدفق بيانات ========== */}
        <Dialog open={isFlowDialogOpen} onOpenChange={(open) => { setIsFlowDialogOpen(open); if (!open) { setEditingFlow(null); setFlowForm(initialFlowForm); } }}>
          <DialogContent className="sm:max-w-xl" dir="rtl">
            <DialogHeader><DialogTitle>{editingFlow ? "تعديل التدفق" : "إضافة تدفق بيانات"}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>اسم التدفق (عربي) *</Label><Input value={flowForm.flowName} onChange={e => setFlowForm({...flowForm, flowName: e.target.value})} data-testid="input-flow-name" /></div>
                <div><Label>اسم التدفق (EN)</Label><Input value={flowForm.flowNameAr} onChange={e => setFlowForm({...flowForm, flowNameAr: e.target.value})} data-testid="input-flow-name-ar" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>النظام المصدر</Label>
                  <Select value={flowForm.sourceSystemId} onValueChange={v => setFlowForm({...flowForm, sourceSystemId: v})}>
                    <SelectTrigger data-testid="select-flow-source"><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>{systems.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nameAr || s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>النظام الهدف</Label>
                  <Select value={flowForm.targetSystemId} onValueChange={v => setFlowForm({...flowForm, targetSystemId: v})}>
                    <SelectTrigger data-testid="select-flow-target"><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>{systems.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nameAr || s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>النوع</Label>
                  <Select value={flowForm.flowType} onValueChange={v => setFlowForm({...flowForm, flowType: v})}>
                    <SelectTrigger data-testid="select-flow-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="etl">ETL</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="streaming">Streaming</SelectItem>
                      <SelectItem value="batch">Batch</SelectItem>
                      <SelectItem value="manual">يدوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>التكرار</Label>
                  <Select value={flowForm.frequency} onValueChange={v => setFlowForm({...flowForm, frequency: v})}>
                    <SelectTrigger data-testid="select-flow-frequency"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(frequencyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>حجم البيانات</Label><Input value={flowForm.dataVolume} onChange={e => setFlowForm({...flowForm, dataVolume: e.target.value})} placeholder="500MB/day" data-testid="input-flow-volume" /></div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsFlowDialogOpen(false); setEditingFlow(null); }} data-testid="button-cancel-flow">إلغاء</Button>
              <LoadingButton onClick={handleSubmitFlow} disabled={!flowForm.flowName} loading={createFlowMutation.isPending || updateFlowMutation.isPending} loadingText="جاري الحفظ..." className="btn-gold" data-testid="button-submit-flow">{editingFlow ? "تحديث" : "إضافة التدفق"}</LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========== DIALOG: مصطلح قاموس ========== */}
        <Dialog open={isDictionaryDialogOpen} onOpenChange={(open) => { setIsDictionaryDialogOpen(open); if (!open) { setEditingDictionary(null); setDictionaryForm(initialDictionaryForm); } }}>
          <DialogContent className="sm:max-w-xl" dir="rtl">
            <DialogHeader><DialogTitle>{editingDictionary ? "تعديل المصطلح" : "إضافة مصطلح جديد"}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>المصطلح (عربي) *</Label><Input value={dictionaryForm.term} onChange={e => setDictionaryForm({...dictionaryForm, term: e.target.value})} data-testid="input-dictionary-term" /></div>
                <div><Label>المصطلح (EN)</Label><Input value={dictionaryForm.termEn} onChange={e => setDictionaryForm({...dictionaryForm, termEn: e.target.value})} data-testid="input-dictionary-term-en" /></div>
              </div>
              <div><Label>التعريف *</Label><Textarea value={dictionaryForm.definition} onChange={e => setDictionaryForm({...dictionaryForm, definition: e.target.value})} rows={3} data-testid="input-dictionary-definition" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الفئة</Label>
                  <Select value={dictionaryForm.category} onValueChange={v => setDictionaryForm({...dictionaryForm, category: v})}>
                    <SelectTrigger data-testid="select-dictionary-category"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>نوع البيانات</Label><Input value={dictionaryForm.dataType} onChange={e => setDictionaryForm({...dictionaryForm, dataType: e.target.value})} placeholder="varchar, integer, date" data-testid="input-dictionary-data-type" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>اسم العمود</Label><Input value={dictionaryForm.columnName} onChange={e => setDictionaryForm({...dictionaryForm, columnName: e.target.value})} dir="ltr" data-testid="input-dictionary-column" /></div>
                <div><Label>قاعدة العمل</Label><Input value={dictionaryForm.businessRule} onChange={e => setDictionaryForm({...dictionaryForm, businessRule: e.target.value})} data-testid="input-dictionary-rule" /></div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDictionaryDialogOpen(false); setEditingDictionary(null); }} data-testid="button-cancel-dictionary">إلغاء</Button>
              <LoadingButton onClick={handleSubmitDictionary} disabled={!dictionaryForm.term || !dictionaryForm.definition} loading={createDictionaryMutation.isPending || updateDictionaryMutation.isPending} loadingText="جاري الحفظ..." className="btn-gold" data-testid="button-submit-dictionary">{editingDictionary ? "تحديث" : "إضافة"}</LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========== DIALOG: اكتشاف الجداول ========== */}
        <Dialog open={isDiscoverDialogOpen} onOpenChange={setIsDiscoverDialogOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[85vh]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 hub-stat-gold" />
                الجداول المكتشفة - {discoveringConnectionName}
              </DialogTitle>
              {discoveredTablesData.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  اكتشاف {discoveredTablesData.length} جدول من {discoveryMeta.databaseName || 'قاعدة البيانات'} — حدد الجداول لتسجيلها كأصول بيانات
                </p>
              )}
            </DialogHeader>
            <DialogBody className="max-h-[55vh] overflow-y-auto">
              {discoveredTablesData.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-muted-foreground">لم يتم اكتشاف جداول</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-muted/50 border">
                    <Checkbox
                      checked={selectedDiscoveredTables.size === discoveredTablesData.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDiscoveredTables(new Set(discoveredTablesData.map(t => t.name)));
                        } else {
                          setSelectedDiscoveredTables(new Set());
                        }
                      }}
                      data-testid="checkbox-select-all-tables"
                    />
                    <span className="text-sm font-medium">تحديد الكل ({discoveredTablesData.length} جدول)</span>
                    <span className="text-xs text-muted-foreground mr-auto">{selectedDiscoveredTables.size} محدد</span>
                  </div>
                  {discoveredTablesData.map((t: any, i: number) => {
                    const tName = t.name;
                    const isExpanded = expandedDiscoveredTable === tName;
                    const isSelected = selectedDiscoveredTables.has(tName);
                    return (
                      <div key={i} className={`border rounded-md transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : ''}`} data-testid={`discovered-table-${i}`}>
                        <div className="flex items-center gap-3 p-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedDiscoveredTables);
                              if (checked) next.add(tName); else next.delete(tName);
                              setSelectedDiscoveredTables(next);
                            }}
                            data-testid={`checkbox-table-${i}`}
                          />
                          <button
                            onClick={() => setExpandedDiscoveredTable(isExpanded ? null : tName)}
                            className="flex items-center gap-1 text-muted-foreground"
                            data-testid={`button-expand-table-${i}`}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className="font-mono text-sm font-medium">{tName}</span>
                            <span className="text-xs text-muted-foreground mr-2">
                              ({t.type === 'view' ? 'عرض' : 'جدول'})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{t.columnsCount} عمود</span>
                            <span>{(t.rows || 0).toLocaleString()} سجل</span>
                            {t.primaryKey && (
                              <Badge variant="outline" className="text-xs"><Key className="w-3 h-3 ml-1" />{t.primaryKey}</Badge>
                            )}
                          </div>
                        </div>
                        {isExpanded && t.columns && t.columns.length > 0 && (
                          <div className="border-t p-2">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-muted-foreground text-xs py-1">العمود</TableHead>
                                  <TableHead className="text-muted-foreground text-xs py-1">النوع</TableHead>
                                  <TableHead className="text-muted-foreground text-xs py-1">الخصائص</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {t.columns.map((col: any, ci: number) => (
                                  <TableRow key={ci}>
                                    <TableCell className="font-mono text-xs py-1">{col.name}</TableCell>
                                    <TableCell className="text-xs py-1 text-muted-foreground">{col.type}</TableCell>
                                    <TableCell className="py-1">
                                      <div className="flex gap-1 flex-wrap">
                                        {col.isPrimaryKey && <Badge variant="outline" className="text-[10px] px-1 py-0">PK</Badge>}
                                        {col.isForeignKey && <Badge variant="outline" className="text-[10px] px-1 py-0">FK</Badge>}
                                        {!col.nullable && <Badge variant="outline" className="text-[10px] px-1 py-0">NOT NULL</Badge>}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DialogBody>
            <DialogFooter className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setIsDiscoverDialogOpen(false)} data-testid="button-close-discover">إغلاق</Button>
              {discoveredTablesData.length > 0 && (
                <Button
                  disabled={selectedDiscoveredTables.size === 0 || registerDiscoveredAssetsMutation.isPending}
                  onClick={() => {
                    const selected = discoveredTablesData.filter(t => selectedDiscoveredTables.has(t.name));
                    registerDiscoveredAssetsMutation.mutate({
                      tables: selected,
                      connectionId: discoveryMeta.connectionId,
                      systemId: discoveryMeta.systemId,
                      databaseName: discoveryMeta.databaseName,
                    });
                  }}
                  data-testid="button-register-discovered"
                >
                  {registerDiscoveredAssetsMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري التسجيل...</>
                  ) : (
                    <><Download className="w-4 h-4 ml-2" />تسجيل {selectedDiscoveredTables.size} كأصول بيانات</>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isLineageDialogOpen} onOpenChange={(v) => { if (!v) { setIsLineageDialogOpen(false); setEditingLineage(null); } }}>
          <DialogContent className="bg-[hsl(222_47%_13%)] border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-[hsl(43_74%_66%)]" />{editingLineage ? 'تعديل مسار البيانات' : 'إضافة مسار بيانات'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <label className="text-xs text-white/40 block mb-1">اسم المسار</label>
                <Input value={lineageForm.name} onChange={e => setLineageForm(p => ({ ...p, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" data-testid="input-lineage-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 block mb-1">نوع المصدر</label>
                  <Select value={lineageForm.sourceType} onValueChange={v => setLineageForm(p => ({ ...p, sourceType: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">نوع الهدف</label>
                  <Select value={lineageForm.targetType} onValueChange={v => setLineageForm(p => ({ ...p, targetType: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {lineageForm.sourceType === 'database' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">اتصال المصدر</label>
                    <Select value={lineageForm.sourceConnectionId} onValueChange={v => setLineageForm(p => ({ ...p, sourceConnectionId: v }))}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{connections.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.connectionNameAr || c.connectionName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">جدول المصدر (اختياري)</label>
                    <Select value={lineageForm.sourceTableId} onValueChange={v => setLineageForm(p => ({ ...p, sourceTableId: v }))}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{allDiscoveredTables.filter((t: any) => t.connectionId?.toString() === lineageForm.sourceConnectionId).map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.tableName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {lineageForm.targetType === 'database' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">اتصال الهدف</label>
                    <Select value={lineageForm.targetConnectionId} onValueChange={v => setLineageForm(p => ({ ...p, targetConnectionId: v }))}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{connections.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.connectionNameAr || c.connectionName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">جدول الهدف (اختياري)</label>
                    <Select value={lineageForm.targetTableId} onValueChange={v => setLineageForm(p => ({ ...p, targetTableId: v }))}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{allDiscoveredTables.filter((t: any) => t.connectionId?.toString() === lineageForm.targetConnectionId).map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.tableName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 block mb-1">نوع التحويل</label>
                  <Select value={lineageForm.transformationType} onValueChange={v => setLineageForm(p => ({ ...p, transformationType: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TRANSFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">التكرار</label>
                  <Select value={lineageForm.frequency} onValueChange={v => setLineageForm(p => ({ ...p, frequency: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">فوري</SelectItem>
                      <SelectItem value="hourly">كل ساعة</SelectItem>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="weekly">أسبوعي</SelectItem>
                      <SelectItem value="monthly">شهري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">الاتجاه</label>
                <Select value={lineageForm.dataFlowDirection} onValueChange={v => setLineageForm(p => ({ ...p, dataFlowDirection: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upstream">↑ صعودي (Upstream)</SelectItem>
                    <SelectItem value="downstream">↓ نزولي (Downstream)</SelectItem>
                    <SelectItem value="bidirectional">↔ ثنائي (Bidirectional)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">منطق التحويل (اختياري)</label>
                <textarea
                  value={lineageForm.transformationLogic}
                  onChange={e => setLineageForm(p => ({ ...p, transformationLogic: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-white text-sm min-h-[60px] resize-none"
                  data-testid="input-lineage-logic"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsLineageDialogOpen(false)} className="text-white/50">إلغاء</Button>
              <LoadingButton
                onClick={handleSubmitLineage}
                loading={createLineageMutation.isPending || updateLineageMutation.isPending}
                className="btn-gold"
                data-testid="button-submit-lineage"
              >
                {editingLineage ? 'تحديث' : 'إضافة'}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog {...dialogProps} />
      </div>
    </DashboardLayout>
  );
}
