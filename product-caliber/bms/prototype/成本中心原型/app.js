import Dexie from "dexie";
import { createApp, h, ref } from "vue";
import { ElConfigProvider, ElDatePicker } from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn.mjs";
import "element-plus/dist/index.css";

const sampleFiles = [
  { id: "df-delivery", name: "台湾端派送 （东风.xlsx", supplier: "东风", board: "派送成本", sheets: 24, size: "19.8 MB", defaultSheet: "黑貓" },
  { id: "t-cat", name: "台湾端派送 （宅配通.xlsx", supplier: "宅配通", board: "派送成本", sheets: 1, size: "5.6 MB", defaultSheet: "5月明細" },
  { id: "shunsheng", name: "台湾端派送 （顺盛.xlsx", supplier: "顺盛", board: "派送成本", sheets: 1, size: "1.9 MB", defaultSheet: "Sheet1" },
  { id: "df-clearance", name: "海快清关（东风.xls", supplier: "东风", board: "清关成本", sheets: 12, size: "22.7 MB", defaultSheet: "清關費" },
  { id: "fuguang", name: "海快清关（福广.xlsx", supplier: "福广", board: "清关成本", sheets: 9, size: "4.9 MB", defaultSheet: "稅金明細" },
  { id: "lianduo", name: "海快船公司（联多.xlsx", supplier: "联多", board: "海运成本", sheets: 2, size: "110 KB", defaultSheet: "sheet1" },
  { id: "libao", name: "空运头程（力宝.xls", supplier: "力宝", board: "空运成本", sheets: 3, size: "89 KB", defaultSheet: "对帐单" },
  { id: "truck", name: "海快租车（仓库送船公司.xlsx", supplier: "仓库送船公司", board: "租车成本", sheets: 1, size: "5.1 MB", defaultSheet: "租车" },
  { id: "mover", name: "海快（深圳搬运工.xlsx", supplier: "深圳搬运工", board: "租车成本", sheets: 1, size: "813 KB", defaultSheet: "Sheet1" }
];

const suppliers = [
  { code: "SUP-DF", name: "东风", boards: ["派送", "清关"], cycle: "月", current: "2026-06-01 至 2026-06-30", currency: "TWD", bills: 3, pending: "486,320.000 TWD", settled: "1,286,550.000 TWD", state: "启用", updated: "2026-07-16 18:20" },
  { code: "SUP-ZPT", name: "宅配通", boards: ["派送"], cycle: "月", current: "2026-06-01 至 2026-06-30", currency: "TWD", bills: 1, pending: "0.000 TWD", settled: "218,760.000 TWD", state: "启用", updated: "2026-07-15 11:42" },
  { code: "SUP-SS", name: "顺盛", boards: ["派送"], cycle: "月", current: "2026-06-01 至 2026-06-30", currency: "TWD", bills: 1, pending: "94,286.000 TWD", settled: "0.000 TWD", state: "启用", updated: "2026-07-14 09:31" },
  { code: "SUP-FG", name: "福广", boards: ["清关"], cycle: "半月", current: "2026-07-01 至 2026-07-15", currency: "TWD", bills: 1, pending: "173,680.000 TWD", settled: "0.000 TWD", state: "启用", updated: "2026-07-16 14:06" },
  { code: "SUP-LD", name: "联多", boards: ["海运"], cycle: "不固定", current: "2026-06-12 至 2026-06-28", currency: "CNY", bills: 1, pending: "87,540.000 CNY", settled: "0.000 CNY", state: "启用", updated: "2026-07-13 16:55" },
  { code: "SUP-LB", name: "力宝", boards: ["空运"], cycle: "周", current: "2026-07-06 至 2026-07-12", currency: "CNY", bills: 1, pending: "0.000 CNY", settled: "61,280.000 CNY", state: "启用", updated: "2026-07-12 20:16" },
  { code: "SUP-BY", name: "深圳搬运工", boards: ["租车"], cycle: "月", current: "2026-06-01 至 2026-06-30", currency: "CNY", bills: 0, pending: "0.000 CNY", settled: "0.000 CNY", state: "停用", updated: "2026-07-03 10:25" }
];

const bills = [
  { id: "APB-SUP-DF-20260601-8F1A2C", supplier: "东风", board: "派送成本", period: "2026-06-01 至 2026-06-30", amount: "486,320.000", currency: "TWD", settled: "120,000.000", state: "待结清", rows: 1864, direct: 1532, indirect: 332, unresolved: 18, file: "台湾端派送 （东风.xlsx", created: "2026-07-16 18:20" },
  { id: "APB-SUP-DF-20260601-42DC91", supplier: "东风", board: "清关成本", period: "2026-06-01 至 2026-06-30", amount: "327,860.000", currency: "TWD", settled: "327,860.000", state: "已结清", rows: 728, direct: 581, indirect: 147, unresolved: 0, file: "海快清关（东风.xls", created: "2026-07-15 15:08" },
  { id: "APB-SUP-ZPT-20260601-66A3E1", supplier: "宅配通", board: "派送成本", period: "2026-06-01 至 2026-06-30", amount: "218,760.000", currency: "TWD", settled: "218,760.000", state: "已结清", rows: 942, direct: 910, indirect: 32, unresolved: 0, file: "台湾端派送 （宅配通.xlsx", created: "2026-07-15 11:42" },
  { id: "APB-SUP-SS-20260601-A7382B", supplier: "顺盛", board: "派送成本", period: "2026-06-01 至 2026-06-30", amount: "94,286.000", currency: "TWD", settled: "0.000", state: "待结清", rows: 326, direct: 312, indirect: 14, unresolved: 6, file: "台湾端派送 （顺盛.xlsx", created: "2026-07-14 09:31" },
  { id: "APB-SUP-FG-20260701-11F9C4", supplier: "福广", board: "清关成本", period: "2026-07-01 至 2026-07-15", amount: "173,680.000", currency: "TWD", settled: "0.000", state: "待结清", rows: 463, direct: 398, indirect: 65, unresolved: 12, file: "海快清关（福广.xlsx", created: "2026-07-16 14:06" },
  { id: "APB-SUP-LD-20260612-C182A7", supplier: "联多", board: "海运成本", period: "2026-06-12 至 2026-06-28", amount: "87,540.000", currency: "CNY", settled: "0.000", state: "待结清", rows: 78, direct: 12, indirect: 66, unresolved: 3, file: "海快船公司（联多.xlsx", created: "2026-07-13 16:55" },
  { id: "APB-SUP-LB-20260706-FF0201", supplier: "力宝", board: "空运成本", period: "2026-07-06 至 2026-07-12", amount: "61,280.000", currency: "CNY", settled: "61,280.000", state: "已结清", rows: 116, direct: 28, indirect: 88, unresolved: 0, file: "空运头程（力宝.xls", created: "2026-07-12 20:16" },
  { id: "APB-SUP-TRK-20260601-20DD6A", supplier: "仓库送船公司", board: "租车成本", period: "2026-06-01 至 2026-06-30", amount: "39,600.000", currency: "CNY", settled: "0.000", state: "待结清", rows: 26, direct: 0, indirect: 26, unresolved: 0, file: "海快租车（仓库送船公司.xlsx", created: "2026-07-11 17:43" }
];

const costs = [
  { id: "COST-260716-00871", bill: bills[0].id, supplier: "东风", board: "派送", raw: "運費", fee: "派送费", keyType: "追踪号", key: "DF26061088319", amount: "1,260.000", currency: "TWD", type: "直接成本", target: "尾程包裹 TP-TW-88319", status: "已归属" },
  { id: "COST-260716-00872", bill: bills[0].id, supplier: "东风", board: "派送", raw: "超才費", fee: "超才费", keyType: "追踪号", key: "DF26061088319", amount: "320.000", currency: "TWD", type: "直接成本", target: "尾程包裹 TP-TW-88319", status: "已归属" },
  { id: "COST-260716-00873", bill: bills[0].id, supplier: "东风", board: "派送", raw: "車趟費", fee: "车趟费", keyType: "货柜号", key: "TLLU5088210", amount: "18,600.000", currency: "TWD", type: "间接成本", target: "POOL-DEL-2606-03", status: "待分摊" },
  { id: "COST-260715-00428", bill: bills[1].id, supplier: "东风", board: "清关", raw: "稅金", fee: "进口税费", keyType: "税单号", key: "TW-TAX-260619-0318", amount: "7,280.000", currency: "TWD", type: "直接成本", target: "业务订单 SO-OG0370-61428", status: "已归属" },
  { id: "COST-260716-00613", bill: bills[4].id, supplier: "福广", board: "清关", raw: "萬海倉租", fee: "清关仓租", keyType: "柜号", key: "SEGU6320198", amount: "23,400.000", currency: "TWD", type: "间接成本", target: "POOL-CLR-2607-01", status: "已分摊" },
  { id: "COST-260713-00136", bill: bills[5].id, supplier: "联多", board: "海运", raw: "海運費", fee: "海运费", keyType: "提单号", key: "SZTW26061208", amount: "42,800.000", currency: "CNY", type: "间接成本", target: "POOL-SEA-2606-02", status: "已分摊" },
  { id: "COST-260712-00081", bill: bills[6].id, supplier: "力宝", board: "空运", raw: "中港段費", fee: "中港运输费", keyType: "提单号", key: "160-98562041", amount: "13,680.000", currency: "CNY", type: "间接成本", target: "POOL-AIR-2607-02", status: "待分摊" },
  { id: "COST-260711-00019", bill: bills[7].id, supplier: "仓库送船公司", board: "租车", raw: "9.6米車", fee: "租车费", keyType: "无关键单号", key: "-", amount: "9,800.000", currency: "CNY", type: "间接成本", target: "待选择分摊池", status: "待人工确认" }
];

const pools = [
  { id: "POOL-DEL-2606-03", name: "东风 6 月车趟及拖袋费用", supplier: "东风", fee: "车趟费", scope: "台湾海快 / TW / 2026-06", amount: "48,800.000 TWD", orders: 386, factor: "订单计费重", fallback: "订单包裹数", status: "待分摊", version: "-" },
  { id: "POOL-CLR-2607-01", name: "福广 7 月上半月仓租", supplier: "福广", fee: "清关仓租", scope: "柜号 SEGU6320198", amount: "23,400.000 TWD", orders: 164, factor: "占用量 × 仓储天数", fallback: "订单计费重", status: "已分摊", version: "V2" },
  { id: "POOL-SEA-2606-02", name: "联多 SZTW26061208 海运费", supplier: "联多", fee: "海运费", scope: "提单 SZTW26061208 / 2 柜", amount: "71,800.000 CNY", orders: 218, factor: "订单计费吨", fallback: "订单体积", status: "已分摊", version: "V1" },
  { id: "POOL-AIR-2607-02", name: "力宝 160-98562041 空运费用", supplier: "力宝", fee: "中港运输费", scope: "主运单 160-98562041", amount: "18,600.000 CNY", orders: 94, factor: "空运计费重", fallback: "订单实重", status: "待分摊", version: "-" },
  { id: "POOL-TRK-2606-01", name: "6 月仓库送船租车费用", supplier: "仓库送船公司", fee: "租车费", scope: "深圳仓 / 6 月 / 海快线路", amount: "39,600.000 CNY", orders: 612, factor: "订单计费重", fallback: "订单数", status: "待人工确认", version: "-" }
];

const fees = [
  { code: "COST-DEL-001", name: "派送费", board: "派送成本", definition: "供应商完成尾程包裹配送所收取的基础运费，不含超材、偏远等附加收费。", remark: "按尾程运单归属。", rules: 3, references: 1532, status: "启用", updatedAt: "2026-07-10 16:20" },
  { code: "COST-DEL-006", name: "超才费", board: "派送成本", definition: "尾程包裹超过供应商尺寸或材积限制后加收的费用。", remark: "供应商也可能写作超大或材积附加。", rules: 1, references: 186, status: "启用", updatedAt: "2026-07-08 11:35" },
  { code: "COST-CLR-002", name: "进口税费", board: "清关成本", definition: "货物进口申报产生并由供应商代垫或代收的关税、进口税等税款。", remark: "不得与报关服务费合并。", rules: 2, references: 398, status: "启用", updatedAt: "2026-07-12 09:18" },
  { code: "COST-CLR-008", name: "清关仓租", board: "清关成本", definition: "货物在清关或查验期间占用监管仓、机场仓产生的仓储费用。", remark: "通常作为间接成本按业务订单分摊。", rules: 4, references: 65, status: "启用", updatedAt: "2026-07-11 14:06" },
  { code: "COST-SEA-001", name: "海运费", board: "海运成本", definition: "供应商承运海运主程产生的基础运输费用。", remark: "与空运板块的同名费项分别维护。", rules: 2, references: 66, status: "启用", updatedAt: "2026-07-06 17:42" },
  { code: "COST-AIR-003", name: "中港运输费", board: "空运成本", definition: "空运货物由内地集货点运往香港机场或操作仓产生的运输费用。", remark: "按主运单或账期进入分摊池。", rules: 1, references: 88, status: "启用", updatedAt: "2026-07-05 10:27" },
  { code: "COST-TRK-001", name: "租车费", board: "租车成本", definition: "因仓库提送、码头交接或履约调拨而租用车辆产生的费用。", remark: "车型差异通过供应商映射保留。", rules: 2, references: 26, status: "启用", updatedAt: "2026-07-03 10:25" }
];

const feeAliases = [
  { id: "ALIAS-DEL-001", supplier: "东风", board: "派送成本", rawName: "運費", feeCode: "COST-DEL-001", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 3, confirmer: "谭清辉", confirmedAt: "2026-07-10 16:20", note: "基础派送费用" },
  { id: "ALIAS-DEL-002", supplier: "宅配通", board: "派送成本", rawName: "本款", feeCode: "COST-DEL-001", structure: "宅配通派送明细", sheet: "5月明細", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-09 10:12", note: "账单中的基础运费列" },
  { id: "ALIAS-DEL-003", supplier: "顺盛", board: "派送成本", rawName: "宅配運費", feeCode: "COST-DEL-001", structure: "顺盛派送账单", sheet: "Sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 15:40", note: "" },
  { id: "ALIAS-DEL-004", supplier: "东风", board: "派送成本", rawName: "超才費", feeCode: "COST-DEL-006", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-08 11:35", note: "超过材积限制" },
  { id: "ALIAS-DEL-005", supplier: "宅配通", board: "派送成本", rawName: "超大", feeCode: "COST-DEL-006", structure: "宅配通派送明细", sheet: "5月明細", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-07 09:22", note: "" },
  { id: "ALIAS-DEL-006", supplier: "顺盛", board: "派送成本", rawName: "材积附加", feeCode: "COST-DEL-006", structure: "顺盛派送账单", sheet: "Sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-07 09:28", note: "" },
  { id: "ALIAS-CLR-001", supplier: "东风", board: "清关成本", rawName: "稅金", feeCode: "COST-CLR-002", structure: "东风清关账单", sheet: "清關費", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-12 09:18", note: "进口税款" },
  { id: "ALIAS-CLR-002", supplier: "福广", board: "清关成本", rawName: "税费", feeCode: "COST-CLR-002", structure: "福广请款单", sheet: "稅金明細", status: "启用", version: 3, confirmer: "谭清辉", confirmedAt: "2026-07-12 09:16", note: "" },
  { id: "ALIAS-CLR-003", supplier: "福广", board: "清关成本", rawName: "關稅", feeCode: "COST-CLR-002", structure: "福广请款单", sheet: "規費請款單", status: "停用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-06-30 17:05", note: "供应商已拆分到税费字段" },
  { id: "ALIAS-CLR-004", supplier: "东风", board: "清关成本", rawName: "倉租", feeCode: "COST-CLR-008", structure: "东风清关账单", sheet: "清關費", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-11 14:06", note: "" },
  { id: "ALIAS-CLR-005", supplier: "福广", board: "清关成本", rawName: "萬海倉租", feeCode: "COST-CLR-008", structure: "福广请款单", sheet: "請款單(總)", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-11 13:58", note: "万海码头仓租" },
  { id: "ALIAS-CLR-006", supplier: "福广", board: "清关成本", rawName: "遠雄倉租", feeCode: "COST-CLR-008", structure: "福广请款单", sheet: "請款單(總)", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-11 13:59", note: "远雄机场仓租" },
  { id: "ALIAS-SEA-001", supplier: "联多", board: "海运成本", rawName: "海運費", feeCode: "COST-SEA-001", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-06 17:42", note: "" },
  { id: "ALIAS-SEA-002", supplier: "联多", board: "海运成本", rawName: "普貨海運費", feeCode: "COST-SEA-001", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-06 17:43", note: "普货主程运费" },
  { id: "ALIAS-AIR-001", supplier: "力宝", board: "空运成本", rawName: "中港段費", feeCode: "COST-AIR-003", structure: "力宝空运账单", sheet: "对帐单", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:27", note: "" },
  { id: "ALIAS-AIR-002", supplier: "力宝", board: "空运成本", rawName: "中港車費", feeCode: "COST-AIR-003", structure: "力宝空运账单", sheet: "费用明细", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:28", note: "" },
  { id: "ALIAS-TRK-001", supplier: "仓库送船公司", board: "租车成本", rawName: "9.6米車", feeCode: "COST-TRK-001", structure: "租车月结单", sheet: "租车", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:25", note: "" },
  { id: "ALIAS-TRK-002", supplier: "仓库送船公司", board: "租车成本", rawName: "17.5米車", feeCode: "COST-TRK-001", structure: "租车月结单", sheet: "租车", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:25", note: "" },
  { id: "ALIAS-TRK-003", supplier: "仓库送船公司", board: "租车成本", rawName: "70方車", feeCode: "COST-TRK-001", structure: "租车月结单", sheet: "租车", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:25", note: "" }
];

const state = { view: "overview", wizardStep: 1, selectedFile: "df-delivery", selectedSheet: "黑貓", costPeriodStart: "2026-06-01", costPeriodEnd: "2026-06-30", supplierPeriodStart: "2026-06-01", supplierPeriodEnd: "2026-07-16", billPeriodStart: "2026-06-01", billPeriodEnd: "2026-07-16", profitPeriodStart: "2026-06-01", profitPeriodEnd: "2026-06-30", billFilter: "全部", poolFilter: "全部", feeTab: "index", feeKeyword: "", feeBoard: "", feeStatus: "", aliasKeyword: "", aliasSupplier: "", aliasBoard: "", aliasStatus: "", sidebarOpen: false, pendingAction: null };
const routeNames = { overview: "成本总览", suppliers: "供应商管理", bills: "成本账单", pool: "成本池", allocation: "间接成本分摊", profit: "利润分析", fees: "成本费项索引" };
const dateRangePickerApps = new Map();

const prototypeDb = new Dexie("BmsCostCenterPrototype");
prototypeDb.version(1).stores({
  sampleFiles: "&id,supplier,board",
  suppliers: "&code,name,state,*boards",
  bills: "&id,supplier,board,state,created",
  costs: "&id,bill,supplier,board,type,status,key",
  pools: "&id,supplier,fee,status",
  fees: "&code,board,status",
  operationLogs: "++id,entityType,entityId,action,createdAt",
  settings: "&key"
});
prototypeDb.version(2).stores({
  feeAliases: "&id,supplier,board,rawName,feeCode,status,[supplier+board+rawName]"
});

const cloneData = value => JSON.parse(JSON.stringify(value));
const initialData = {
  sampleFiles: cloneData(sampleFiles),
  suppliers: cloneData(suppliers),
  bills: cloneData(bills),
  costs: cloneData(costs),
  pools: cloneData(pools),
  fees: cloneData(fees),
  feeAliases: cloneData(feeAliases)
};
const dataTableNames = Object.keys(initialData);

function replaceArray(target, source) {
  target.splice(0, target.length, ...cloneData(source));
}

async function seedPrototypeDatabase(force = false) {
  await prototypeDb.transaction("rw", prototypeDb.tables, async () => {
    if (force) await Promise.all(prototypeDb.tables.map(table => table.clear()));
    for (const tableName of dataTableNames) await prototypeDb.table(tableName).bulkPut(cloneData(initialData[tableName]));
    await prototypeDb.settings.put({ key: "seedVersion", value: 2 });
    await prototypeDb.operationLogs.add({ entityType: "系统", entityId: "成本中心原型", action: force ? "恢复初始模拟数据" : "初始化模拟数据", createdAt: new Date().toISOString() });
  });
}

async function initializePrototypeDatabase() {
  await prototypeDb.open();
  const seedState = await prototypeDb.settings.get("seedVersion");
  if (!seedState) await seedPrototypeDatabase();
  else if (Number(seedState.value) < 2) {
    await prototypeDb.transaction("rw", [prototypeDb.fees, prototypeDb.feeAliases, prototypeDb.settings], async () => {
      await prototypeDb.fees.bulkPut(cloneData(fees));
      await prototypeDb.feeAliases.bulkPut(cloneData(feeAliases));
      await prototypeDb.settings.put({ key: "seedVersion", value: 2 });
    });
  }
  await hydratePrototypeData();
}

async function hydratePrototypeData() {
  for (const tableName of dataTableNames) replaceArray(window[tableName] || ({ sampleFiles, suppliers, bills, costs, pools, fees, feeAliases })[tableName], await prototypeDb.table(tableName).toArray());
}

async function recordOperation(entityType, entityId, action, detail = "") {
  await prototypeDb.operationLogs.add({ entityType, entityId, action, detail, createdAt: new Date().toISOString() });
}

function makeId(prefix) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `${prefix}-${date}-${Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
}

const icon = (name) => `<i data-lucide="${name}"></i>`;
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const money = (value, currency) => `${value} ${currency}`;
const statusClass = (value) => {
  if (["已结清", "已归属", "已分摊", "启用", "成本已齐"].includes(value)) return "success";
  if (["待结清", "待分摊", "待人工确认", "成本未齐"].includes(value)) return "warning";
  if (["失败", "停用", "无法匹配"].includes(value)) return "danger";
  return "info";
};
const tag = (text, color = "gray") => `<span class="tag ${color}">${text}</span>`;
const status = (text) => `<span class="status ${statusClass(text)}">${text}</span>`;

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function pageHeader(title, subtitle, actions = "") {
  return `<div class="page-header"><div><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p></div><div class="header-actions">${actions}</div></div>`;
}

function tableFooter(total) {
  return `<div class="table-footer"><span>共 ${total} 条 · 每页 20 条</span><div class="pager"><button class="page-btn">‹</button><button class="page-btn active">1</button><button class="page-btn">2</button><button class="page-btn">›</button></div></div>`;
}

function renderOverview() {
  return `${pageHeader("成本总览", "供应商收费、成本归属、结清进度与订单利润的统一工作台", `<button class="btn primary" data-view="pool">${icon("database")}处理成本池</button>`)}
    <div class="kpi-grid">
      <div class="kpi-card"><span class="kpi-icon">${icon("files")}</span><div class="kpi-label">本月成本账单</div><div class="kpi-value">8<small>份</small></div><div class="kpi-extra">较上月 +2 份</div></div>
      <div class="kpi-card warning"><span class="kpi-icon">${icon("circle-dollar-sign")}</span><div class="kpi-label">待结清金额</div><div class="kpi-value">714.1<small>千 CNY</small></div><div class="kpi-extra">TWD 已换算，仅供总览</div></div>
      <div class="kpi-card info"><span class="kpi-icon">${icon("git-branch")}</span><div class="kpi-label">待归属成本</div><div class="kpi-value">23<small>笔</small></div><div class="kpi-extra">18 笔待匹配 · 5 笔待确认</div></div>
      <div class="kpi-card danger"><span class="kpi-icon">${icon("split")}</span><div class="kpi-label">待分摊金额</div><div class="kpi-value">106.8<small>千 CNY</small></div><div class="kpi-extra">5 个分摊池待处理</div></div>
      <div class="kpi-card success"><span class="kpi-icon">${icon("badge-check")}</span><div class="kpi-label">成本已齐订单</div><div class="kpi-value">82.6<small>%</small></div><div class="kpi-extra">1,946 / 2,356 单</div></div>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><span class="panel-title">五大成本板块</span><div class="panel-tools">按财务本位币人民币折算</div></div><div class="panel-body"><div class="cost-bars">
        ${[["派送成本",72,"1,286,420.000",""],["清关成本",54,"962,850.000","green"],["海运成本",41,"731,280.000","blue"],["空运成本",28,"496,300.000","orange"],["租车成本",12,"218,640.000","red"]].map(([n,w,v,c])=>`<div class="cost-bar-row"><span>${n}</span><div class="bar-track"><div class="bar-fill ${c}" style="width:${w}%"></div></div><span class="bar-value">${v} CNY</span></div>`).join("")}
      </div></div></section>
      <section class="panel"><div class="panel-head"><span class="panel-title">待处理事项</span><button class="btn small" data-view="pool">全部处理</button></div><div class="panel-body"><div class="todo-list">
        <div class="todo-item" data-view="bills"><span class="todo-icon danger">${icon("file-x-2")}</span><div><div class="todo-name">导入失败</div><div class="todo-desc">字段格式或金额合计异常</div></div><strong class="todo-count">2</strong></div>
        <div class="todo-item" data-view="pool"><span class="todo-icon">${icon("link-2-off")}</span><div><div class="todo-name">待人工匹配</div><div class="todo-desc">关键单号未命中业务对象</div></div><strong class="todo-count">18</strong></div>
        <div class="todo-item" data-view="allocation"><span class="todo-icon info">${icon("split")}</span><div><div class="todo-name">待执行分摊</div><div class="todo-desc">范围与因子已确认</div></div><strong class="todo-count">4</strong></div>
        <div class="todo-item" data-view="profit"><span class="todo-icon">${icon("badge-alert")}</span><div><div class="todo-name">成本未齐订单</div><div class="todo-desc">影响实际利润确认</div></div><strong class="todo-count">410</strong></div>
      </div></div></section>
    </div>
    <section class="panel"><div class="panel-head"><span class="panel-title">最近供应商账单</span><button class="btn small" data-view="bills">查看全部 ${icon("arrow-right")}</button></div>${billTable(bills.slice(0,5), false)}</section>`;
}

function renderSuppliers() {
  return `${pageHeader("供应商管理", "维护成本账期、适用成本板块及按币种分桶的账单金额", `<button class="btn">${icon("download")}导出</button><button class="btn primary" data-action="new-supplier">${icon("plus")}新增供应商财务档案</button>`)}
  <div class="filter-panel"><div class="filter-grid">
    <div class="field"><label>供应商</label><input class="input" placeholder="供应商编码或名称"></div>
    <div class="field"><label>成本板块</label><select class="select"><option>全部板块</option><option>派送成本</option><option>清关成本</option><option>海运成本</option><option>空运成本</option><option>租车成本</option></select></div>
    <div class="field"><label>成本账期类型</label><select class="select"><option>全部类型</option><option>周</option><option>半月</option><option>月</option><option>自然天</option><option>不固定</option></select></div>
    <div class="field"><label>状态</label><select class="select"><option>全部状态</option><option>启用</option><option>停用</option></select></div>
    <div class="field"><label>成本账期范围</label><div id="supplier-period-range" class="date-range-control"></div></div>
    <div class="filter-actions"><button class="btn primary">${icon("search")}查询</button><button class="btn">${icon("rotate-ccw")}重置</button></div>
  </div></div>
  <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>供应商编码</th><th>供应商名称</th><th>适用成本板块</th><th>账期类型</th><th>当前成本账期</th><th>默认币种</th><th>成本账单</th><th>待结清金额</th><th>已结清金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${suppliers.map(s=>`<tr><td class="link" data-action="open-supplier" data-id="${s.code}">${s.code}</td><td class="strong">${s.name}</td><td>${s.boards.map((b,i)=>tag(b,["purple","blue","green"][i%3])).join("")}</td><td>${s.cycle}</td><td>${s.current}</td><td>${s.currency}</td><td class="num">${s.bills}</td><td class="num">${s.pending}</td><td class="num">${s.settled}</td><td>${status(s.state)}</td><td><button class="btn small" data-action="open-supplier" data-id="${s.code}">详情</button></td></tr>`).join("")}
  </tbody></table></div>${tableFooter(suppliers.length)}</section>`;
}

function billTable(rows, selectable = true) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${selectable?"<th><input class=\"row-check\" type=\"checkbox\"></th>":""}<th>成本账单编号</th><th>供应商</th><th>成本板块</th><th>实际成本账期</th><th>账单金额</th><th>已结清金额</th><th>状态</th><th>成本明细</th><th>待处理</th><th>导入时间</th><th>操作</th></tr></thead><tbody>${rows.map(b=>`<tr>${selectable?"<td><input class=\"row-check\" type=\"checkbox\"></td>":""}<td class="link mono" data-action="open-bill" data-id="${b.id}">${b.id}</td><td>${b.supplier}</td><td>${tag(b.board,b.board.includes("清关")?"green":b.board.includes("海运")?"blue":b.board.includes("空运")?"orange":"purple")}</td><td>${b.period}</td><td class="num strong">${money(b.amount,b.currency)}</td><td class="num">${money(b.settled,b.currency)}</td><td>${status(b.state)}</td><td class="num">${b.rows}</td><td>${b.unresolved?tag(`${b.unresolved} 项`,"orange"):"-"}</td><td>${b.created}</td><td><button class="btn small" data-action="open-bill" data-id="${b.id}">详情</button>${b.state==="待结清"?`<button class="btn small" data-action="settle-bill" data-id="${b.id}">登记结清</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderBills() {
  const filtered = state.billFilter === "全部" ? bills : bills.filter(b=>b.state===state.billFilter);
  return `${pageHeader("成本账单", "成本账单即供应商账单，仅登记待结清或已结清状态", `<button class="btn primary" data-action="open-import">${icon("file-up")}导入供应商账单</button>`)}
    <div class="filter-panel"><div class="filter-grid">
      <div class="field"><label>成本账单编号</label><input class="input" placeholder="输入 APB 编号"></div><div class="field"><label>供应商</label><select class="select"><option>全部供应商</option>${suppliers.filter(s=>s.state==="启用").map(s=>`<option>${s.name}</option>`).join("")}</select></div><div class="field"><label>成本板块</label><select class="select"><option>全部板块</option><option>派送成本</option><option>清关成本</option><option>海运成本</option><option>空运成本</option><option>租车成本</option></select></div><div class="field"><label>实际成本账期</label><div id="bill-period-range" class="date-range-control"></div></div>
      <div class="field"><label>结清状态</label><div class="segmented">${["全部","待结清","已结清"].map(v=>`<button class="${state.billFilter===v?"active":""}" data-action="bill-filter" data-value="${v}">${v}</button>`).join("")}</div></div><div class="filter-actions"><button class="btn primary">${icon("search")}查询</button><button class="btn">${icon("rotate-ccw")}重置</button></div>
    </div></div><section class="panel">${billTable(filtered)}${tableFooter(filtered.length)}</section>`;
}

function wizardSteps() {
  return `<div class="steps">${[[1,"选择供应商并上传文件"],[2,"确认字段与费项配对"],[3,"预览并确认导入"]].map(([n,t])=>`<div class="step ${state.wizardStep===n?"active":state.wizardStep>n?"done":""}"><span class="step-index">${state.wizardStep>n?icon("check"):n}</span><span>${t}</span></div>`).join("")}</div>`;
}

function renderImportWizard() {
  return `<div class="wizard">${wizardSteps()}<div class="wizard-body">${state.wizardStep===1?wizardOne():state.wizardStep===2?wizardTwo():wizardThree()}</div>
  <div class="wizard-actions"><div>${state.wizardStep>1?`<button class="btn" data-action="wizard-back">${icon("arrow-left")}上一步</button>`:""}</div><div>${state.wizardStep<3?`<button class="btn primary" data-action="wizard-next">下一步${icon("arrow-right")}</button>`:`<button class="btn primary" data-action="confirm-import">${icon("check")}确认导入</button>`}</div></div></div>`;
}

function wizardOne() {
  const f = sampleFiles.find(x=>x.id===state.selectedFile);
  return `<div class="form-section"><div class="form-section-title">账单归属</div><div class="form-grid">
    <div class="field"><label class="required">供应商</label><select class="select" id="wizard-supplier"><option>${f.supplier}</option>${suppliers.filter(s=>s.name!==f.supplier&&s.state==="启用").map(s=>`<option>${s.name}</option>`).join("")}</select></div>
    <div class="field"><label class="required">成本板块</label><select class="select"><option>${f.board}</option><option>派送成本</option><option>清关成本</option><option>海运成本</option><option>空运成本</option><option>租车成本</option></select></div>
    <div class="field"><label class="required">默认币种</label><select class="select"><option>${["东风","福广","宅配通","顺盛"].includes(f.supplier)?"TWD":"CNY"}</option><option>CNY</option><option>TWD</option><option>USD</option></select></div>
    <div class="field"><label class="required">实际成本账期</label><div id="cost-period-range" class="date-range-control"></div></div><div class="field"><label class="required">导入时结清状态</label><select class="select"><option>待结清</option><option>已结清</option></select></div>
  </div></div><div class="form-section"><div class="form-section-title">上传原始账单</div><label class="drop-zone"><input type="file" accept=".xls,.xlsx" hidden><span class="drop-zone-inner">${icon("upload-cloud")}拖放 Excel 到此处，或点击选择本地文件</span></label>
  <div class="inline-note">以下文件来自“成本账单样本”目录。点击任一文件可直接带入演示，无需修改原始表头或列顺序。</div><div class="sample-files">${sampleFiles.map(x=>`<div class="sample-file ${x.id===state.selectedFile?"selected":""}" data-action="select-file" data-id="${x.id}"><span class="file-icon">${icon("file-spreadsheet")}</span><div><div class="file-name">${x.name}</div><div class="file-meta">${x.supplier} · ${x.board} · ${x.sheets} 个 sheet · ${x.size}</div></div><span class="file-check">${x.id===state.selectedFile?icon("circle-check"):""}</span></div>`).join("")}</div></div>`;
}

const sheetSets = {
  "df-delivery": [{n:"2026",r:"汇总核对"},{n:"帳單總表",r:"付款跟踪"},{n:"黑貓",r:"成本明细"},{n:"新竹",r:"成本明细"},{n:"大榮",r:"成本明细"},{n:"貼單拖袋費",r:"成本明细"},{n:"車趟費",r:"成本明细"},{n:"問題件",r:"异常凭证"}],
  "fuguang": [{n:"請款單(總)",r:"汇总核对"},{n:"稅金明細",r:"成本明细"},{n:"規費請款單",r:"成本明细"},{n:"EZ Way 明細",r:"辅助数据"},{n:"罰單",r:"异常费用"}],
  "lianduo": [{n:"sheet1",r:"成本明细"},{n:"sheet1 (2)",r:"成本明细"}],
  "libao": [{n:"对帐单",r:"成本明细"},{n:"核销报关货价格",r:"报价参考"},{n:"付款进度表",r:"付款跟踪"}]
};
function currentSheets() { const f=sampleFiles.find(x=>x.id===state.selectedFile); return sheetSets[state.selectedFile] || [{n:f.defaultSheet,r:"成本明细"}]; }

function wizardTwo() {
  const f=sampleFiles.find(x=>x.id===state.selectedFile); const sheets=currentSheets(); if(!sheets.some(s=>s.n===state.selectedSheet)) state.selectedSheet=sheets.find(s=>s.r==="成本明细")?.n||sheets[0].n;
  const mapping = f.board==="派送成本" ? [["追踪号","主关键单号 · 尾程运单号"],["转单号","辅助关键单号"],["運費","成本金额 · 派送费"],["超才費","成本金额 · 超才费"],["偏遠費","成本金额 · 偏远附加费"]] : f.board==="清关成本" ? [["主提单号","辅助关键单号"],["分提单号","主关键单号 · 分提单号"],["税单号","辅助关键单号"],["稅金","成本金额 · 进口税费"],["報關費","成本金额 · 报关费"]] : f.board==="海运成本" ? [["提单号","主关键单号 · 提单号"],["柜号","辅助关键单号"],["海運費","成本金额 · 海运费"],["拖櫃費","成本金额 · 拖柜费"]] : [["提单号","主关键单号 · 提单号"],["磅单号","辅助关键单号"],["中港段費","成本金额 · 中港运输费"],["提單費","成本金额 · 提单费"]];
  return `<div class="form-section"><div class="form-section-title">选择参与导入的工作表</div><div class="sheet-layout"><div class="sheet-list">${sheets.map(s=>`<button class="sheet-item ${s.n===state.selectedSheet?"active":""}" data-action="select-sheet" data-id="${s.n}">${icon(s.r==="成本明细"?"table-2":s.r.includes("汇总")?"sigma":"file-text")}<span>${s.n}</span><span class="sheet-role">${s.r}</span></button>`).join("")}</div><div class="mapping-area">
    <div class="mapping-note">系统已引用该供应商最近一次导入设置，并重新检查当前文件结构。当前 sheet 识别为“成本明细”，表头位于第 2 行，数据从第 3 行开始。</div>
    <div class="mapping-grid header"><span>原始字段</span><span></span><span>财务标准字段</span><span>识别结果</span></div>${mapping.map((m,i)=>`<div class="mapping-grid"><input class="input" value="${m[0]}"><span class="mapping-arrow">${icon("arrow-right")}</span><select class="select"><option>${m[1]}</option><option>不导入，仅保留原始值</option><option>辅助识别字段</option></select><span class="status ${i<2?"info":"success"}">${i<2?"历史快照":"自动识别"}</span></div>`).join("")}
    <div class="form-grid" style="margin-top:14px"><div class="field"><label>币种来源</label><select class="select"><option>本次导入默认币种</option><option>原始币种列</option></select></div><div class="field"><label>金额方向</label><select class="select"><option>正数表示应付成本</option><option>负数表示应付成本</option></select></div><div class="field"><label>识别方式</label><button class="btn" data-action="reanalyze">${icon("scan-search")}重新自动识别</button></div></div>
  </div></div></div>`;
}

function wizardThree() {
  const f=sampleFiles.find(x=>x.id===state.selectedFile); const twd=["东风","福广","宅配通","顺盛"].includes(f.supplier); const currency=twd?"TWD":"CNY";
  return `<div class="form-section"><div class="form-section-title">导入预览</div><div class="preview-summary"><div class="preview-metric"><span>原始数据行</span><strong>1,286</strong></div><div class="preview-metric"><span>排除汇总行</span><strong>18</strong></div><div class="preview-metric"><span>拟生成成本明细</span><strong>2,412</strong></div><div class="preview-metric"><span>直接 / 间接成本</span><strong>2,080 / 332</strong></div><div class="preview-metric"><span>拟入池金额</span><strong>486,320.000 ${currency}</strong></div></div>
  <div class="validation-list"><div class="validation-item ok">${icon("circle-check")}文件仅包含当前供应商“${f.supplier}”的数据</div><div class="validation-item ok">${icon("circle-check")}原始金额合计与拟入池金额合计一致</div><div class="validation-item warn">${icon("triangle-alert")}18 条关键单号未匹配，将以间接成本或待人工确认状态入池</div><div class="validation-item warn">${icon("copy")}发现 2 条疑似重复记录，已在下表标记，需财务确认后继续</div></div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>原始行</th><th>关键单号</th><th>供应商原始费项</th><th>常规成本费项</th><th>金额</th><th>成本类型建议</th><th>归属结果</th><th>校验</th></tr></thead><tbody>
  <tr><td>第 3 行</td><td>DF26061088319</td><td>運費</td><td>派送费</td><td class="num">1,260.000 ${currency}</td><td>${tag("直接成本","green")}</td><td>尾程包裹 TP-TW-88319</td><td>${status("已匹配")}</td></tr>
  <tr><td>第 3 行</td><td>DF26061088319</td><td>超才費</td><td>超才费</td><td class="num">320.000 ${currency}</td><td>${tag("直接成本","green")}</td><td>尾程包裹 TP-TW-88319</td><td>${status("已匹配")}</td></tr>
  <tr><td>第 28 行</td><td>TLLU5088210</td><td>車趟費</td><td>车趟费</td><td class="num">18,600.000 ${currency}</td><td>${tag("间接成本","orange")}</td><td>待选择分摊池</td><td>${tag("待确认","orange")}</td></tr>
  <tr><td>第 76 行</td><td>DF26060810211</td><td>運費</td><td>派送费</td><td class="num">860.000 ${currency}</td><td>${tag("直接成本","green")}</td><td>尾程包裹 TP-TW-10211</td><td>${tag("疑似重复","red")}</td></tr>
  </tbody></table></div></div>`;
}

function renderPool() {
  return `${pageHeader("成本池", "逐行查看已标准化成本，确认直接归属或进入唯一间接成本分摊池", `<button class="btn">${icon("plus")}补录成本</button><button class="btn primary" data-view="allocation">${icon("split")}处理待分摊</button>`)}
  <div class="kpi-grid"><div class="kpi-card"><div class="kpi-label">成本明细</div><div class="kpi-value">4,543<small>笔</small></div><div class="kpi-extra">来自 8 份供应商账单</div></div><div class="kpi-card success"><div class="kpi-label">直接成本</div><div class="kpi-value">3,773<small>笔</small></div><div class="kpi-extra">已归属 98.7%</div></div><div class="kpi-card warning"><div class="kpi-label">间接成本</div><div class="kpi-value">770<small>笔</small></div><div class="kpi-extra">待分摊 106,800.000 CNY</div></div><div class="kpi-card danger"><div class="kpi-label">待人工确认</div><div class="kpi-value">23<small>笔</small></div><div class="kpi-extra">单号关系或成本类型待确认</div></div><div class="kpi-card info"><div class="kpi-label">汇率待确认</div><div class="kpi-value">6<small>笔</small></div><div class="kpi-extra">暂不进入人民币利润合计</div></div></div>
  <div class="filter-panel"><div class="filter-grid"><div class="field"><label>成本明细编号 / 关键单号</label><input class="input" placeholder="输入编号、运单、提单或柜号"></div><div class="field"><label>供应商</label><select class="select"><option>全部供应商</option>${suppliers.map(s=>`<option>${s.name}</option>`).join("")}</select></div><div class="field"><label>成本类型</label><select class="select"><option>全部类型</option><option>直接成本</option><option>间接成本</option></select></div><div class="field"><label>处理状态</label><select class="select"><option>全部状态</option><option>已归属</option><option>待分摊</option><option>已分摊</option><option>待人工确认</option></select></div><div class="filter-actions"><button class="btn primary">${icon("search")}查询</button><button class="btn">${icon("rotate-ccw")}重置</button></div></div></div>
  <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th><input class="row-check" type="checkbox"></th><th>成本明细编号</th><th>供应商 / 板块</th><th>供应商原始费项</th><th>常规成本费项</th><th>关键单号</th><th>原始金额</th><th>成本类型</th><th>归属对象 / 分摊池</th><th>处理状态</th><th>操作</th></tr></thead><tbody>${costs.map(c=>`<tr><td><input class="row-check" type="checkbox"></td><td class="link mono" data-action="open-cost" data-id="${c.id}">${c.id}</td><td>${c.supplier}<br><span class="muted">${c.board}</span></td><td>${c.raw}</td><td>${c.fee}</td><td><span class="muted">${c.keyType}</span><br>${c.key}</td><td class="num strong">${money(c.amount,c.currency)}</td><td>${tag(c.type,c.type==="直接成本"?"green":"orange")}</td><td>${c.target}</td><td>${status(c.status)}</td><td><button class="btn small" data-action="open-cost" data-id="${c.id}">详情</button><button class="btn small" data-action="toggle-cost" data-id="${c.id}">切换类型</button></td></tr>`).join("")}</tbody></table></div>${tableFooter(costs.length)}</section>`;
}

function renderAllocation() {
  const filtered=state.poolFilter==="全部"?pools:pools.filter(p=>p.status===state.poolFilter);
  return `${pageHeader("间接成本分摊", "先确定成本池边界与候选业务订单，再按有效分摊因子逐币种计算", `<button class="btn">${icon("settings-2")}分摊规则</button><button class="btn primary" data-action="new-pool">${icon("plus")}新建分摊池</button>`)}
  <div class="filter-panel"><div class="filter-grid"><div class="field"><label>分摊池编号 / 名称</label><input class="input" placeholder="输入分摊池编号或名称"></div><div class="field"><label>供应商</label><select class="select"><option>全部供应商</option>${suppliers.map(s=>`<option>${s.name}</option>`).join("")}</select></div><div class="field"><label>常规成本费项</label><select class="select"><option>全部费项</option>${fees.map(f=>`<option>${f.name}</option>`).join("")}</select></div><div class="field"><label>分摊状态</label><div class="segmented">${["全部","待人工确认","待分摊","已分摊"].map(v=>`<button class="${state.poolFilter===v?"active":""}" data-action="pool-filter" data-value="${v}">${v}</button>`).join("")}</div></div></div></div>
  <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>分摊池编号</th><th>分摊池名称</th><th>供应商</th><th>常规成本费项</th><th>业务范围</th><th>待分摊金额</th><th>候选订单</th><th>优先 / 兜底因子</th><th>有效版本</th><th>状态</th><th>操作</th></tr></thead><tbody>${filtered.map(p=>`<tr><td class="link mono" data-action="open-pool" data-id="${p.id}">${p.id}</td><td>${p.name}</td><td>${p.supplier}</td><td>${p.fee}</td><td>${p.scope}</td><td class="num strong">${p.amount}</td><td class="num">${p.orders}</td><td>${p.factor}<br><span class="muted">兜底：${p.fallback}</span></td><td>${p.version}</td><td>${status(p.status)}</td><td><button class="btn small" data-action="open-pool" data-id="${p.id}">详情</button>${p.status!=="已分摊"?`<button class="btn small" data-action="run-allocation" data-id="${p.id}">预览分摊</button>`:""}</td></tr>`).join("")}</tbody></table></div>${tableFooter(filtered.length)}</section>`;
}

function renderProfit() {
  const rows=[
    ["SO-OG0370-61428","JYK-深圳立杰海快","台湾海快","8,620.000","5,183.000","882.000","2,555.000","29.64%","成本已齐"],
    ["SO-SZT-A-2606881","环球虾皮","台湾空运","6,280.000","3,916.000","614.000","1,750.000","27.87%","成本已齐"],
    ["SO-OG0347-62018","测试客户1","台湾海快","4,960.000","3,082.000","1,034.000","844.000","17.02%","成本未齐"],
    ["SO-ZMB-2606152","ZMB","台湾海快","12,800.000","7,960.000","2,284.000","2,556.000","19.97%","成本未齐"]
  ];
  return `${pageHeader("利润分析", "按业务订单关联客户侧收入、返款扣减影响、直接成本与间接成本", `<button class="btn">${icon("download")}导出分析</button>`)}
  <div class="kpi-grid"><div class="kpi-card info"><div class="kpi-label">已确认客户侧收入</div><div class="kpi-value">3.86<small>百万 CNY</small></div><div class="kpi-extra">客户账单锁定汇率</div></div><div class="kpi-card"><div class="kpi-label">直接成本</div><div class="kpi-value">2.31<small>百万 CNY</small></div><div class="kpi-extra">包裹与订单级合计</div></div><div class="kpi-card warning"><div class="kpi-label">间接成本</div><div class="kpi-value">0.72<small>百万 CNY</small></div><div class="kpi-extra">有效分摊版本</div></div><div class="kpi-card success"><div class="kpi-label">总实际利润</div><div class="kpi-value">0.63<small>百万 CNY</small></div><div class="kpi-extra">仅成本已齐订单</div></div><div class="kpi-card danger"><div class="kpi-label">成本未齐订单</div><div class="kpi-value">410<small>单</small></div><div class="kpi-extra">当前显示暂估实际利润</div></div></div>
  <div class="filter-panel"><div class="filter-grid"><div class="field"><label>业务订单 / 客户</label><input class="input" placeholder="订单号或客户名称"></div><div class="field"><label>集运线路</label><select class="select"><option>全部线路</option><option>台湾海快</option><option>台湾空运</option></select></div><div class="field"><label>成本完整性</label><select class="select"><option>全部</option><option>成本已齐</option><option>成本未齐</option></select></div><div class="field"><label>账期</label><div id="profit-period-range" class="date-range-control"></div></div><div class="filter-actions"><button class="btn primary">${icon("search")}查询</button><button class="btn">${icon("rotate-ccw")}重置</button></div></div></div>
  <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>业务订单号</th><th>客户</th><th>集运线路</th><th>客户侧收入</th><th>直接成本</th><th>间接成本</th><th>利润</th><th>利润率</th><th>成本完整性</th><th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="link mono">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>${r.slice(3,8).map(v=>`<td class="num">${v}${v.includes("%")?"":" CNY"}</td>`).join("")}<td>${status(r[8])}</td><td><button class="btn small" data-action="profit-detail" data-id="${r[0]}">成本构成</button></td></tr>`).join("")}</tbody></table></div>${tableFooter(rows.length)}</section>`;
}

function renderFees() {
  const costBoards = ["派送成本", "清关成本", "海运成本", "空运成本", "租车成本"];
  const filteredFees = fees.filter(item => {
    const text = `${item.code} ${item.name} ${item.definition || ""}`.toLowerCase();
    return (!state.feeKeyword || text.includes(state.feeKeyword.toLowerCase())) && (!state.feeBoard || item.board === state.feeBoard) && (!state.feeStatus || item.status === state.feeStatus);
  });
  const summary = `<div class="fee-summary"><div><span>常规成本费项</span><strong>${fees.length}</strong><small>五个成本板块</small></div><div><span>启用费项</span><strong>${fees.filter(item => item.status === "启用").length}</strong><small>可用于后续导入</small></div><div><span>分摊规则</span><strong>${fees.reduce((sum, item) => sum + item.rules, 0)}</strong><small>在费项详情中维护</small></div><div><span>导入设置快照</span><strong>${suppliers.length}</strong><small>每个供应商保存映射结果</small></div></div>`;
  const boardTabs = `<div class="fee-board-tabs">${["", ...costBoards].map(board => {
    const label = board || "全部";
    const count = board ? fees.filter(item => item.board === board).length : fees.length;
    return `<button class="${state.feeBoard === board ? "active" : ""}" data-action="fee-board-tab" data-value="${board}"><span>${label}</span><small>${count}</small></button>`;
  }).join("")}</div>`;
  const indexView = `<div class="inline-note">成本费项索引与客户侧费项索引分开维护。供应商账单中的原始名称不在本页单独维护，最终映射结果由各供应商的导入设置快照保存，并在后续导入时复用。</div>
    <div class="filter-panel"><div class="filter-grid"><div class="field"><label>费项编码 / 名称</label><input id="fee-keyword" class="input" value="${escapeHtml(state.feeKeyword)}" placeholder="输入编码、名称或业务定义"></div><div class="field"><label>成本板块</label><select id="fee-board" class="select"><option value="">全部板块</option>${["派送成本","清关成本","海运成本","空运成本","租车成本"].map(item => `<option value="${item}" ${state.feeBoard === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field"><label>状态</label><select id="fee-status" class="select"><option value="">全部状态</option>${["启用","停用"].map(item => `<option value="${item}" ${state.feeStatus === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="filter-actions"><button class="btn primary" data-action="fee-query">${icon("search")}查询</button><button class="btn" data-action="fee-reset">${icon("rotate-ccw")}重置</button></div></div></div>
    <section class="panel"><div class="panel-head fee-board-tabbar">${boardTabs}<span class="panel-tools">共 ${filteredFees.length} 项</span></div><div class="table-wrap"><table class="data-table fee-index-table"><thead><tr><th>成本费项编码</th><th>常规成本费项 / 业务定义</th><th>成本板块</th><th>费项类型</th><th>成本明细引用</th><th>分摊规则</th><th>状态</th><th>操作</th></tr></thead><tbody>${filteredFees.map(f => `<tr><td class="link mono" data-action="open-fee" data-id="${f.code}">${f.code}</td><td><div class="fee-name-cell"><strong>${escapeHtml(f.name)}</strong><span>${escapeHtml(f.definition)}</span></div></td><td>${tag(f.board,"purple")}</td><td>${tag("应付类","blue")}</td><td class="num">${f.references || 0}</td><td><button class="count-link" data-action="fee-rules" data-id="${f.code}"><strong>${f.rules}</strong><span>条</span></button></td><td>${status(f.status)}</td><td><button class="btn small" data-action="open-fee" data-id="${f.code}">详情</button><button class="btn small" data-action="edit-fee" data-id="${f.code}">编辑</button></td></tr>`).join("") || `<tr><td colspan="8" class="empty-cell">没有符合条件的成本费项</td></tr>`}</tbody></table></div>${tableFooter(filteredFees.length)}</section>`;
  return `${pageHeader("成本费项索引", "统一五大成本板块的内部费项口径，供应商原始名称映射由导入设置快照保存", `<button class="btn primary" data-action="new-fee">${icon("plus")}新增常规成本费项</button>`)}${summary}${indexView}`;
}
function renderView() {
  destroyAllDateRangePickers();
  const content=document.getElementById("content");
  const views={overview:renderOverview,suppliers:renderSuppliers,bills:renderBills,pool:renderPool,allocation:renderAllocation,profit:renderProfit,fees:renderFees};
  content.innerHTML=(views[state.view]||renderOverview)();
  document.querySelector(".current-route").textContent=routeNames[state.view];
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===state.view));
  refreshIcons();
  initializeViewDateRangePickers();
  window.scrollTo({top:0,behavior:"instant"});
}

function showDrawer(title, body) {
  const drawer=document.getElementById("drawer"); drawer.innerHTML=`<div class="drawer-head"><span class="drawer-title">${title}</span><button class="icon-btn" data-action="close-drawer" title="关闭">${icon("x")}</button></div><div class="drawer-body">${body}</div>`;
  drawer.classList.remove("hidden"); document.getElementById("drawer-backdrop").classList.remove("hidden"); refreshIcons();
}
function closeDrawer(){document.getElementById("drawer").classList.add("hidden");document.getElementById("drawer-backdrop").classList.add("hidden");}
function openImportModal(reset = false) {
  if (reset) state.wizardStep = 1;
  destroyDateRangePicker("cost-period-range");
  const modal = document.getElementById("modal");
  modal.classList.add("import-wizard-modal");
  modal.innerHTML = `<div class="modal-head import-modal-head"><div class="modal-title-stack"><span class="modal-title">导入供应商账单</span><small>确认供应商与账期，完成字段配对后形成成本账单及成本明细</small></div><button class="icon-btn" data-action="close-modal" title="关闭">${icon("x")}</button></div><div class="import-modal-body">${renderImportWizard()}</div>`;
  modal.classList.remove("hidden");
  document.getElementById("modal-backdrop").classList.remove("hidden");
  refreshIcons();
  initializeCostPeriodPicker();
}
function destroyDateRangePicker(id) {
  const app = dateRangePickerApps.get(id);
  if (!app) return;
  app.unmount();
  dateRangePickerApps.delete(id);
}
function destroyAllDateRangePickers() {
  [...dateRangePickerApps.keys()].forEach(destroyDateRangePicker);
}
function mountDateRangePicker({ id, start, end, onUpdate, ariaLabel }) {
  destroyDateRangePicker(id);
  const mountPoint = document.getElementById(id);
  if (!mountPoint) return;
  const app = createApp({
    setup() {
      const selectedPeriod = ref([start, end]);
      const updatePeriod = value => {
        selectedPeriod.value = value;
        if (!Array.isArray(value) || value.length !== 2) return;
        onUpdate(value);
      };
      return () => h(ElConfigProvider, { locale: zhCn }, {
        default: () => h(ElDatePicker, {
          modelValue: selectedPeriod.value,
          "onUpdate:modelValue": updatePeriod,
          type: "daterange",
          rangeSeparator: "至",
          startPlaceholder: "开始日期",
          endPlaceholder: "结束日期",
          format: "YYYY/MM/DD",
          valueFormat: "YYYY-MM-DD",
          clearable: false,
          teleported: true,
          popperClass: "cost-period-picker-popper",
          ariaLabel
        })
      });
    }
  });
  app.mount(mountPoint);
  dateRangePickerApps.set(id, app);
}
function initializeCostPeriodPicker() {
  mountDateRangePicker({
    id: "cost-period-range",
    start: state.costPeriodStart,
    end: state.costPeriodEnd,
    ariaLabel: "实际成本账期日期范围",
    onUpdate: value => { [state.costPeriodStart, state.costPeriodEnd] = value; }
  });
}
function initializeViewDateRangePickers() {
  const configs = {
    suppliers: { id: "supplier-period-range", start: state.supplierPeriodStart, end: state.supplierPeriodEnd, ariaLabel: "供应商成本账期筛选范围", onUpdate: value => { [state.supplierPeriodStart, state.supplierPeriodEnd] = value; } },
    bills: { id: "bill-period-range", start: state.billPeriodStart, end: state.billPeriodEnd, ariaLabel: "成本账单实际成本账期筛选范围", onUpdate: value => { [state.billPeriodStart, state.billPeriodEnd] = value; } },
    profit: { id: "profit-period-range", start: state.profitPeriodStart, end: state.profitPeriodEnd, ariaLabel: "利润分析账期筛选范围", onUpdate: value => { [state.profitPeriodStart, state.profitPeriodEnd] = value; } }
  };
  if (configs[state.view]) mountDateRangePicker(configs[state.view]);
}
function showModal(title, body, confirm="确认") { destroyDateRangePicker("cost-period-range");const m=document.getElementById("modal"); m.classList.remove("import-wizard-modal");m.innerHTML=`<div class="modal-head"><span class="modal-title">${title}</span><button class="icon-btn" data-action="close-modal">${icon("x")}</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn" data-action="close-modal">取消</button><button class="btn primary" data-action="modal-confirm">${confirm}</button></div>`;m.classList.remove("hidden");document.getElementById("modal-backdrop").classList.remove("hidden");refreshIcons();}
function closeModal(){destroyDateRangePicker("cost-period-range");const modal=document.getElementById("modal");modal.classList.add("hidden");modal.classList.remove("import-wizard-modal");document.getElementById("modal-backdrop").classList.add("hidden");state.pendingAction=null;}
function toast(message,type="success"){const stack=document.getElementById("toast-stack");const el=document.createElement("div");el.className=`toast ${type}`;el.innerHTML=`${icon(type==="success"?"circle-check":"triangle-alert")}<span>${message}</span>`;stack.appendChild(el);refreshIcons();setTimeout(()=>el.remove(),3200);}

function dataToolsModal() {
  state.pendingAction = null;
  showModal("模拟数据管理", `<div class="inline-note">模拟数据保存在当前浏览器的 IndexedDB 中，不会发送到任何后端服务。</div><div class="data-tool-list"><button class="data-tool-item" data-action="export-prototype-data">${icon("download")}<span><strong>导出模拟数据</strong><small>将当前供应商、账单、成本和分摊结果保存为 JSON</small></span></button><button class="data-tool-item" data-action="import-prototype-data">${icon("upload")}<span><strong>导入模拟数据</strong><small>用已导出的 JSON 覆盖当前浏览器数据</small></span></button><button class="data-tool-item danger" data-action="reset-prototype-data">${icon("rotate-ccw")}<span><strong>恢复初始数据</strong><small>清除当前操作结果并重新载入成本账单样本</small></span></button></div>`, "关闭");
}

async function exportPrototypeData() {
  const data = {};
  for (const tableName of dataTableNames) data[tableName] = await prototypeDb.table(tableName).toArray();
  data.operationLogs = await prototypeDb.operationLogs.toArray();
  const payload = { format: "bms-cost-center-prototype", version: 2, exportedAt: new Date().toISOString(), data };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `BMS成本中心模拟数据-${new Date().toISOString().slice(0,10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast("模拟数据已导出");
}

async function importPrototypeData(file) {
  const payload = JSON.parse(await file.text());
  if (payload?.format !== "bms-cost-center-prototype" || !payload.data) throw new Error("不是有效的成本中心模拟数据文件");
  for (const tableName of dataTableNames) {
    if (!Array.isArray(payload.data[tableName]) && tableName !== "feeAliases") throw new Error(`模拟数据缺少 ${tableName}`);
  }
  await prototypeDb.transaction("rw", prototypeDb.tables, async () => {
    await Promise.all(prototypeDb.tables.map(table => table.clear()));
    for (const tableName of dataTableNames) {
      const rows = Array.isArray(payload.data[tableName]) ? payload.data[tableName] : initialData[tableName];
      if (rows.length) await prototypeDb.table(tableName).bulkAdd(cloneData(rows));
    }
    if (Array.isArray(payload.data.operationLogs) && payload.data.operationLogs.length) await prototypeDb.operationLogs.bulkAdd(cloneData(payload.data.operationLogs).map(({ id, ...row }) => row));
    await prototypeDb.settings.put({ key: "seedVersion", value: 2 });
    await prototypeDb.operationLogs.add({ entityType: "系统", entityId: "成本中心原型", action: "导入模拟数据", createdAt: new Date().toISOString() });
  });
  await hydratePrototypeData();
  closeModal();
  renderView();
  toast("模拟数据已导入，各页面已同步刷新");
}

async function commitPendingAction() {
  const action = state.pendingAction;
  if (!action) { closeModal(); toast("操作已提交"); return; }

  if (action.type === "saveFee") {
    const original = fees.find(item => item.code === action.id);
    const code = (document.getElementById("fee-form-code")?.value || "").trim().toUpperCase();
    const name = (document.getElementById("fee-form-name")?.value || "").trim();
    const board = document.getElementById("fee-form-board")?.value || original?.board || "";
    const definition = (document.getElementById("fee-form-definition")?.value || "").trim();
    const remark = (document.getElementById("fee-form-remark")?.value || "").trim();
    const feeStatus = document.getElementById("fee-form-status")?.value || "启用";
    if (!code || !name || !board || !definition) { toast("请完整填写成本费项编码、名称、成本板块和业务定义", "warning"); return; }
    if (!/^COST-[A-Z0-9-]+$/.test(code)) { toast("成本费项编码应以 COST- 开头，并仅使用大写字母、数字和连字符", "warning"); return; }
    if (!original && fees.some(item => item.code === code)) { toast("成本费项编码已存在", "warning"); return; }
    const duplicateName = fees.find(item => item.code !== (original?.code || code) && item.board === board && item.name === name);
    if (duplicateName) { toast(`“${name}”已存在于${board}，同一板块内名称不可重复`, "warning"); return; }
    const updatedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-");
    const next = { ...original, code, name, board, definition, remark, status: feeStatus, rules: original?.rules || 0, references: original?.references || 0, updatedAt };
    if (original) Object.assign(original, next); else fees.unshift(next);
    await prototypeDb.fees.put(cloneData(next));
    await recordOperation("成本费项索引", code, original ? "编辑常规成本费项" : "新增常规成本费项", `${board} / ${name}`);
  } else if (action.type === "saveAlias") {
    const original = feeAliases.find(item => item.id === action.id);
    const supplier = document.getElementById("alias-form-supplier")?.value || "";
    const board = document.getElementById("alias-form-board")?.value || "";
    const rawName = (document.getElementById("alias-form-raw")?.value || "").trim();
    const feeCode = document.getElementById("alias-form-fee")?.value || "";
    const structure = (document.getElementById("alias-form-structure")?.value || "").trim();
    const sheet = (document.getElementById("alias-form-sheet")?.value || "").trim();
    const aliasStatus = document.getElementById("alias-form-status")?.value || "启用";
    const note = (document.getElementById("alias-form-note")?.value || "").trim();
    const targetFee = fees.find(item => item.code === feeCode);
    if (!supplier || !board || !rawName || !targetFee) { toast("请完整填写供应商、成本板块、原始费项名称和常规成本费项", "warning"); return; }
    if (targetFee.board !== board) { toast("供应商映射与常规成本费项必须属于同一成本板块", "warning"); return; }
    if (aliasStatus === "启用" && targetFee.status !== "启用") { toast("启用中的映射只能映射到启用中的常规成本费项", "warning"); return; }
    const duplicate = feeAliases.find(item => item.id !== original?.id && item.supplier === supplier && item.board === board && item.rawName.trim().toLowerCase() === rawName.toLowerCase() && (item.structure || "") === structure && (item.sheet || "") === sheet && item.status === "启用" && aliasStatus === "启用");
    if (duplicate) { toast("相同供应商、板块、原始名称和适用范围下已存在启用映射", "warning"); return; }
    const confirmedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-");
    const next = { ...original, id: original?.id || makeId("ALIAS"), supplier, board, rawName, feeCode, structure, sheet, status: aliasStatus, note, version: (original?.version || 0) + 1, confirmer: "谭清辉", confirmedAt };
    if (original) Object.assign(original, next); else feeAliases.unshift(next);
    await prototypeDb.feeAliases.put(cloneData(next));
    await recordOperation("供应商导入设置快照中的费项映射", next.id, original ? "更新导入设置快照中的费项映射版本" : "新增导入设置快照中的费项映射", `${supplier} / ${rawName} → ${targetFee.name}`);
  } else if (action.type === "toggleFee") {
    const fee = fees.find(item => item.code === action.id);
    fee.status = fee.status === "启用" ? "停用" : "启用";
    fee.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-");
    await prototypeDb.fees.put(cloneData(fee));
    await recordOperation("成本费项索引", fee.code, `${fee.status}常规成本费项`);
  } else if (action.type === "toggleAlias") {
    const alias = feeAliases.find(item => item.id === action.id);
    const nextStatus = alias.status === "启用" ? "停用" : "启用";
    const targetFee = fees.find(item => item.code === alias.feeCode);
    if (nextStatus === "启用" && targetFee?.status !== "启用") { toast("目标常规成本费项已停用，不能启用该映射", "warning"); return; }
    alias.status = nextStatus;
    alias.version += 1;
    alias.confirmer = "谭清辉";
    alias.confirmedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-");
    await prototypeDb.feeAliases.put(cloneData(alias));
    await recordOperation("供应商导入设置快照中的费项映射", alias.id, `${alias.status}导入设置快照中的费项映射`, alias.rawName);
  } else if (action.type === "settleBill") {
    const bill = bills.find(item => item.id === action.id);
    bill.settled = bill.amount;
    bill.state = "已结清";
    await prototypeDb.bills.put(cloneData(bill));
    await recordOperation("成本账单", bill.id, "登记已结清");
  } else if (action.type === "toggleCost") {
    const cost = costs.find(item => item.id === action.id);
    cost.type = cost.type === "直接成本" ? "间接成本" : "直接成本";
    cost.status = cost.type === "直接成本" ? "待人工确认" : "待分摊";
    cost.target = cost.type === "直接成本" ? "待匹配业务对象" : "待选择分摊池";
    await prototypeDb.costs.put(cloneData(cost));
    await recordOperation("成本明细", cost.id, `切换为${cost.type}`);
  } else if (action.type === "runAllocation") {
    const pool = pools.find(item => item.id === action.id);
    pool.status = "已分摊";
    pool.version = pool.version === "-" ? "V1" : `V${Number(pool.version.slice(1)) + 1}`;
    await prototypeDb.pools.put(cloneData(pool));
    const affected = costs.filter(cost => cost.target === pool.id);
    for (const cost of affected) cost.status = "已分摊";
    if (affected.length) await prototypeDb.costs.bulkPut(cloneData(affected));
    await recordOperation("分摊池", pool.id, "执行间接成本分摊", pool.version);
  } else if (action.type === "importBill") {
    const file = sampleFiles.find(item => item.id === state.selectedFile);
    const supplier = suppliers.find(item => item.name === file.supplier);
    const currency = ["东风","福广","宅配通","顺盛"].includes(file.supplier) ? "TWD" : "CNY";
    const bill = { id: makeId(`APB-${supplier?.code || file.supplier}`), supplier: file.supplier, board: file.board, period: `${state.costPeriodStart} 至 ${state.costPeriodEnd}`, amount: "168,420.000", currency, settled: "0.000", state: "待结清", rows: 2412, direct: 2198, indirect: 214, unresolved: 18, file: file.name, created: new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-") };
    bills.unshift(bill);
    await prototypeDb.bills.add(cloneData(bill));
    if (supplier) { supplier.bills += 1; supplier.updated = bill.created; await prototypeDb.suppliers.put(cloneData(supplier)); }
    await recordOperation("成本账单", bill.id, "导入供应商账单", file.name);
    state.view = "bills";
    state.wizardStep = 1;
  } else if (action.type === "resetData") {
    await seedPrototypeDatabase(true);
    await hydratePrototypeData();
  }

  state.pendingAction = null;
  closeModal();
  if (["saveFee", "saveAlias", "toggleFee"].includes(action.type)) closeDrawer();
  renderView();
  toast(action.type === "resetData" ? "已恢复初始模拟数据" : "操作已保存到浏览器本地数据库");
}

function supplierDrawer(id){const s=suppliers.find(x=>x.code===id);showDrawer(`供应商财务档案 · ${s.name}`,`<div class="header-actions" style="justify-content:flex-start;margin-bottom:12px"><button class="btn primary">${icon("pencil")}编辑档案</button><button class="btn" data-view="bills">查看成本账单</button></div><div class="detail-grid"><div class="detail-item"><span class="detail-label">供应商编码</span><span class="detail-value">${s.code}</span></div><div class="detail-item"><span class="detail-label">供应商状态</span><span class="detail-value">${status(s.state)}</span></div><div class="detail-item"><span class="detail-label">供应商名称</span><span class="detail-value">${s.name}</span></div><div class="detail-item"><span class="detail-label">适用成本板块</span><span class="detail-value">${s.boards.map(b=>tag(b,"purple")).join("")}</span></div><div class="detail-item"><span class="detail-label">成本账期类型</span><span class="detail-value">${s.cycle}</span></div><div class="detail-item"><span class="detail-label">默认币种</span><span class="detail-value">${s.currency}</span></div><div class="detail-item"><span class="detail-label">当前成本账期</span><span class="detail-value">${s.current}</span></div><div class="detail-item"><span class="detail-label">最近更新时间</span><span class="detail-value">${s.updated}</span></div></div><div class="drawer-section"><h3>金额统计</h3><div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)"><div class="kpi-card"><div class="kpi-label">成本账单</div><div class="kpi-value">${s.bills}</div></div><div class="kpi-card warning"><div class="kpi-label">待结清金额</div><div class="kpi-value" style="font-size:16px">${s.pending}</div></div><div class="kpi-card success"><div class="kpi-label">已结清金额</div><div class="kpi-value" style="font-size:16px">${s.settled}</div></div></div></div><div class="drawer-section"><h3>当前导入设置</h3><div class="timeline"><div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-title">最近确认的导入设置可直接复用</div><div class="timeline-meta">成本板块：${s.boards[0]} · 最近确认：${s.updated}</div></div><div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-title">供应商导入设置快照 8 项</div><div class="timeline-meta">下次账单格式变化时仍可重新自动识别</div></div></div></div>`);}

function billDrawer(id){const b=bills.find(x=>x.id===id);showDrawer("成本账单详情",`<div class="header-actions" style="justify-content:flex-start;margin-bottom:12px"><button class="btn">${icon("file-down")}下载原始账单</button>${b.state==="待结清"?`<button class="btn primary" data-action="settle-bill" data-id="${b.id}">${icon("badge-check")}登记结清</button>`:""}</div><div class="detail-grid"><div class="detail-item"><span class="detail-label">成本账单编号</span><span class="detail-value mono">${b.id}</span></div><div class="detail-item"><span class="detail-label">结清状态</span><span class="detail-value">${status(b.state)}</span></div><div class="detail-item"><span class="detail-label">供应商</span><span class="detail-value">${b.supplier}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${b.board}</span></div><div class="detail-item"><span class="detail-label">实际成本账期</span><span class="detail-value">${b.period}</span></div><div class="detail-item"><span class="detail-label">原始文件</span><span class="detail-value">${b.file}</span></div><div class="detail-item"><span class="detail-label">账单金额</span><span class="detail-value strong">${money(b.amount,b.currency)}</span></div><div class="detail-item"><span class="detail-label">已结清金额</span><span class="detail-value">${money(b.settled,b.currency)}</span></div></div><div class="drawer-section"><div class="tabbar"><button class="active">成本明细</button><button>结清记录</button><button>导入追溯</button></div><div class="preview-summary"><div class="preview-metric"><span>成本明细</span><strong>${b.rows}</strong></div><div class="preview-metric"><span>直接成本</span><strong>${b.direct}</strong></div><div class="preview-metric"><span>间接成本</span><strong>${b.indirect}</strong></div><div class="preview-metric"><span>待处理</span><strong>${b.unresolved}</strong></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>常规成本费项</th><th>关键单号</th><th>金额</th><th>成本类型</th><th>状态</th></tr></thead><tbody>${costs.filter(c=>c.bill===b.id).map(c=>`<tr><td>${c.fee}</td><td>${c.key}</td><td class="num">${money(c.amount,c.currency)}</td><td>${tag(c.type,c.type==="直接成本"?"green":"orange")}</td><td>${status(c.status)}</td></tr>`).join("")||`<tr><td colspan="5" class="muted">当前仅展示代表性明细，完整账单共 ${b.rows} 条</td></tr>`}</tbody></table></div></div>`);}

function costDrawer(id){const c=costs.find(x=>x.id===id);showDrawer("成本明细详情",`<div class="header-actions" style="justify-content:flex-start;margin-bottom:12px"><button class="btn" data-action="toggle-cost" data-id="${c.id}">${icon("repeat-2")}切换成本类型</button><button class="btn">${icon("link")}维护单号关系</button></div><div class="detail-grid"><div class="detail-item"><span class="detail-label">成本明细编号</span><span class="detail-value mono">${c.id}</span></div><div class="detail-item"><span class="detail-label">处理状态</span><span class="detail-value">${status(c.status)}</span></div><div class="detail-item"><span class="detail-label">供应商</span><span class="detail-value">${c.supplier}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${c.board}</span></div><div class="detail-item"><span class="detail-label">供应商原始费项</span><span class="detail-value">${c.raw}</span></div><div class="detail-item"><span class="detail-label">常规成本费项</span><span class="detail-value">${c.fee}</span></div><div class="detail-item"><span class="detail-label">关键单号</span><span class="detail-value">${c.keyType} · ${c.key}</span></div><div class="detail-item"><span class="detail-label">原始金额</span><span class="detail-value strong">${money(c.amount,c.currency)}</span></div><div class="detail-item"><span class="detail-label">成本类型</span><span class="detail-value">${tag(c.type,c.type==="直接成本"?"green":"orange")}</span></div><div class="detail-item"><span class="detail-label">归属结果</span><span class="detail-value">${c.target}</span></div></div><div class="drawer-section"><h3>判断依据</h3><div class="inline-note">系统依据供应商侧单号关系提出建议，财务确认后形成当前成本类型。若一笔金额覆盖多个对象且未拆分，即使单号可追溯也应按间接成本处理。</div></div><div class="drawer-section"><h3>原始行快照</h3><div class="detail-grid"><div class="detail-item"><span class="detail-label">原始表头</span><span class="detail-value">追踪号 / ${c.raw} / 币别 / 备注</span></div><div class="detail-item"><span class="detail-label">原始值</span><span class="detail-value">${c.key} / ${c.amount} / ${c.currency} / -</span></div></div></div>`);}

function poolDrawer(id){const p=pools.find(x=>x.id===id);showDrawer(`分摊池详情 · ${p.id}`,`<div class="header-actions" style="justify-content:flex-start;margin-bottom:12px">${p.status!=="已分摊"?`<button class="btn primary" data-action="run-allocation" data-id="${p.id}">${icon("play")}预览并执行分摊</button>`:`<button class="btn">${icon("rotate-cw")}重新分摊</button>`}<button class="btn">${icon("pencil")}调整本次范围</button></div><div class="detail-grid"><div class="detail-item"><span class="detail-label">分摊池名称</span><span class="detail-value">${p.name}</span></div><div class="detail-item"><span class="detail-label">分摊状态</span><span class="detail-value">${status(p.status)}</span></div><div class="detail-item"><span class="detail-label">供应商</span><span class="detail-value">${p.supplier}</span></div><div class="detail-item"><span class="detail-label">常规成本费项</span><span class="detail-value">${p.fee}</span></div><div class="detail-item"><span class="detail-label">适用业务范围</span><span class="detail-value">${p.scope}</span></div><div class="detail-item"><span class="detail-label">候选业务订单</span><span class="detail-value">${p.orders} 单</span></div><div class="detail-item"><span class="detail-label">待分摊金额</span><span class="detail-value strong">${p.amount}</span></div><div class="detail-item"><span class="detail-label">当前有效版本</span><span class="detail-value">${p.version}</span></div></div><div class="drawer-section"><h3>本次分摊规则</h3><div class="detail-grid"><div class="detail-item"><span class="detail-label">范围锚点</span><span class="detail-value">${p.scope}</span></div><div class="detail-item"><span class="detail-label">分摊对象</span><span class="detail-value">业务订单</span></div><div class="detail-item"><span class="detail-label">优先分摊因子</span><span class="detail-value">${p.factor}</span></div><div class="detail-item"><span class="detail-label">兜底分摊因子</span><span class="detail-value">${p.fallback}</span></div></div></div><div class="drawer-section"><h3>候选订单预览</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>业务订单号</th><th>订单级因子值</th><th>分摊权重</th><th>预计分摊金额</th></tr></thead><tbody><tr><td>SO-OG0370-61428</td><td class="num">86.420</td><td class="num">16.28%</td><td class="num">7,944.640</td></tr><tr><td>SO-SZT-A-2606881</td><td class="num">52.180</td><td class="num">9.84%</td><td class="num">4,801.920</td></tr><tr><td>SO-OG0347-62018</td><td class="num">48.960</td><td class="num">9.23%</td><td class="num">4,504.240</td></tr></tbody></table></div></div>`);}

function feeDrawer(id) {
  const fee = fees.find(item => item.code === id);
  if (!fee) return;
  const ruleRows = Array.from({ length: fee.rules }, (_, index) => ({
    name: index === 0 ? "费项通用规则" : "供应商专用规则",
    supplier: index === 0 ? "全部供应商" : "指定供应商",
    factor: fee.board === "租车成本" ? "业务订单数" : fee.board === "清关成本" ? "清关重量" : "订单计费重量",
    status: "启用",
  }));
  showDrawer(`成本费项详情 · ${fee.name}`, `<div class="header-actions drawer-primary-actions"><button class="btn primary" data-action="edit-fee" data-id="${fee.code}">${icon("pencil")}编辑费项</button><button class="btn ${fee.status === "启用" ? "danger" : ""}" data-action="toggle-fee" data-id="${fee.code}">${fee.status === "启用" ? icon("circle-pause") + "停用" : icon("circle-play") + "启用"}</button></div>
    <div class="fee-detail-hero"><div><span>${tag(fee.board,"purple")}${tag("应付类","blue")}</span><h2>${escapeHtml(fee.name)}</h2><small class="mono">${fee.code}</small></div><div><span>当前状态</span>${status(fee.status)}</div></div>
    <div class="drawer-section"><h3>费项定义</h3><div class="detail-grid"><div class="detail-item"><span class="detail-label">成本费项编码</span><span class="detail-value mono">${fee.code}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${fee.board}</span></div><div class="detail-item detail-full"><span class="detail-label">业务定义</span><span class="detail-value">${escapeHtml(fee.definition)}</span></div><div class="detail-item detail-full"><span class="detail-label">备注</span><span class="detail-value">${escapeHtml(fee.remark || "-")}</span></div><div class="detail-item"><span class="detail-label">成本明细引用</span><span class="detail-value">${fee.references || 0} 条</span></div><div class="detail-item"><span class="detail-label">最近更新</span><span class="detail-value">${escapeHtml(fee.updatedAt || "-")}</span></div></div></div>
    <div class="drawer-section"><h3>映射说明</h3><div class="inline-note">供应商账单中的原始费项名称由各供应商的导入设置快照保存，不在本页单独维护映射入口。财务首次导入并确认后，系统会把原始名称、适用文件特征和对应常规成本费项一起写入快照，供后续导入复用。</div></div>
    <div class="drawer-section"><div class="section-heading"><h3>间接成本分摊规则</h3><button class="btn small" data-action="fee-rules" data-id="${fee.code}">查看全部</button></div><div class="table-wrap"><table class="data-table compact-table"><thead><tr><th>适用层级</th><th>适用供应商</th><th>优先分摊因子</th><th>状态</th></tr></thead><tbody>${ruleRows.map(item => `<tr><td>${item.name}</td><td>${escapeHtml(item.supplier)}</td><td>${item.factor}</td><td>${status(item.status)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty-cell">该费项暂未配置分摊规则</td></tr>`}</tbody></table></div></div>`);
}

function feeFormModal(id = "") {
  const fee = fees.find(item => item.code === id);
  const model = fee || { code: "", name: "", board: "派送成本", definition: "", remark: "", status: "启用" };
  state.pendingAction = { type: "saveFee", id };
  showModal(fee ? `编辑常规成本费项 · ${fee.name}` : "新增常规成本费项", `<div class="inline-note">常规成本费项是成本中心内部统一口径。供应商账单中的原始名称应通过导入设置快照中的费项映射接入，不直接作为费项名称。</div><div class="form-grid fee-form-grid"><div class="field"><label class="required">成本费项编码</label><input id="fee-form-code" class="input mono" value="${escapeHtml(model.code)}" placeholder="例如 COST-DEL-010" ${fee ? "disabled" : ""}></div><div class="field"><label class="required">内部标准名称</label><input id="fee-form-name" class="input" value="${escapeHtml(model.name)}" placeholder="同一成本板块内不可重复"></div><div class="field"><label class="required">成本板块</label><select id="fee-form-board" class="select" ${fee && fee.references ? "disabled" : ""}>${["派送成本","清关成本","海运成本","空运成本","租车成本"].map(item => `<option value="${item}" ${model.board === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field"><label class="required">状态</label><select id="fee-form-status" class="select">${["启用","停用"].map(item => `<option value="${item}" ${model.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field form-span-2"><label class="required">业务定义</label><textarea id="fee-form-definition" class="textarea" placeholder="说明该费项包含和不包含的供应商收费内容">${escapeHtml(model.definition)}</textarea><small class="field-help">业务定义用于导入设置快照中的费项映射和导入确认，应能区分相近但核算含义不同的费用。</small></div><div class="field form-span-2"><label>备注</label><textarea id="fee-form-remark" class="textarea" placeholder="记录板块内的特殊核算口径">${escapeHtml(model.remark || "")}</textarea></div></div>${fee && fee.references ? `<div class="validation-item warn">${icon("lock-keyhole")}该费项已被 ${fee.references} 条成本明细引用，编码和成本板块不可修改；停用只影响后续导入、补录和分摊配置。</div>` : ""}`, fee ? "保存修改" : "确认新增");
}

function syncAliasFeeOptions(board, preferredCode = "") {
  const select = document.getElementById("alias-form-fee");
  if (!select) return;
  const matching = [...select.options].filter(option => option.dataset.board === board);
  [...select.options].forEach(option => { option.disabled = option.dataset.board !== board; });
  const preferred = matching.find(option => option.value === preferredCode);
  if (preferred) select.value = preferred.value;
  else if (matching[0]) select.value = matching[0].value;
}

function aliasFormModal(id = "", presetFeeCode = "") {
  const alias = feeAliases.find(item => item.id === id);
  const presetFee = fees.find(item => item.code === (alias?.feeCode || presetFeeCode));
  const model = alias || { supplier: suppliers[0]?.name || "", board: presetFee?.board || "派送成本", rawName: "", feeCode: presetFeeCode, structure: "", sheet: "", status: "启用", note: "" };
  if (!model.feeCode) model.feeCode = fees.find(item => item.board === model.board && item.status === "启用")?.code || fees[0]?.code || "";
  const supplierOptions = [...new Set([...suppliers.map(item => item.name), ...feeAliases.map(item => item.supplier)])];
  state.pendingAction = { type: "saveAlias", id };
  showModal(alias ? `编辑供应商导入设置快照中的费项映射 · ${alias.rawName}` : "新增供应商导入设置快照中的费项映射", `<div class="inline-note">只有在业务含义一致时，才将供应商原始名称映射到常规成本费项。同名异义时应通过文件结构或 Sheet 缩小适用范围。</div><div class="form-grid fee-form-grid"><div class="field"><label class="required">供应商</label><select id="alias-form-supplier" class="select">${supplierOptions.map(item => `<option value="${escapeHtml(item)}" ${model.supplier === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></div><div class="field"><label class="required">成本板块</label><select id="alias-form-board" class="select">${["派送成本","清关成本","海运成本","空运成本","租车成本"].map(item => `<option value="${item}" ${model.board === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field"><label class="required">供应商原始费项名称</label><input id="alias-form-raw" class="input" value="${escapeHtml(model.rawName)}" placeholder="原样保留账单中的文本"></div><div class="field"><label class="required">映射至常规成本费项</label><select id="alias-form-fee" class="select">${fees.map(item => `<option value="${item.code}" data-board="${item.board}" ${model.feeCode === item.code ? "selected" : ""}>${item.name} · ${item.board}</option>`).join("")}</select></div><div class="field"><label>文件结构特征</label><input id="alias-form-structure" class="input" value="${escapeHtml(model.structure || "")}" placeholder="同名异义时填写"></div><div class="field"><label>适用 Sheet</label><input id="alias-form-sheet" class="input" value="${escapeHtml(model.sheet || "")}" placeholder="不填写表示全部 Sheet"></div><div class="field"><label class="required">状态</label><select id="alias-form-status" class="select">${["启用","停用"].map(item => `<option value="${item}" ${model.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field form-span-2"><label>业务说明</label><textarea id="alias-form-note" class="textarea" placeholder="首次映射、同名异义或调整映射时说明口径">${escapeHtml(model.note || "")}</textarea></div></div>${alias ? `<div class="validation-item ok">${icon("history")}保存后版本由 V${alias.version} 更新为 V${alias.version + 1}，历史成本明细继续使用导入时的映射快照。</div>` : ""}`, alias ? "保存并生成新版本" : "确认新增");
  syncAliasFeeOptions(model.board, model.feeCode);
}

function feeAliasModal(id) {
  state.feeTab = "index";
  state.aliasKeyword = "";
  closeDrawer();
  renderView();
}

function settleModal(id){state.pendingAction={type:"settleBill",id};const b=bills.find(x=>x.id===id);showModal("登记成本账单结清",`<div class="inline-note">结清只登记供应商账单的资金闭环事实，不会自动确认成本归属或成本已齐。</div><div class="form-grid" style="grid-template-columns:1fr 1fr"><div class="field"><label class="required">本次结清金额</label><input class="input" value="${(Number(b.amount.replaceAll(',',''))-Number(b.settled.replaceAll(',',''))).toFixed(3)}"></div><div class="field"><label class="required">结清币种</label><select class="select"><option>${b.currency}</option></select></div><div class="field"><label class="required">结清日期</label><input class="input" type="date" value="2026-07-17"></div><div class="field"><label class="required">结清方式</label><select class="select"><option>银行转账</option><option>抵扣</option><option>其它</option></select></div><div class="field"><label class="required">成本核销汇率</label><input class="input" value="${b.currency==="CNY"?"1.00000":"0.21780"}"></div><div class="field"><label>付款凭证</label><button class="btn" style="width:100%">${icon("paperclip")}上传凭证</button></div></div><div class="field"><label>备注</label><textarea class="textarea" placeholder="填写供应商付款或抵扣说明"></textarea></div>`,"确认登记");}

function allocationModal(id){state.pendingAction={type:"runAllocation",id};const p=pools.find(x=>x.id===id);showModal("分摊预览",`<div class="preview-summary" style="grid-template-columns:repeat(3,1fr)"><div class="preview-metric"><span>候选业务订单</span><strong>${p.orders}</strong></div><div class="preview-metric"><span>待分摊金额</span><strong>${p.amount}</strong></div><div class="preview-metric"><span>金额差异</span><strong style="color:var(--success)">0.000</strong></div></div><div class="validation-list"><div class="validation-item ok">${icon("circle-check")}候选订单范围不为空，范围外订单未参与</div><div class="validation-item ok">${icon("circle-check")}优先分摊因子“${p.factor}”完整且合计大于 0</div><div class="validation-item ok">${icon("circle-check")}逐币种分摊金额守恒，尾差将按最大余数法处理</div></div><div class="inline-note">执行后生成新的有效分摊版本，结果只落到业务订单，不生成尾程包裹级间接成本。</div>`,"执行分摊");}

document.addEventListener("click", async (event) => {
  const viewBtn=event.target.closest("[data-view]"); if(viewBtn){state.view=viewBtn.dataset.view; state.sidebarOpen=false;document.getElementById("sidebar").classList.remove("open");closeDrawer();renderView();return;}
  const el=event.target.closest("[data-action]"); if(!el)return; const a=el.dataset.action,id=el.dataset.id;
  if(a==="toggle-sidebar"){state.sidebarOpen=!state.sidebarOpen;document.getElementById("sidebar").classList.toggle("open",state.sidebarOpen);}
  else if(a==="open-data-tools") dataToolsModal();
  else if(a==="export-prototype-data") await exportPrototypeData();
  else if(a==="import-prototype-data") document.getElementById("prototype-data-file").click();
  else if(a==="reset-prototype-data"){state.pendingAction={type:"resetData"};showModal("恢复初始模拟数据",`<div class="validation-item warn">${icon("triangle-alert")}当前浏览器中的编辑、导入、结清和分摊结果都会被初始样本覆盖。</div>`,"确认恢复");}
  else if(a==="close-drawer") closeDrawer(); else if(a==="close-modal") closeModal();
  else if(a==="open-import") openImportModal(true);
  else if(a==="open-supplier") supplierDrawer(id); else if(a==="open-bill") billDrawer(id); else if(a==="open-cost") costDrawer(id); else if(a==="open-pool") poolDrawer(id);
  else if(a==="select-file"){state.selectedFile=id;state.selectedSheet=sampleFiles.find(x=>x.id===id).defaultSheet;openImportModal();}
  else if(a==="select-sheet"){state.selectedSheet=id;openImportModal();}
  else if(a==="wizard-next"){state.wizardStep=Math.min(3,state.wizardStep+1);openImportModal();}
  else if(a==="wizard-back"){state.wizardStep=Math.max(1,state.wizardStep-1);openImportModal();}
  else if(a==="confirm-import"){state.pendingAction={type:"importBill"};showModal("确认导入供应商账单",`<div class="validation-list"><div class="validation-item ok">${icon("circle-check")}导入将按整批原子方式执行</div><div class="validation-item ok">${icon("circle-check")}完全成功后形成一张成本账单及 2,412 条成本明细</div></div><div class="inline-note">导入成功后可在成本账单列表查看结果；任一应导入数据失败时，本次不保留部分成本明细。</div>`,"开始导入");}
  else if(a==="bill-filter"){state.billFilter=el.dataset.value;renderView();}
  else if(a==="pool-filter"){state.poolFilter=el.dataset.value;renderView();}
  
  else if(a==="fee-board-tab"){state.feeBoard=el.dataset.value||"";renderView();}
  else if(a==="fee-query"){state.feeKeyword=document.getElementById("fee-keyword")?.value.trim()||"";state.feeStatus=document.getElementById("fee-status")?.value||"";renderView();}
  else if(a==="fee-reset"){state.feeKeyword="";state.feeStatus="";renderView();}
  
  
  else if(a==="settle-bill") settleModal(id);
  else if(a==="run-allocation") allocationModal(id);
  else if(a==="toggle-cost"){state.pendingAction={type:"toggleCost",id};const c=costs.find(x=>x.id===id);showModal("切换成本类型",`<div class="inline-note">当前为${c.type}。切换前系统会重新校验供应商侧单号关系，并先解除原归属或分摊池占用。</div><div class="field"><label class="required">目标成本类型</label><select class="select"><option>${c.type==="直接成本"?"间接成本":"直接成本"}</option></select></div><div class="field"><label class="required">切换原因</label><textarea class="textarea" placeholder="说明单号关系、覆盖范围或金额粒度发生了什么变化"></textarea></div>`,"确认切换");}
  else if(a==="open-fee") feeDrawer(id);
  else if(a==="new-fee") feeFormModal();
  else if(a==="edit-fee") feeFormModal(id);
  
  
  
  else if(a==="toggle-fee"){const fee=fees.find(item=>item.code===id);state.pendingAction={type:"toggleFee",id};showModal(`${fee.status==="启用"?"停用":"启用"}常规成本费项`, `<div class="validation-item warn">${icon("triangle-alert")}${fee.status==="启用"?"停用后，后续账单导入、成本补录和分摊配置不能再选择该费项；历史成本明细与映射快照不变。":"启用后，该费项重新允许用于后续导入、补录和分摊配置。"}</div><div class="detail-grid"><div class="detail-item"><span class="detail-label">成本费项</span><span class="detail-value">${fee.name}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${fee.board}</span></div></div>`, `确认${fee.status==="启用"?"停用":"启用"}`);}
  
  else if(a==="fee-rules") feeDrawer(id);
  else if(a==="reanalyze") toast("已基于当前文件重新识别字段，原快照尚未被覆盖");
  else if(a==="modal-confirm") await commitPendingAction();
  else if(["new-supplier","new-pool","profit-detail","switch-org"].includes(a)) toast("该入口已纳入原型交互范围，可继续按场景深化","warning");
});
document.getElementById("drawer-backdrop").addEventListener("click",closeDrawer);
document.getElementById("modal-backdrop").addEventListener("click",closeModal);
document.getElementById("prototype-data-file").addEventListener("change",async event=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;try{await importPrototypeData(file);}catch(error){toast(error.message||"模拟数据导入失败","warning");}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeDrawer();closeModal();}});

initializePrototypeDatabase().then(renderView).catch(error=>{
  console.error("模拟数据库初始化失败",error);
  renderView();
  toast("本地模拟数据库初始化失败，当前使用内存数据","warning");
});


