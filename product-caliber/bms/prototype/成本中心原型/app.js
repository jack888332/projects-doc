import Dexie from "dexie";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn.js";
import { createApp, h, ref } from "vue";
import { ElConfigProvider, ElDatePicker } from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn.mjs";
import "element-plus/dist/index.css";

dayjs.locale("zh-cn");

const sampleFiles = [
  { id: "df-delivery", name: "台湾端派送 （东风.xlsx", supplier: "东风", board: "派送成本", sheets: 24, size: "19.8 MB", defaultSheet: "黑貓" },
  { id: "t-cat", name: "台湾端派送 （宅配通.xlsx", supplier: "宅配通", board: "派送成本", sheets: 1, size: "5.6 MB", defaultSheet: "5月明細" },
  { id: "shunsheng", name: "台湾端派送 （顺盛.xlsx", supplier: "顺盛", board: "派送成本", sheets: 1, size: "1.9 MB", defaultSheet: "Sheet1" },
  { id: "df-clearance", name: "海快清关（东风.xls", supplier: "东风", board: "清关成本", sheets: 12, size: "22.7 MB", defaultSheet: "清關費" },
  { id: "df-air-clearance", name: "空运清关（东风.xls", supplier: "东风", board: "清关成本", sheets: 12, size: "22.7 MB", defaultSheet: "清關費" },
  { id: "fuguang", name: "海快清关（福广.xlsx", supplier: "福广", board: "清关成本", sheets: 9, size: "4.9 MB", defaultSheet: "稅金明細" },
  { id: "lianduo", name: "海快船公司（联多.xlsx", supplier: "联多", board: "海运成本", sheets: 2, size: "110 KB", defaultSheet: "sheet1" },
  { id: "libao", name: "空运头程（力宝.xls", supplier: "力宝", board: "空运成本", sheets: 3, size: "89 KB", defaultSheet: "对帐单" },
  { id: "truck", name: "海快租车（仓库送船公司.xlsx", supplier: "仓库送船公司", board: "租车成本", sheets: 1, size: "5.1 MB", defaultSheet: "租车" },
  { id: "mover", name: "海快（深圳搬运工.xlsx", supplier: "深圳搬运工", board: "租车成本", sheets: 1, size: "813 KB", defaultSheet: "Sheet1" }
];

const suppliers = [
  { code: "SUP-DF", name: "东风", boards: ["派送", "清关"], cycle: "半月", currency: "TWD", bills: 3, pending: "2,096,102.000 TWD", settled: "0.000 TWD", state: "启用", updated: "2026-06-30" },
  { code: "SUP-ZPT", name: "宅配通", boards: ["派送"], cycle: "35 自然天", cycleAnchor: "2026-04-21", currency: "TWD", bills: 1, pending: "4,219,280.000 TWD", settled: "0.000 TWD", state: "启用", updated: "2026-05-25" },
  { code: "SUP-SS", name: "顺盛", boards: ["派送"], cycle: "38 自然天", cycleAnchor: "2026-05-08", currency: "TWD", bills: 1, pending: "921,472.000 TWD", settled: "0.000 TWD", state: "启用", updated: "2026-06-14" },
  { code: "SUP-FG", name: "福广", boards: ["清关"], cycle: "半月", currency: "TWD", bills: 1, pending: "4,017,539.000 TWD", settled: "0.000 TWD", state: "启用", updated: "2026-07-01" },
  { code: "SUP-LD", name: "联多", boards: ["海运"], cycle: "半月", currency: "CNY", bills: 1, pending: "664,594.120 CNY", settled: "0.000 CNY", state: "启用", updated: "2026-06-30" },
  { code: "SUP-LB", name: "力宝", boards: ["空运"], cycle: "9 自然天", cycleAnchor: "2026-06-22", currency: "CNY", bills: 1, pending: "3,882.400 CNY", settled: "0.000 CNY", state: "启用", updated: "2026-06-30" },
  { code: "SUP-TRK", name: "仓库送船公司", boards: ["租车"], cycle: "月", currency: "CNY", bills: 1, pending: "234,500.000 CNY", settled: "0.000 CNY", state: "启用", updated: "2026-05-31" },
  { code: "SUP-BY", name: "深圳搬运工", boards: ["租车"], cycle: "月", currency: "CNY", bills: 1, pending: "17,500.000 CNY", settled: "0.000 CNY", state: "启用", updated: "2026-05-31" }
];

const bills = [
  { id: "APB-SUP-DF-20260516-08D115", supplier: "东风", board: "派送成本", period: "2026-05-16 至 2026-05-31", amount: "218,636.000", currency: "TWD", settled: "0.000", state: "待结清", rows: 9, direct: 8, indirect: 1, unresolved: 0, file: "台湾端派送 （东风.xlsx", created: "2026-06-23" },
  { id: "APB-SUP-DF-20260622-573E3D", supplier: "东风", board: "清关成本", period: "2026-06-22 至 2026-06-30", amount: "938,733.000", currency: "TWD", settled: "0.000", state: "待结清", rows: 7, direct: 7, indirect: 0, unresolved: 0, file: "海快清关（东风.xls", created: "2026-06-30" },
  { id: "APB-SUP-ZPT-20260421-867589", supplier: "宅配通", board: "派送成本", period: "2026-04-21 至 2026-05-25", amount: "4,219,280.000", currency: "TWD", settled: "0.000", state: "待结清", rows: 62530, direct: 62530, indirect: 0, unresolved: 0, file: "台湾端派送 （宅配通.xlsx", created: "2026-05-25" },
  { id: "APB-SUP-SS-20260508-9C215C", supplier: "顺盛", board: "派送成本", period: "2026-05-08 至 2026-06-14", amount: "921,472.000", currency: "TWD", settled: "0.000", state: "待结清", rows: 18668, direct: 18668, indirect: 0, unresolved: 0, file: "台湾端派送 （顺盛.xlsx", created: "2026-06-14" },
  { id: "APB-SUP-FG-20260617-316624", supplier: "福广", board: "清关成本", period: "2026-06-17 至 2026-06-30", amount: "4,017,539.000", currency: "TWD", settled: "0.000", state: "待结清", rows: 2, direct: 2, indirect: 0, unresolved: 0, file: "海快清关（福广.xlsx", created: "2026-07-01" },
  { id: "APB-SUP-LD-20260616-CDB8CE", supplier: "联多", board: "海运成本", period: "2026-06-16 至 2026-06-30", amount: "664,594.120", currency: "CNY", settled: "0.000", state: "待结清", rows: 121, direct: 0, indirect: 121, unresolved: 0, file: "海快船公司（联多.xlsx", created: "2026-06-30" },
  { id: "APB-SUP-LB-20260622-CBCAA3", supplier: "力宝", board: "空运成本", period: "2026-06-22 至 2026-06-30", amount: "3,882.400", currency: "CNY", settled: "0.000", state: "待结清", rows: 10, direct: 10, indirect: 0, unresolved: 0, file: "空运头程（力宝.xls", created: "2026-06-30" },
  { id: "APB-SUP-TRK-20260501-D88392", supplier: "仓库送船公司", board: "租车成本", period: "2026-05-01 至 2026-05-31", amount: "234,500.000", currency: "CNY", settled: "0.000", state: "待结清", rows: 7, direct: 0, indirect: 7, unresolved: 0, file: "海快租车（仓库送船公司.xlsx", created: "2026-05-31" },
  { id: "APB-SUP-BY-20260501-76F5F0", supplier: "深圳搬运工", board: "租车成本", period: "2026-05-01 至 2026-05-31", amount: "17,500.000", currency: "CNY", settled: "0.000", state: "待结清", rows: 3, direct: 0, indirect: 3, unresolved: 0, file: "海快（深圳搬运工.xlsx", created: "2026-05-31" },
  { id: "APB-SUP-DF-20260622-185F41", supplier: "东风", board: "清关成本", period: "2026-06-22 至 2026-06-30", amount: "938,733.000", currency: "TWD", settled: "0.000", state: "待结清", rows: 7, direct: 7, indirect: 0, unresolved: 0, file: "空运清关（东风.xls", created: "2026-06-30" }
];

const costs = [
  { id: "COST-DFD-001", bill: bills[0].id, supplier: "东风", board: "派送", raw: "黑貓派件費", fee: "派送费", keyType: "账期", key: bills[0].period, amount: "268.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },
  { id: "COST-DFD-002", bill: bills[0].id, supplier: "东风", board: "派送", raw: "新竹派件費", fee: "派送费", keyType: "账期", key: bills[0].period, amount: "402,343.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },
  { id: "COST-DFD-003", bill: bills[0].id, supplier: "东风", board: "派送", raw: "新竹代收款", fee: "代收款", keyType: "账期", key: bills[0].period, amount: "-154,082.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },
  { id: "COST-DFD-004", bill: bills[0].id, supplier: "东风", board: "派送", raw: "大榮派件費", fee: "派送费", keyType: "账期", key: bills[0].period, amount: "28,372.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },
  { id: "COST-DFD-005", bill: bills[0].id, supplier: "东风", board: "派送", raw: "大榮代收款", fee: "代收款", keyType: "账期", key: bills[0].period, amount: "-17,685.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },
  { id: "COST-DFD-006", bill: bills[0].id, supplier: "东风", board: "派送", raw: "東風派件費", fee: "派送费", keyType: "账期", key: bills[0].period, amount: "1,721,781.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },
  { id: "COST-DFD-007", bill: bills[0].id, supplier: "东风", board: "派送", raw: "東風代收貨款", fee: "代收款", keyType: "账期", key: bills[0].period, amount: "-1,858,021.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },
  { id: "COST-DFD-008", bill: bills[0].id, supplier: "东风", board: "派送", raw: "拖櫃專車", fee: "车趟费", keyType: "账期", key: bills[0].period, amount: "132,625.000", currency: "TWD", detailCount: 1, type: "间接成本", target: "SET-DEL-202605-01", status: "待分摊" },
  { id: "COST-DFD-009", bill: bills[0].id, supplier: "东风", board: "派送", raw: "貨故賠款", fee: "货故赔款", keyType: "账期", key: bills[0].period, amount: "-36,965.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },

  ...[1, 9].flatMap((billIndex, copyIndex) => [
    ["清關費", "清关费", "171,055.000"], ["傳輸費", "传输费", "13,313.000"], ["實名認證", "实名认证费", "98,373.000"],
    ["稅金", "进口税费", "648,442.000"], ["報單費", "报单费", "1,500.000"], ["香港銷毀費用", "销毁费", "50.000"], ["預收罰款", "罚款", "6,000.000"]
  ].map(([raw, fee, amount], index) => ({ id: `COST-DFC-${copyIndex + 1}-${index + 1}`, bill: bills[billIndex].id, supplier: "东风", board: "清关", raw, fee, keyType: "账期", key: bills[billIndex].period, amount, currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" }))),

  { id: "COST-ZPT-001", bill: bills[2].id, supplier: "宅配通", board: "派送", raw: "運費", fee: "派送费", keyType: "宅配单号", key: "477256777616-001 等", amount: "4,213,480.000", currency: "TWD", detailCount: 62414, type: "直接成本", target: "尾程包裹", status: "已归属" },
  { id: "COST-ZPT-002", bill: bills[2].id, supplier: "宅配通", board: "派送", raw: "超大", fee: "超大费", keyType: "宅配单号", key: "687702004614-001 等", amount: "5,800.000", currency: "TWD", detailCount: 116, type: "直接成本", target: "尾程包裹", status: "已归属" },
  { id: "COST-SS-001", bill: bills[3].id, supplier: "顺盛", board: "派送", raw: "本款", fee: "派送费", keyType: "明细表号", key: "1730372711 等", amount: "762,816.000", currency: "TWD", detailCount: 11705, type: "直接成本", target: "尾程包裹", status: "已归属" },
  { id: "COST-SS-002", bill: bills[3].id, supplier: "顺盛", board: "派送", raw: "聯運費", fee: "联运费", keyType: "明细表号", key: "明细表号对应项", amount: "1,000.000", currency: "TWD", detailCount: 4, type: "直接成本", target: "尾程包裹", status: "已归属" },
  { id: "COST-SS-003", bill: bills[3].id, supplier: "顺盛", board: "派送", raw: "附加費用", fee: "附加费", keyType: "明细表号", key: "1050741484 等", amount: "157,656.000", currency: "TWD", detailCount: 6959, type: "直接成本", target: "尾程包裹", status: "已归属" },
  { id: "COST-FG-001", bill: bills[4].id, supplier: "福广", board: "清关", raw: "代墊規費", fee: "代垫规费", keyType: "账期", key: bills[4].period, amount: "2,975.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },
  { id: "COST-FG-002", bill: bills[4].id, supplier: "福广", board: "清关", raw: "代墊關稅", fee: "进口税费", keyType: "账期", key: bills[4].period, amount: "4,014,564.000", currency: "TWD", detailCount: 1, type: "直接成本", target: "供应商账单汇总项", status: "已归属" },

  { id: "COST-LD-001", bill: bills[5].id, supplier: "联多", board: "海运", raw: "報關費", fee: "报关费", keyType: "报关单号", key: "370820260000523025 等", amount: "720.000", currency: "CNY", detailCount: 6, type: "间接成本", target: "SET-SEA-DECL-01", status: "待分摊" },
  { id: "COST-LD-002", bill: bills[5].id, supplier: "联多", board: "海运", raw: "操作費", fee: "操作费", keyType: "报关单号", key: "370820260000523025 等", amount: "1,274.120", currency: "CNY", detailCount: 6, type: "间接成本", target: "SET-SEA-OPS-01", status: "不分摊" },
  { id: "COST-LD-003", bill: bills[5].id, supplier: "联多", board: "海运", raw: "海運費", fee: "海运费", keyType: "提单号", key: "AYLD26061702EX 等", amount: "629,000.000", currency: "CNY", detailCount: 63, type: "间接成本", target: "SET-SEA-FREIGHT-01", status: "待分摊" },
  { id: "COST-LD-004", bill: bills[5].id, supplier: "联多", board: "海运", raw: "普貨海運費", fee: "普货海运费", keyType: "提单号", key: "YGK26062597EX", amount: "10,000.000", currency: "CNY", detailCount: 1, type: "间接成本", target: "SET-SEA-GENERAL-01", status: "待分摊" },
  { id: "COST-LD-005", bill: bills[5].id, supplier: "联多", board: "海运", raw: "拖櫃費", fee: "拖柜费", keyType: "柜号", key: "CICU5056441 等", amount: "22,000.000", currency: "CNY", detailCount: 44, type: "间接成本", target: "SET-SEA-TRAILER-01", status: "待分摊" },
  { id: "COST-LD-006", bill: bills[5].id, supplier: "联多", board: "海运", raw: "目的港拖車費", fee: "目的港拖车费", keyType: "提单号", key: "YGK26062597EX", amount: "1,600.000", currency: "CNY", detailCount: 1, type: "间接成本", target: "SET-SEA-DEST-01", status: "待分摊" },

  { id: "COST-LB-001", bill: bills[6].id, supplier: "力宝", board: "空运", raw: "重量 × 单价", fee: "空运费", keyType: "提单号", key: "297-74034321、297-74276591", amount: "1,742.400", currency: "CNY", detailCount: 2, type: "直接成本", target: "业务订单", status: "已归属" },
  { id: "COST-LB-002", bill: bills[6].id, supplier: "力宝", board: "空运", raw: "提單費", fee: "提单费", keyType: "提单号", key: "297-74034321、297-74276591", amount: "20.000", currency: "CNY", detailCount: 2, type: "直接成本", target: "业务订单", status: "已归属" },
  { id: "COST-LB-003", bill: bills[6].id, supplier: "力宝", board: "空运", raw: "貨物收送費/打包費", fee: "收送打包费", keyType: "账单号", key: "JLAED2660959、JLAED2661170", amount: "1,600.000", currency: "CNY", detailCount: 2, type: "直接成本", target: "业务订单", status: "已归属" },
  { id: "COST-LB-004", bill: bills[6].id, supplier: "力宝", board: "空运", raw: "中港段費", fee: "中港运输费", keyType: "账单号", key: "JLAED2660959、JLAED2661170", amount: "120.000", currency: "CNY", detailCount: 2, type: "直接成本", target: "业务订单", status: "已归属" },
  { id: "COST-LB-005", bill: bills[6].id, supplier: "力宝", board: "空运", raw: "報關費", fee: "报关费", keyType: "账单号", key: "JLAED2660959、JLAED2661170", amount: "400.000", currency: "CNY", detailCount: 2, type: "直接成本", target: "业务订单", status: "已归属" },
  { id: "COST-TRK-001", bill: bills[7].id, supplier: "仓库送船公司", board: "租车", raw: "厦门、福建、泉州、9.6米车、75方车、龙海发车", fee: "租车费", keyType: "月份", key: "2026年5月", amount: "234,500.000", currency: "CNY", detailCount: 7, type: "间接成本", target: "SET-TRK-202605-01", status: "待分摊" },
  { id: "COST-BY-001", bill: bills[8].id, supplier: "深圳搬运工", board: "租车", raw: "17.5米车费用、70方车费用、其他", fee: "租车费", keyType: "月份", key: "2026年5月", amount: "17,500.000", currency: "CNY", detailCount: 3, type: "间接成本", target: "SET-TRK-202605-02", status: "待分摊" }
];

// Each record represents one non-zero fee cell from a supplier's original detail row.
const costDetails = [
  { id: "DETAIL-DFD-001", file: "台湾端派送 （东风.xlsx", sheet: "黑貓", row: 2, date: "2026-04-30", fee: "派送费", raw: "運費", keyType: "追蹤號", key: "901706473682", amount: "80.000", currency: "TWD", type: "直接成本", target: "尾程包裹 901706473682", status: "已归属" },
  { id: "DETAIL-DFD-002", file: "台湾端派送 （东风.xlsx", sheet: "黑貓", row: 2, date: "2026-04-30", fee: "车趟费", raw: "拖車及疊貨費", keyType: "追蹤號", key: "901706473682", amount: "10.400", currency: "TWD", type: "直接成本", target: "尾程包裹 901706473682", status: "已归属" },
  { id: "DETAIL-DFD-003", file: "台湾端派送 （东风.xlsx", sheet: "黑貓", row: 3, date: "2026-05-28", fee: "派送费", raw: "運費", keyType: "追蹤號", key: "901706473702", amount: "80.000", currency: "TWD", type: "直接成本", target: "尾程包裹 901706473702", status: "已归属" },
  { id: "DETAIL-DFD-004", file: "台湾端派送 （东风.xlsx", sheet: "黑貓", row: 3, date: "2026-05-28", fee: "车趟费", raw: "拖車及疊貨費", keyType: "追蹤號", key: "901706473702", amount: "8.800", currency: "TWD", type: "直接成本", target: "尾程包裹 901706473702", status: "已归属" },
  { id: "DETAIL-DFD-005", file: "台湾端派送 （东风.xlsx", sheet: "黑貓", row: 4, date: "2026-05-28", fee: "派送费", raw: "運費", keyType: "追蹤號", key: "901706473713", amount: "80.000", currency: "TWD", type: "直接成本", target: "尾程包裹 901706473713", status: "已归属" },
  { id: "DETAIL-DFD-006", file: "台湾端派送 （东风.xlsx", sheet: "黑貓", row: 4, date: "2026-05-28", fee: "车趟费", raw: "拖車及疊貨費", keyType: "追蹤號", key: "901706473713", amount: "8.800", currency: "TWD", type: "直接成本", target: "尾程包裹 901706473713", status: "已归属" },
  { id: "DETAIL-DFD-007", file: "台湾端派送 （东风.xlsx", sheet: "新竹", row: 3, date: "2026-04-05", fee: "派送费", raw: "運費", keyType: "追蹤號", key: "ZSBG11106", amount: "92.000", currency: "TWD", type: "直接成本", target: "尾程包裹 ZSBG11106", status: "已归属" },
  { id: "DETAIL-DFD-008", file: "台湾端派送 （东风.xlsx", sheet: "新竹", row: 4, date: "2026-04-05", fee: "派送费", raw: "運費", keyType: "追蹤號", key: "ZSBG11156", amount: "92.000", currency: "TWD", type: "直接成本", target: "尾程包裹 ZSBG11156", status: "已归属" },
  { id: "DETAIL-DFD-009", file: "台湾端派送 （东风.xlsx", sheet: "大榮", row: 3, date: "2026-05-05", fee: "派送费", raw: "運費", keyType: "追蹤號", key: "AT78392372", amount: "88.000", currency: "TWD", type: "直接成本", target: "尾程包裹 AT78392372", status: "已归属" },

  { id: "DETAIL-ZPT-001", file: "台湾端派送 （宅配通.xlsx", sheet: "5月明細", row: 2, date: "2026-04-21", fee: "派送费", raw: "運費", keyType: "宅配單號", key: "477256777616-001", amount: "22.000", currency: "TWD", type: "直接成本", target: "尾程包裹 477256777616-001", status: "已归属" },
  { id: "DETAIL-ZPT-002", file: "台湾端派送 （宅配通.xlsx", sheet: "5月明細", row: 3, date: "2026-04-26", fee: "派送费", raw: "運費", keyType: "宅配單號", key: "577295868424-001", amount: "57.000", currency: "TWD", type: "直接成本", target: "尾程包裹 577295868424-001", status: "已归属" },
  { id: "DETAIL-ZPT-003", file: "台湾端派送 （宅配通.xlsx", sheet: "5月明細", row: 4, date: "2026-04-26", fee: "派送费", raw: "運費", keyType: "宅配單號", key: "577295950873-001", amount: "57.000", currency: "TWD", type: "直接成本", target: "尾程包裹 577295950873-001", status: "已归属" },
  { id: "DETAIL-ZPT-004", file: "台湾端派送 （宅配通.xlsx", sheet: "5月明細", row: 5, date: "2026-04-27", fee: "派送费", raw: "運費", keyType: "宅配單號", key: "501612858622-001", amount: "82.000", currency: "TWD", type: "直接成本", target: "尾程包裹 501612858622-001", status: "已归属" },
  { id: "DETAIL-ZPT-005", file: "台湾端派送 （宅配通.xlsx", sheet: "5月明細", row: 6, date: "2026-04-27", fee: "派送费", raw: "運費", keyType: "宅配單號", key: "501612858666-001", amount: "62.000", currency: "TWD", type: "直接成本", target: "尾程包裹 501612858666-001", status: "已归属" },
  { id: "DETAIL-ZPT-006", file: "台湾端派送 （宅配通.xlsx", sheet: "5月明細", row: 7, date: "2026-04-27", fee: "派送费", raw: "運費", keyType: "宅配單號", key: "501612858670-001", amount: "57.000", currency: "TWD", type: "直接成本", target: "尾程包裹 501612858670-001", status: "已归属" },

  { id: "DETAIL-SS-001", file: "台湾端派送 （顺盛.xlsx", sheet: "Sheet1", row: 2, date: "2026-05-08", fee: "派送费", raw: "本款", keyType: "明細表號", key: "1730372711", amount: "71.000", currency: "TWD", type: "直接成本", target: "尾程包裹 1730372711", status: "已归属" },
  { id: "DETAIL-SS-002", file: "台湾端派送 （顺盛.xlsx", sheet: "Sheet1", row: 3, date: "2026-06-08", fee: "派送费", raw: "本款", keyType: "明細表號", key: "1050741484", amount: "64.000", currency: "TWD", type: "直接成本", target: "尾程包裹 1050741484", status: "已归属" },
  { id: "DETAIL-SS-003", file: "台湾端派送 （顺盛.xlsx", sheet: "Sheet1", row: 3, date: "2026-06-08", fee: "附加费", raw: "附加費用", keyType: "明細表號", key: "1050741484", amount: "22.000", currency: "TWD", type: "直接成本", target: "尾程包裹 1050741484", status: "已归属" },
  { id: "DETAIL-SS-004", file: "台湾端派送 （顺盛.xlsx", sheet: "Sheet1", row: 4, date: "2026-06-08", fee: "派送费", raw: "本款", keyType: "明細表號", key: "1050860930", amount: "64.000", currency: "TWD", type: "直接成本", target: "尾程包裹 1050860930", status: "已归属" },
  { id: "DETAIL-SS-005", file: "台湾端派送 （顺盛.xlsx", sheet: "Sheet1", row: 5, date: "2026-06-08", fee: "派送费", raw: "本款", keyType: "明細表號", key: "1050894736", amount: "64.000", currency: "TWD", type: "直接成本", target: "尾程包裹 1050894736", status: "已归属" },
  { id: "DETAIL-SS-006", file: "台湾端派送 （顺盛.xlsx", sheet: "Sheet1", row: 5, date: "2026-06-08", fee: "附加费", raw: "附加費用", keyType: "明細表號", key: "1050894736", amount: "22.000", currency: "TWD", type: "直接成本", target: "尾程包裹 1050894736", status: "已归属" },

  { id: "DETAIL-FG-001", file: "海快清关（福广.xlsx", sheet: "稅金明細", row: 2, date: "2026-06-16", fee: "进口税费", raw: "稅單金額", keyType: "分號", key: "LY178073812144", amount: "83.000", currency: "TWD", type: "直接成本", target: "业务订单 LY178073812144", status: "已归属" },
  { id: "DETAIL-FG-002", file: "海快清关（福广.xlsx", sheet: "稅金明細", row: 3, date: "2026-06-16", fee: "进口税费", raw: "稅單金額", keyType: "分號", key: "TF178098245468", amount: "54.000", currency: "TWD", type: "直接成本", target: "业务订单 TF178098245468", status: "已归属" },
  { id: "DETAIL-FG-003", file: "海快清关（福广.xlsx", sheet: "稅金明細", row: 4, date: "2026-06-16", fee: "进口税费", raw: "稅單金額", keyType: "分號", key: "JXF17809968115", amount: "139.000", currency: "TWD", type: "直接成本", target: "业务订单 JXF17809968115", status: "已归属" },
  { id: "DETAIL-FG-004", file: "海快清关（福广.xlsx", sheet: "稅金明細", row: 5, date: "2026-06-16", fee: "进口税费", raw: "稅單金額", keyType: "分號", key: "TF178106020731", amount: "72.000", currency: "TWD", type: "直接成本", target: "业务订单 TF178106020731", status: "已归属" },
  { id: "DETAIL-FG-005", file: "海快清关（福广.xlsx", sheet: "稅金明細", row: 6, date: "2026-06-16", fee: "进口税费", raw: "稅單金額", keyType: "分號", key: "JXF17810729858", amount: "461.000", currency: "TWD", type: "直接成本", target: "业务订单 JXF17810729858", status: "已归属" },

  { id: "DETAIL-LD-001", file: "海快船公司（联多.xlsx", sheet: "sheet1", row: 4, date: "2026-06-17", fee: "海运费", raw: "海運費", keyType: "提單號", key: "AYLD26061702EX", amount: "9,500.000", currency: "CNY", type: "间接成本", target: "SET-SEA-FREIGHT-01", status: "待分摊" },
  { id: "DETAIL-LD-002", file: "海快船公司（联多.xlsx", sheet: "sheet1", row: 4, date: "2026-06-17", fee: "拖柜费", raw: "拖櫃費", keyType: "櫃號", key: "CICU5056441", amount: "500.000", currency: "CNY", type: "间接成本", target: "SET-SEA-TRAILER-01", status: "待分摊" },
  { id: "DETAIL-LD-003", file: "海快船公司（联多.xlsx", sheet: "sheet1", row: 5, date: "2026-06-17", fee: "海运费", raw: "海運費", keyType: "提單號", key: "AYLD26061703EX", amount: "9,500.000", currency: "CNY", type: "间接成本", target: "SET-SEA-FREIGHT-01", status: "待分摊" },
  { id: "DETAIL-LD-004", file: "海快船公司（联多.xlsx", sheet: "sheet1", row: 5, date: "2026-06-17", fee: "拖柜费", raw: "拖櫃費", keyType: "櫃號", key: "HPCU4762606", amount: "500.000", currency: "CNY", type: "间接成本", target: "SET-SEA-TRAILER-01", status: "待分摊" },
  { id: "DETAIL-LD-005", file: "海快船公司（联多.xlsx", sheet: "sheet1", row: 6, date: "2026-06-17", fee: "海运费", raw: "海運費", keyType: "提單號", key: "AYLD26061704EX", amount: "9,500.000", currency: "CNY", type: "间接成本", target: "SET-SEA-FREIGHT-01", status: "待分摊" },
  { id: "DETAIL-LD-006", file: "海快船公司（联多.xlsx", sheet: "sheet1", row: 6, date: "2026-06-17", fee: "拖柜费", raw: "拖櫃費", keyType: "櫃號", key: "CICU5057520", amount: "500.000", currency: "CNY", type: "间接成本", target: "SET-SEA-TRAILER-01", status: "待分摊" },

  { id: "DETAIL-LB-001", file: "空运头程（力宝.xls", sheet: "对帐单", row: 7, date: "2026-06-24", fee: "空运费", raw: "重量 × 单价", keyType: "提單號", key: "297-74034321", amount: "990.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74034321", status: "已归属" },
  { id: "DETAIL-LB-002", file: "空运头程（力宝.xls", sheet: "对帐单", row: 7, date: "2026-06-24", fee: "提单费", raw: "提单费", keyType: "提單號", key: "297-74034321", amount: "10.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74034321", status: "已归属" },
  { id: "DETAIL-LB-003", file: "空运头程（力宝.xls", sheet: "对帐单", row: 7, date: "2026-06-24", fee: "收送打包费", raw: "货物收送费/打包费", keyType: "账单号", key: "JLAED2660959", amount: "800.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74034321", status: "已归属" },
  { id: "DETAIL-LB-004", file: "空运头程（力宝.xls", sheet: "对帐单", row: 7, date: "2026-06-24", fee: "中港运输费", raw: "中港段费", keyType: "账单号", key: "JLAED2660959", amount: "60.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74034321", status: "已归属" },
  { id: "DETAIL-LB-005", file: "空运头程（力宝.xls", sheet: "对帐单", row: 7, date: "2026-06-24", fee: "报关费", raw: "报关费", keyType: "账单号", key: "JLAED2660959", amount: "200.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74034321", status: "已归属" },
  { id: "DETAIL-LB-006", file: "空运头程（力宝.xls", sheet: "对帐单", row: 8, date: "2026-06-30", fee: "空运费", raw: "重量 × 单价", keyType: "提單號", key: "297-74276591", amount: "752.400", currency: "CNY", type: "直接成本", target: "业务订单 297-74276591", status: "已归属" },
  { id: "DETAIL-LB-007", file: "空运头程（力宝.xls", sheet: "对帐单", row: 8, date: "2026-06-30", fee: "提单费", raw: "提单费", keyType: "提單號", key: "297-74276591", amount: "10.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74276591", status: "已归属" },
  { id: "DETAIL-LB-008", file: "空运头程（力宝.xls", sheet: "对帐单", row: 8, date: "2026-06-30", fee: "收送打包费", raw: "货物收送费/打包费", keyType: "账单号", key: "JLAED2661170", amount: "800.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74276591", status: "已归属" },
  { id: "DETAIL-LB-009", file: "空运头程（力宝.xls", sheet: "对帐单", row: 8, date: "2026-06-30", fee: "中港运输费", raw: "中港段费", keyType: "账单号", key: "JLAED2661170", amount: "60.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74276591", status: "已归属" },
  { id: "DETAIL-LB-010", file: "空运头程（力宝.xls", sheet: "对帐单", row: 8, date: "2026-06-30", fee: "报关费", raw: "报关费", keyType: "账单号", key: "JLAED2661170", amount: "200.000", currency: "CNY", type: "直接成本", target: "业务订单 297-74276591", status: "已归属" },

  { id: "DETAIL-TRK-001", file: "海快租车（仓库送船公司.xlsx", sheet: "租车", row: 9, date: "2026-05", fee: "租车费", raw: "厦门", keyType: "月份", key: "2026年5月", amount: "59,300.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-01", status: "待分摊" },
  { id: "DETAIL-TRK-002", file: "海快租车（仓库送船公司.xlsx", sheet: "租车", row: 9, date: "2026-05", fee: "租车费", raw: "福建", keyType: "月份", key: "2026年5月", amount: "21,200.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-01", status: "待分摊" },
  { id: "DETAIL-TRK-003", file: "海快租车（仓库送船公司.xlsx", sheet: "租车", row: 9, date: "2026-05", fee: "租车费", raw: "泉州", keyType: "月份", key: "2026年5月", amount: "13,100.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-01", status: "待分摊" },
  { id: "DETAIL-TRK-004", file: "海快租车（仓库送船公司.xlsx", sheet: "租车", row: 9, date: "2026-05", fee: "租车费", raw: "9.6米车", keyType: "月份", key: "2026年5月", amount: "12,000.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-01", status: "待分摊" },
  { id: "DETAIL-TRK-005", file: "海快租车（仓库送船公司.xlsx", sheet: "租车", row: 9, date: "2026-05", fee: "租车费", raw: "75方（福州", keyType: "月份", key: "2026年5月", amount: "57,800.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-01", status: "待分摊" },
  { id: "DETAIL-TRK-006", file: "海快租车（仓库送船公司.xlsx", sheet: "租车", row: 9, date: "2026-05", fee: "租车费", raw: "75方（厦门", keyType: "月份", key: "2026年5月", amount: "56,700.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-01", status: "待分摊" },
  { id: "DETAIL-TRK-007", file: "海快租车（仓库送船公司.xlsx", sheet: "租车", row: 9, date: "2026-05", fee: "租车费", raw: "龙海发车合计", keyType: "月份", key: "2026年5月", amount: "14,400.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-01", status: "待分摊" },

  { id: "DETAIL-BY-001", file: "海快（深圳搬运工.xlsx", sheet: "Sheet1", row: 3, date: "2026-05", fee: "租车费", raw: "17.5米车费用", keyType: "月份", key: "2026年5月", amount: "10,800.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-02", status: "待分摊" },
  { id: "DETAIL-BY-002", file: "海快（深圳搬运工.xlsx", sheet: "Sheet1", row: 3, date: "2026-05", fee: "租车费", raw: "70方车费用", keyType: "月份", key: "2026年5月", amount: "5,600.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-02", status: "待分摊" },
  { id: "DETAIL-BY-003", file: "海快（深圳搬运工.xlsx", sheet: "Sheet1", row: 3, date: "2026-05", fee: "搬运费", raw: "其他", keyType: "月份", key: "2026年5月", amount: "1,100.000", currency: "CNY", type: "间接成本", target: "SET-TRK-202605-02", status: "待分摊" },

  ...["海快清关（东风.xls", "空运清关（东风.xls"].flatMap((file, fileIndex) => [
    { id: `DETAIL-DFC-${fileIndex + 1}-001`, file, sheet: "稅金", row: 5, date: "2026-06-19", fee: "进口税费", raw: "稅費金額", keyType: "分提單號", key: "DZD90351936", amount: "399.000", currency: "TWD", type: "直接成本", target: "业务订单 DZD90351936", status: "已归属" },
    { id: `DETAIL-DFC-${fileIndex + 1}-002`, file, sheet: "稅金", row: 6, date: "2026-06-19", fee: "进口税费", raw: "稅費金額", keyType: "分提單號", key: "DZD90351159", amount: "197.000", currency: "TWD", type: "直接成本", target: "业务订单 DZD90351159", status: "已归属" },
    { id: `DETAIL-DFC-${fileIndex + 1}-003`, file, sheet: "稅金", row: 7, date: "2026-06-19", fee: "进口税费", raw: "稅費金額", keyType: "分提單號", key: "DZD90351161", amount: "210.000", currency: "TWD", type: "直接成本", target: "业务订单 DZD90351161", status: "已归属" },
    { id: `DETAIL-DFC-${fileIndex + 1}-004`, file, sheet: "稅金", row: 8, date: "2026-06-19", fee: "进口税费", raw: "稅費金額", keyType: "分提單號", key: "DZD90351898", amount: "181.000", currency: "TWD", type: "直接成本", target: "业务订单 DZD90351898", status: "已归属" }
  ])
];

const pools = [
  { id: "SET-DEL-202605-01", bill: bills[0].id, supplier: "东风", board: "派送成本", fee: "车趟费", currency: "TWD", detailCount: 1, scope: "2026-05-16 至 2026-05-31 的拖柜专车费用", amount: "132,625.000 TWD", orders: 0, treatment: "分摊至业务订单", noAllocationReason: "", ruleId: "RULE-SP-DF-001", factor: "订单占用体积", fallback: "订单计费重", status: "待分摊", version: "-" },
  { id: "SET-SEA-DECL-01", bill: bills[5].id, supplier: "联多", board: "海运成本", fee: "报关费", currency: "CNY", detailCount: 6, scope: "6 个报关单号", amount: "720.000 CNY", orders: 0, treatment: "分摊至业务订单", noAllocationReason: "", ruleId: "", factor: "-", fallback: "-", status: "待人工确认", version: "-" },
  { id: "SET-SEA-OPS-01", bill: bills[5].id, supplier: "联多", board: "海运成本", fee: "操作费", currency: "CNY", detailCount: 6, scope: "6 个报关单号", amount: "1,274.120 CNY", orders: 0, treatment: "不分摊", noAllocationReason: "公司整体管理费用", noAllocationNote: "", treatmentConfirmedBy: "谭清辉", treatmentConfirmedAt: "2026-07-18 15:20:00", ruleId: "", factor: "-", fallback: "-", status: "不分摊", version: "-" },
  { id: "SET-SEA-FREIGHT-01", bill: bills[5].id, supplier: "联多", board: "海运成本", fee: "海运费", currency: "CNY", detailCount: 63, scope: "2026-06-16 至 2026-06-30 的提单与货柜", amount: "629,000.000 CNY", orders: 0, treatment: "分摊至业务订单", noAllocationReason: "", ruleId: "RULE-SEA-001", factor: "订单计费吨", fallback: "订单体积", status: "待分摊", version: "-" },
  { id: "SET-SEA-GENERAL-01", bill: bills[5].id, supplier: "联多", board: "海运成本", fee: "普货海运费", currency: "CNY", detailCount: 1, scope: "提单 YGK26062597EX", amount: "10,000.000 CNY", orders: 0, ruleId: "", factor: "-", fallback: "-", status: "待人工确认", version: "-" },
  { id: "SET-SEA-TRAILER-01", bill: bills[5].id, supplier: "联多", board: "海运成本", fee: "拖柜费", currency: "CNY", detailCount: 44, scope: "44 个货柜", amount: "22,000.000 CNY", orders: 0, ruleId: "", factor: "-", fallback: "-", status: "待人工确认", version: "-" },
  { id: "SET-SEA-DEST-01", bill: bills[5].id, supplier: "联多", board: "海运成本", fee: "目的港拖车费", currency: "CNY", detailCount: 1, scope: "提单 YGK26062597EX", amount: "1,600.000 CNY", orders: 0, ruleId: "", factor: "-", fallback: "-", status: "待人工确认", version: "-" },
  { id: "SET-TRK-202605-01", bill: bills[7].id, supplier: "仓库送船公司", board: "租车成本", fee: "租车费", currency: "CNY", detailCount: 7, scope: "2026 年 5 月深圳及福建方向租车费用", amount: "234,500.000 CNY", orders: 0, ruleId: "RULE-TRK-001", factor: "订单计费重", fallback: "订单数", status: "待分摊", version: "-" },
  { id: "SET-TRK-202605-02", bill: bills[8].id, supplier: "深圳搬运工", board: "租车成本", fee: "租车费", currency: "CNY", detailCount: 3, scope: "2026 年 5 月车辆与搬运费用", amount: "17,500.000 CNY", orders: 0, ruleId: "RULE-TRK-001", factor: "订单计费重", fallback: "订单数", status: "待分摊", version: "-" }
];

const allocationRules = [
  { id: "RULE-DEL-001", board: "派送成本", fee: "车趟费", supplier: "全部供应商", scope: "同一集运线路、目的国和成本账期内的业务订单", factor: "订单计费重", fallback: "订单包裹数", rounding: "最大余数法", effective: "2026-01-01 起", status: "启用" },
  { id: "RULE-CLR-001", board: "清关成本", fee: "仓租", supplier: "全部供应商", scope: "同一柜号或同一清关批次覆盖的业务订单", factor: "占用量 × 仓储天数", fallback: "订单计费重", rounding: "最大余数法", effective: "2026-01-01 起", status: "启用" },
  { id: "RULE-SEA-001", board: "海运成本", fee: "海运费", supplier: "全部供应商", scope: "同一提单或货柜覆盖的业务订单", factor: "订单计费吨", fallback: "订单体积", rounding: "最大余数法", effective: "2026-01-01 起", status: "启用" },
  { id: "RULE-AIR-001", board: "空运成本", fee: "中港运输费", supplier: "全部供应商", scope: "同一主运单覆盖的业务订单", factor: "空运计费重", fallback: "订单实重", rounding: "最大余数法", effective: "2026-01-01 起", status: "启用" },
  { id: "RULE-TRK-001", board: "租车成本", fee: "租车费", supplier: "全部供应商", scope: "同一仓库、集运线路和成本账期内的业务订单", factor: "订单计费重", fallback: "订单数", rounding: "最大余数法", effective: "2026-01-01 起", status: "启用" },
  { id: "RULE-SP-DF-001", board: "派送成本", fee: "车趟费", supplier: "东风", scope: "同一车次实际装载且已交接给东风的业务订单", factor: "订单占用体积", fallback: "订单计费重", rounding: "最大余数法", effective: "2026-06-01 起", status: "启用" },
  { id: "RULE-SP-FG-001", board: "清关成本", fee: "仓租", supplier: "福广", scope: "同一柜号内实际产生监管仓占用天数的业务订单", factor: "占用量 × 仓储天数", fallback: "订单计费重", rounding: "最大余数法", effective: "2026-07-01 起", status: "启用" },
  { id: "RULE-SP-LB-001", board: "空运成本", fee: "中港运输费", supplier: "力宝", scope: "同一主运单下已完成中港段交接的业务订单", factor: "空运计费重", fallback: "订单实重", rounding: "最大余数法", effective: "2026-07-01 起", status: "启用" }
];

const fees = [
  { code: "COST-DEL-001", name: "派送费", board: "派送成本", definition: "尾程包裹配送产生的基础运费。", remark: "按尾程运单归属。", rules: 3, references: 1532, status: "启用", updatedAt: "2026-07-10 16:20" },
  { code: "COST-DEL-006", name: "超才费", board: "派送成本", definition: "尾程包裹超过供应商尺寸或材积限制后加收的费用。", remark: "供应商也可能写作超大或材积附加。", rules: 1, references: 186, status: "启用", updatedAt: "2026-07-08 11:35" },
  { code: "COST-DEL-002", name: "偏远费", board: "派送成本", definition: "偏远地区或特殊送达区域产生的附加配送费用。", remark: "与偏远附加、偏远区加收同口径。", rules: 1, references: 94, status: "启用", updatedAt: "2026-07-08 12:02" },
  { code: "COST-DEL-003", name: "跨区费", board: "派送成本", definition: "跨越供应商基础配送区间后收取的附加费用。", remark: "包含跨区、跨区附加等表达。", rules: 1, references: 67, status: "启用", updatedAt: "2026-07-08 12:15" },
  { code: "COST-DEL-004", name: "转发费", board: "派送成本", definition: "包裹因转运、改派或二次投递产生的费用。", remark: "常见于改派、转单或中转服务。", rules: 1, references: 52, status: "启用", updatedAt: "2026-07-08 12:25" },
  { code: "COST-DEL-005", name: "手续费", board: "派送成本", definition: "代收、改单或其他派送附带服务产生的手续费。", remark: "通常与代收、改单和服务处理相关。", rules: 1, references: 43, status: "启用", updatedAt: "2026-07-08 12:34" },
  { code: "COST-DEL-007", name: "车趟费", board: "派送成本", definition: "派送或转运过程中按车趟发生的运输费用。", remark: "常见于车趟、拖袋或批量操作场景。", rules: 3, references: 386, status: "启用", updatedAt: "2026-07-10 16:32" },
  { code: "COST-DEL-008", name: "续仓费", board: "派送成本", definition: "货物在仓库或集货点续存期间产生的费用。", remark: "供应商也可能写作续仓费用。", rules: 1, references: 141, status: "启用", updatedAt: "2026-07-09 11:08" },
  { code: "COST-DEL-009", name: "货故赔款", board: "派送成本", definition: "因货损、货故或遗失而向客户或供应商承担的赔款。", remark: "属于事件型费用。", rules: 1, references: 29, status: "启用", updatedAt: "2026-07-08 17:20" },
  { code: "COST-DEL-010", name: "批量贴单费", board: "派送成本", definition: "批量贴标、贴单、分拣或拖袋作业产生的费用。", remark: "供应商可能拆写为贴单费、拖袋费。", rules: 2, references: 43, status: "启用", updatedAt: "2026-07-08 17:28" },
  { code: "COST-DEL-011", name: "拖袋费", board: "派送成本", definition: "袋件搬运、拖袋或袋间转运产生的费用。", remark: "常见于批量派送场景。", rules: 1, references: 37, status: "启用", updatedAt: "2026-07-08 17:31" },
  { code: "COST-DEL-012", name: "账务调整", board: "派送成本", definition: "派送账单中的冲补差、调账或其他账务修正金额。", remark: "保留原始账务调整口径。", rules: 1, references: 12, status: "启用", updatedAt: "2026-07-08 17:35" },

  { code: "COST-CLR-001", name: "清关费", board: "清关成本", definition: "货物进出口清关或申报环节产生的基础服务费。", remark: "不得与税金、仓租混合。", rules: 2, references: 176, status: "启用", updatedAt: "2026-07-12 09:12" },
  { code: "COST-CLR-002", name: "进口税费", board: "清关成本", definition: "货物进口申报产生并由供应商代垫或代收的关税、进口税等税款。", remark: "不得与报关服务费合并。", rules: 2, references: 398, status: "启用", updatedAt: "2026-07-12 09:18" },
  { code: "COST-CLR-003", name: "报关费", board: "清关成本", definition: "货物报关、代报或申报服务产生的费用。", remark: "与税金分开维护。", rules: 2, references: 224, status: "启用", updatedAt: "2026-07-12 09:22" },
  { code: "COST-CLR-008", name: "仓租", board: "清关成本", definition: "货物在清关或查验期间占用监管仓、机场仓产生的仓储费用。", remark: "通常作为间接成本按业务订单分摊。", rules: 4, references: 65, status: "启用", updatedAt: "2026-07-11 14:06" },
  { code: "COST-CLR-004", name: "规费", board: "清关成本", definition: "清关过程中产生的规费、行政费或代办费。", remark: "与税金、罚款、仓租分开。", rules: 1, references: 76, status: "启用", updatedAt: "2026-07-11 14:16" },
  { code: "COST-CLR-005", name: "罚款", board: "清关成本", definition: "因申报、时效或合规原因产生的处罚费用。", remark: "保留处罚依据。", rules: 1, references: 58, status: "启用", updatedAt: "2026-07-11 14:22" },
  { code: "COST-CLR-006", name: "移仓费", board: "清关成本", definition: "货物转移监管仓、换仓或挪仓产生的费用。", remark: "按受影响范围归属。", rules: 1, references: 49, status: "启用", updatedAt: "2026-07-11 14:28" },
  { code: "COST-CLR-007", name: "退运费", board: "清关成本", definition: "货物退运、返运或撤单过程中发生的费用。", remark: "按退运事件归属。", rules: 1, references: 36, status: "启用", updatedAt: "2026-07-11 14:34" },
  { code: "COST-CLR-009", name: "实名认证费", board: "清关成本", definition: "EZ Way 或其他实名认证、身份核验产生的费用。", remark: "保留认证平台口径。", rules: 1, references: 31, status: "启用", updatedAt: "2026-07-11 14:40" },

  { code: "COST-SEA-001", name: "海运费", board: "海运成本", definition: "供应商承运海运主程产生的基础运输费用。", remark: "与空运板块的同名费项分别维护。", rules: 2, references: 66, status: "启用", updatedAt: "2026-07-06 17:42" },
  { code: "COST-SEA-002", name: "拖柜费", board: "海运成本", definition: "集装箱拖车、拖柜或港区调柜产生的费用。", remark: "与柜号、提单号联动。", rules: 1, references: 27, status: "启用", updatedAt: "2026-07-06 18:00" },
  { code: "COST-SEA-003", name: "续单费", board: "海运成本", definition: "海运单证续开、续单或补单产生的费用。", remark: "按提单或订单范围归属。", rules: 1, references: 21, status: "启用", updatedAt: "2026-07-06 18:08" },
  { code: "COST-SEA-004", name: "操作费", board: "海运成本", definition: "海运操作、装卸、文件处理或中转操作产生的费用。", remark: "通常为整票或整柜费用。", rules: 1, references: 18, status: "启用", updatedAt: "2026-07-06 18:16" },
  { code: "COST-SEA-005", name: "文件费", board: "海运成本", definition: "海运单证、文件、资料或出单服务产生的费用。", remark: "与操作费可分开维护。", rules: 1, references: 12, status: "启用", updatedAt: "2026-07-06 18:22" },
  { code: "COST-SEA-006", name: "报关费", board: "海运成本", definition: "海运业务对应的报关、代报或申报费用。", remark: "与海运费分开维护。", rules: 1, references: 8, status: "启用", updatedAt: "2026-07-06 18:26" },

  { code: "COST-AIR-001", name: "空运费", board: "空运成本", definition: "空运主程产生的基础运输费用。", remark: "与海运费分别维护。", rules: 2, references: 84, status: "启用", updatedAt: "2026-07-05 10:12" },
  { code: "COST-AIR-002", name: "提单费", board: "空运成本", definition: "空运提单、分单或单证处理产生的费用。", remark: "可与账单费并存。", rules: 1, references: 88, status: "启用", updatedAt: "2026-07-05 10:17" },
  { code: "COST-AIR-003", name: "中港段费", board: "空运成本", definition: "空运货物由内地集货点运往香港机场或操作仓产生的运输费用。", remark: "间接成本按所属账单、标准成本费项和币种进入分摊集。", rules: 1, references: 88, status: "启用", updatedAt: "2026-07-05 10:27" },
  { code: "COST-AIR-004", name: "收送费", board: "空运成本", definition: "空运收件、派送、收货或送货环节发生的费用。", remark: "可按收送范围归属。", rules: 1, references: 59, status: "启用", updatedAt: "2026-07-05 10:33" },
  { code: "COST-AIR-005", name: "打包费", board: "空运成本", definition: "空运打包、包装、加固或分箱产生的费用。", remark: "与订单包装范围相关。", rules: 1, references: 41, status: "启用", updatedAt: "2026-07-05 10:40" },
  { code: "COST-AIR-006", name: "报关费", board: "空运成本", definition: "空运业务对应的报关或申报费用。", remark: "与空运费分开维护。", rules: 1, references: 24, status: "启用", updatedAt: "2026-07-05 10:45" },
  { code: "COST-AIR-007", name: "压夜费", board: "空运成本", definition: "航班压夜、过夜或暂存等待产生的费用。", remark: "通常按主单或批次归属。", rules: 1, references: 19, status: "启用", updatedAt: "2026-07-05 10:52" },
  { code: "COST-AIR-008", name: "查验费", board: "空运成本", definition: "空运货物查验、复查或现场处理产生的费用。", remark: "按查验事件归属。", rules: 1, references: 13, status: "启用", updatedAt: "2026-07-05 10:58" },
  { code: "COST-AIR-009", name: "文件费", board: "空运成本", definition: "空运单证、文件或资料处理产生的费用。", remark: "与提单费可并存。", rules: 1, references: 9, status: "启用", updatedAt: "2026-07-05 11:04" },

  { code: "COST-TRK-001", name: "租车费", board: "租车成本", definition: "因仓库提送、码头交接或履约调拨而租用车辆产生的费用。", remark: "车型差异通过供应商映射保留。", rules: 2, references: 26, status: "启用", updatedAt: "2026-07-03 10:25" },
  { code: "COST-TRK-002", name: "搬运费", board: "租车成本", definition: "仓库装卸、搬运、上下车或人工协作产生的费用。", remark: "与车型费分开维护。", rules: 1, references: 14, status: "启用", updatedAt: "2026-07-03 10:31" },
  { code: "COST-TRK-003", name: "等待费", board: "租车成本", definition: "车辆等待、压车、排队或滞留产生的费用。", remark: "按实际等待时长或车次归属。", rules: 1, references: 11, status: "启用", updatedAt: "2026-07-03 10:36" },
  { code: "COST-TRK-004", name: "月度补差", board: "租车成本", definition: "按月最低消费、保底或账期补差产生的费用。", remark: "按月度账单口径归集。", rules: 1, references: 7, status: "启用", updatedAt: "2026-07-03 10:42" },
  { code: "COST-TRK-005", name: "里程费", board: "租车成本", definition: "按运输里程、路线或里程单价计费的费用。", remark: "常见于长途或计里程租车。", rules: 1, references: 4, status: "启用", updatedAt: "2026-07-03 10:48" }
];

const feeAliases = [
  { id: "ALIAS-DEL-001", supplier: "东风", board: "派送成本", rawName: "運費", feeCode: "COST-DEL-001", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 3, confirmer: "谭清辉", confirmedAt: "2026-07-10 16:20", note: "基础派送费用" },
  { id: "ALIAS-DEL-002", supplier: "宅配通", board: "派送成本", rawName: "本款", feeCode: "COST-DEL-001", structure: "宅配通派送明细", sheet: "5月明細", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-09 10:12", note: "账单中的基础运费列" },
  { id: "ALIAS-DEL-003", supplier: "顺盛", board: "派送成本", rawName: "宅配運費", feeCode: "COST-DEL-001", structure: "顺盛派送账单", sheet: "Sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 15:40", note: "" },
  { id: "ALIAS-DEL-004", supplier: "东风", board: "派送成本", rawName: "超才費", feeCode: "COST-DEL-006", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-08 11:35", note: "超过材积限制" },
  { id: "ALIAS-DEL-005", supplier: "宅配通", board: "派送成本", rawName: "超大", feeCode: "COST-DEL-006", structure: "宅配通派送明细", sheet: "5月明細", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-07 09:22", note: "" },
  { id: "ALIAS-DEL-006", supplier: "顺盛", board: "派送成本", rawName: "材积附加", feeCode: "COST-DEL-006", structure: "顺盛派送账单", sheet: "Sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-07 09:28", note: "" },
  { id: "ALIAS-DEL-007", supplier: "宅配通", board: "派送成本", rawName: "偏遠費", feeCode: "COST-DEL-002", structure: "宅配通派送明细", sheet: "5月明細", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 12:02", note: "" },
  { id: "ALIAS-DEL-008", supplier: "顺盛", board: "派送成本", rawName: "跨區費", feeCode: "COST-DEL-003", structure: "顺盛派送账单", sheet: "Sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 12:15", note: "" },
  { id: "ALIAS-DEL-009", supplier: "东风", board: "派送成本", rawName: "轉發費", feeCode: "COST-DEL-004", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 12:25", note: "" },
  { id: "ALIAS-DEL-010", supplier: "东风", board: "派送成本", rawName: "手續費", feeCode: "COST-DEL-005", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 12:34", note: "" },
  { id: "ALIAS-DEL-011", supplier: "东风", board: "派送成本", rawName: "車趟費", feeCode: "COST-DEL-007", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-10 16:32", note: "" },
  { id: "ALIAS-DEL-012", supplier: "东风", board: "派送成本", rawName: "續倉費用", feeCode: "COST-DEL-008", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-09 11:08", note: "" },
  { id: "ALIAS-DEL-013", supplier: "东风", board: "派送成本", rawName: "貼單拖袋費", feeCode: "COST-DEL-010", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 17:28", note: "" },
  { id: "ALIAS-DEL-014", supplier: "东风", board: "派送成本", rawName: "拖袋費", feeCode: "COST-DEL-011", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 17:31", note: "" },
  { id: "ALIAS-DEL-015", supplier: "东风", board: "派送成本", rawName: "帳務調整", feeCode: "COST-DEL-012", structure: "台湾端派送月账单", sheet: "黑貓", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-08 17:35", note: "" },

  { id: "ALIAS-CLR-001", supplier: "东风", board: "清关成本", rawName: "清關費", feeCode: "COST-CLR-001", structure: "东风清关账单", sheet: "清關費", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-12 09:12", note: "" },
  { id: "ALIAS-CLR-002", supplier: "东风", board: "清关成本", rawName: "稅金", feeCode: "COST-CLR-002", structure: "东风清关账单", sheet: "清關費", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-12 09:18", note: "进口税款" },
  { id: "ALIAS-CLR-003", supplier: "福广", board: "清关成本", rawName: "税费", feeCode: "COST-CLR-002", structure: "福广请款单", sheet: "稅金明細", status: "启用", version: 3, confirmer: "谭清辉", confirmedAt: "2026-07-12 09:16", note: "" },
  { id: "ALIAS-CLR-004", supplier: "福广", board: "清关成本", rawName: "關稅", feeCode: "COST-CLR-002", structure: "福广请款单", sheet: "規費請款單", status: "停用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-06-30 17:05", note: "供应商已拆分到税费字段" },
  { id: "ALIAS-CLR-005", supplier: "福广", board: "清关成本", rawName: "報關費", feeCode: "COST-CLR-003", structure: "福广请款单", sheet: "請款單(總)", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-11 13:52", note: "" },
  { id: "ALIAS-CLR-006", supplier: "东风", board: "清关成本", rawName: "倉租", feeCode: "COST-CLR-008", structure: "东风清关账单", sheet: "清關費", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-11 14:06", note: "" },
  { id: "ALIAS-CLR-007", supplier: "福广", board: "清关成本", rawName: "萬海倉租", feeCode: "COST-CLR-008", structure: "福广请款单", sheet: "請款單(總)", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-11 13:58", note: "万海码头仓租" },
  { id: "ALIAS-CLR-008", supplier: "福广", board: "清关成本", rawName: "遠雄倉租", feeCode: "COST-CLR-008", structure: "福广请款单", sheet: "請款單(總)", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-11 13:59", note: "远雄机场仓租" },
  { id: "ALIAS-CLR-009", supplier: "东风", board: "清关成本", rawName: "規費請款單", feeCode: "COST-CLR-004", structure: "东风清关账单", sheet: "規費請款單", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-11 14:16", note: "" },
  { id: "ALIAS-CLR-010", supplier: "福广", board: "清关成本", rawName: "罰單", feeCode: "COST-CLR-005", structure: "福广请款单", sheet: "罰單", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-11 14:22", note: "" },
  { id: "ALIAS-CLR-011", supplier: "东风", board: "清关成本", rawName: "移倉費", feeCode: "COST-CLR-006", structure: "东风清关账单", sheet: "清關費", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-11 14:28", note: "" },
  { id: "ALIAS-CLR-012", supplier: "东风", board: "清关成本", rawName: "退運費用", feeCode: "COST-CLR-007", structure: "东风清关账单", sheet: "清關費", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-11 14:34", note: "" },
  { id: "ALIAS-CLR-013", supplier: "福广", board: "清关成本", rawName: "EZ Way 明細", feeCode: "COST-CLR-009", structure: "福广请款单", sheet: "EZ Way 明細", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-11 14:40", note: "" },

  { id: "ALIAS-SEA-001", supplier: "联多", board: "海运成本", rawName: "海運費", feeCode: "COST-SEA-001", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-06 17:42", note: "" },
  { id: "ALIAS-SEA-002", supplier: "联多", board: "海运成本", rawName: "普貨海運費", feeCode: "COST-SEA-001", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-06 17:43", note: "普货主程运费" },
  { id: "ALIAS-SEA-003", supplier: "联多", board: "海运成本", rawName: "拖櫃費", feeCode: "COST-SEA-002", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-06 17:52", note: "" },
  { id: "ALIAS-SEA-004", supplier: "联多", board: "海运成本", rawName: "續單費", feeCode: "COST-SEA-003", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-06 17:58", note: "" },
  { id: "ALIAS-SEA-005", supplier: "联多", board: "海运成本", rawName: "操作費", feeCode: "COST-SEA-004", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-06 18:02", note: "" },
  { id: "ALIAS-SEA-006", supplier: "联多", board: "海运成本", rawName: "文件費", feeCode: "COST-SEA-005", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-06 18:05", note: "" },
  { id: "ALIAS-SEA-007", supplier: "联多", board: "海运成本", rawName: "報關費", feeCode: "COST-SEA-006", structure: "联多海运对账单", sheet: "sheet1", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-06 18:06", note: "" },

  { id: "ALIAS-AIR-001", supplier: "力宝", board: "空运成本", rawName: "空運費", feeCode: "COST-AIR-001", structure: "力宝空运账单", sheet: "对帐单", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:12", note: "" },
  { id: "ALIAS-AIR-002", supplier: "力宝", board: "空运成本", rawName: "提單費", feeCode: "COST-AIR-002", structure: "力宝空运账单", sheet: "对帳单", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:17", note: "" },
  { id: "ALIAS-AIR-003", supplier: "力宝", board: "空运成本", rawName: "中港段費", feeCode: "COST-AIR-003", structure: "力宝空运账单", sheet: "对帳单", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:27", note: "" },
  { id: "ALIAS-AIR-004", supplier: "力宝", board: "空运成本", rawName: "中港車費", feeCode: "COST-AIR-003", structure: "力宝空运账单", sheet: "费用明细", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:28", note: "" },
  { id: "ALIAS-AIR-005", supplier: "力宝", board: "空运成本", rawName: "收送費", feeCode: "COST-AIR-004", structure: "力宝空运账单", sheet: "费用明细", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:33", note: "" },
  { id: "ALIAS-AIR-006", supplier: "力宝", board: "空运成本", rawName: "打包費", feeCode: "COST-AIR-005", structure: "力宝空运账单", sheet: "费用明细", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:40", note: "" },
  { id: "ALIAS-AIR-007", supplier: "力宝", board: "空运成本", rawName: "報關費", feeCode: "COST-AIR-006", structure: "力宝空运账单", sheet: "对帳單", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:45", note: "" },
  { id: "ALIAS-AIR-008", supplier: "力宝", board: "空运成本", rawName: "壓夜費", feeCode: "COST-AIR-007", structure: "力宝空运账单", sheet: "费用明细", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:52", note: "" },
  { id: "ALIAS-AIR-009", supplier: "力宝", board: "空运成本", rawName: "查驗費", feeCode: "COST-AIR-008", structure: "力宝空运账单", sheet: "费用明细", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 10:58", note: "" },
  { id: "ALIAS-AIR-010", supplier: "力宝", board: "空运成本", rawName: "文件費", feeCode: "COST-AIR-009", structure: "力宝空运账单", sheet: "费用明细", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-05 11:04", note: "" },

  { id: "ALIAS-TRK-001", supplier: "仓库送船公司", board: "租车成本", rawName: "9.6米車", feeCode: "COST-TRK-001", structure: "租车月结单", sheet: "租车", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:25", note: "" },
  { id: "ALIAS-TRK-002", supplier: "仓库送船公司", board: "租车成本", rawName: "17.5米車", feeCode: "COST-TRK-001", structure: "租车月结单", sheet: "租车", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:25", note: "" },
  { id: "ALIAS-TRK-003", supplier: "仓库送船公司", board: "租车成本", rawName: "70方車", feeCode: "COST-TRK-001", structure: "租车月结单", sheet: "租车", status: "启用", version: 2, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:25", note: "" },
  { id: "ALIAS-TRK-004", supplier: "仓库送船公司", board: "租车成本", rawName: "搬運費", feeCode: "COST-TRK-002", structure: "租车月结单", sheet: "租车", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:31", note: "" },
  { id: "ALIAS-TRK-005", supplier: "仓库送船公司", board: "租车成本", rawName: "等待費", feeCode: "COST-TRK-003", structure: "租车月结单", sheet: "租车", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:36", note: "" },
  { id: "ALIAS-TRK-006", supplier: "仓库送船公司", board: "租车成本", rawName: "月度補差", feeCode: "COST-TRK-004", structure: "租车月结单", sheet: "租车", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:42", note: "" },
  { id: "ALIAS-TRK-007", supplier: "仓库送船公司", board: "租车成本", rawName: "里程費", feeCode: "COST-TRK-005", structure: "租车月结单", sheet: "租车", status: "启用", version: 1, confirmer: "谭清辉", confirmedAt: "2026-07-03 10:48", note: "" }
];

const state = { view: "overview", selectedBillId: "", billDetailTab: "summary", wizardStep: 1, selectedFile: "df-delivery", selectedSheet: "黑貓", costPeriodStart: "2026-05-16", costPeriodEnd: "2026-05-31", inferredCostPeriodStart: "2026-05-16", inferredCostPeriodEnd: "2026-05-31", costPeriodAdjusted: false, costPeriodDifferenceNote: "", supplierPeriodStart: "2026-04-21", supplierPeriodEnd: "2026-06-30", supplierCycleAnchor: "2026-01-01", billPeriodStart: "2026-04-21", billPeriodEnd: "2026-06-30", profitPeriodStart: "2026-04-21", profitPeriodEnd: "2026-06-30", billFilter: "全部", ruleTab: "base", ruleBoard: "", ruleKeyword: "", ruleSupplier: "", ruleStatus: "", feeTab: "index", feeCodeKeyword: "", feeNameKeyword: "", feeBoard: "", feeStatus: "", aliasKeyword: "", aliasSupplier: "", aliasBoard: "", aliasStatus: "", sidebarOpen: false, pendingAction: null };
const routeNames = { overview: "成本总览", suppliers: "供应商管理", bills: "成本账单", billDetail: "成本账单详情", pool: "成本池", rules: "分摊规则", profit: "利润分析", fees: "成本费项索引" };
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
prototypeDb.version(3).stores({
  allocationRules: "&id,board,fee,supplier,status"
});

const cloneData = value => JSON.parse(JSON.stringify(value));
const initialData = {
  sampleFiles: cloneData(sampleFiles),
  suppliers: cloneData(suppliers),
  bills: cloneData(bills),
  costs: cloneData(costs),
  pools: cloneData(pools),
  allocationRules: cloneData(allocationRules),
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
    await prototypeDb.settings.put({ key: "seedVersion", value: 13 });
    await prototypeDb.operationLogs.add({ entityType: "系统", entityId: "成本中心原型", action: force ? "恢复初始模拟数据" : "初始化模拟数据", createdAt: new Date().toISOString() });
  });
}

async function initializePrototypeDatabase() {
  await prototypeDb.open();
  const seedState = await prototypeDb.settings.get("seedVersion");
  if (!seedState) await seedPrototypeDatabase();
  else if (Number(seedState.value) < 13) await seedPrototypeDatabase(true);
  await hydratePrototypeData();
}

async function hydratePrototypeData() {
  for (const tableName of dataTableNames) replaceArray(window[tableName] || ({ sampleFiles, suppliers, bills, costs, pools, allocationRules, fees, feeAliases })[tableName], await prototypeDb.table(tableName).toArray());
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
const numericAmount = value => Number(String(value ?? 0).replaceAll(",", "")) || 0;
const formatAmount = (value, decimals = 3) => Number(value).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const sumRows = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
const DAY_MS = 24 * 60 * 60 * 1000;
const utcDate = (year, month, day) => new Date(Date.UTC(year, month, day));
const formatDate = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
function currentSupplierPeriod(supplier, today = new Date()) {
  const current = utcDate(today.getFullYear(), today.getMonth(), today.getDate());
  let start;
  let end;
  if (supplier.cycle === "周") {
    const daysSinceMonday = (current.getUTCDay() + 6) % 7;
    start = new Date(current.getTime() - daysSinceMonday * DAY_MS);
    end = new Date(start.getTime() + 6 * DAY_MS);
  } else if (supplier.cycle === "半月") {
    const firstDay = current.getUTCDate() <= 15 ? 1 : 16;
    const lastDay = firstDay === 1 ? 15 : new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
    start = utcDate(current.getUTCFullYear(), current.getUTCMonth(), firstDay);
    end = utcDate(current.getUTCFullYear(), current.getUTCMonth(), lastDay);
  } else if (supplier.cycle === "月") {
    start = utcDate(current.getUTCFullYear(), current.getUTCMonth(), 1);
    end = utcDate(current.getUTCFullYear(), current.getUTCMonth() + 1, 0);
  } else {
    const naturalDays = Number(supplier.cycle.match(/^(\d+) 自然天$/)?.[1]);
    const anchor = supplier.cycleAnchor ? new Date(`${supplier.cycleAnchor}T00:00:00Z`) : null;
    if (!naturalDays || !anchor || Number.isNaN(anchor.getTime())) return "待完善账期参数";
    const cycleIndex = Math.floor((current.getTime() - anchor.getTime()) / DAY_MS / naturalDays);
    start = new Date(anchor.getTime() + cycleIndex * naturalDays * DAY_MS);
    end = new Date(start.getTime() + (naturalDays - 1) * DAY_MS);
  }
  return `${formatDate(start)} 至 ${formatDate(end)}`;
}
function amountsByCurrency(rows, field = "amount") {
  return rows.reduce((totals, row) => {
    totals[row.currency] = (totals[row.currency] || 0) + numericAmount(row[field]);
    return totals;
  }, {});
}
const statusClass = (value) => {
  if (["已结清", "已归属", "已分摊", "不分摊", "启用", "成本已齐"].includes(value)) return "success";
  if (["待结清", "待分摊", "待人工确认", "成本未齐"].includes(value)) return "warning";
  if (["失败", "停用", "无法匹配"].includes(value)) return "danger";
  return "info";
};
const tag = (text, color = "gray") => `<span class="tag ${color}">${text}</span>`;
const status = (text) => `<span class="status ${statusClass(text)}">${text}</span>`;
function getFeeAliases(feeCode) {
  return feeAliases.filter(item => item.feeCode === feeCode).map(item => item.rawName).filter(Boolean);
}
function renderFeeAliasCell(feeCode) {
  const aliases = getFeeAliases(feeCode);
  if (!aliases.length) return `<span class="fee-alias-empty">-</span>`;
  const preview = aliases.slice(0, 3).map(item => tag(escapeHtml(item), "neutral")).join("");
  const more = aliases.length > 3 ? `<span class="fee-alias-more">+${aliases.length - 3}</span>` : "";
  return `<div class="fee-alias-cell">${preview}${more}</div>`;
}

function normalizeSupplierBoards(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[，,\/|]/).map(item => item.trim()).filter(Boolean);
  return [];
}

function renderSupplierBoardTags(boards) {
  const list = normalizeSupplierBoards(boards);
  return list.length ? list.map((board, index) => tag(board, ["purple", "blue", "green", "orange"][index % 4])).join("") : tag("未配置", "neutral");
}

function getCostBoardLabel(cost) {
  const explicitBoard = cost.board ? (cost.board.endsWith("成本") ? cost.board : `${cost.board}成本`) : "";
  const matchedFee = fees.find(item => item.name === cost.fee && (!explicitBoard || item.board === explicitBoard));
  return matchedFee?.board || explicitBoard || "-";
}

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
  const totalDetails=sumRows(bills,"rows");
  const directDetails=sumRows(bills,"direct");
  const indirectDetails=sumRows(bills,"indirect");
  const pendingAmounts=amountsByCurrency(bills.filter(item=>item.state==="待结清"));
  const pendingSetAmounts=amountsByCurrency(pools.filter(item=>item.status!=="已分摊"));
  const boardTotals=bills.reduce((result,bill)=>{const key=`${bill.board}|${bill.currency}`;result[key]=(result[key]||0)+numericAmount(bill.amount);return result;},{});
  const boardRows=[
    ["派送成本",91,boardTotals["派送成本|TWD"]||0,"TWD",""] ,
    ["清关成本",100,boardTotals["清关成本|TWD"]||0,"TWD","green"],
    ["海运成本",100,boardTotals["海运成本|CNY"]||0,"CNY","blue"],
    ["空运成本",3,boardTotals["空运成本|CNY"]||0,"CNY","orange"],
    ["租车成本",38,boardTotals["租车成本|CNY"]||0,"CNY","red"]
  ];
  return `${pageHeader("成本总览", "供应商收费、成本归属、结清进度与订单利润的统一工作台", `<button class="btn primary" data-view="pool">${icon("database")}处理成本池</button>`)}
    <div class="kpi-grid">
      <div class="kpi-card"><span class="kpi-icon">${icon("files")}</span><div class="kpi-label">样本成本账单</div><div class="kpi-value">${bills.length}<small>份</small></div><div class="kpi-extra">对应 ${sampleFiles.length} 份原始样本文件</div></div>
      <div class="kpi-card warning"><span class="kpi-icon">${icon("circle-dollar-sign")}</span><div class="kpi-label">待结清金额（CNY）</div><div class="kpi-value">${formatAmount((pendingAmounts.CNY||0)/1000,1)}<small>千 CNY</small></div><div class="kpi-extra">另有 ${formatAmount(pendingAmounts.TWD||0)} TWD</div></div>
      <div class="kpi-card info"><span class="kpi-icon">${icon("git-branch")}</span><div class="kpi-label">成本明细</div><div class="kpi-value">${totalDetails.toLocaleString("en-US")}<small>笔</small></div><div class="kpi-extra">直接 ${directDetails.toLocaleString("en-US")} · 间接 ${indirectDetails.toLocaleString("en-US")}</div></div>
      <div class="kpi-card danger"><span class="kpi-icon">${icon("split")}</span><div class="kpi-label">待分摊金额（CNY）</div><div class="kpi-value">${formatAmount((pendingSetAmounts.CNY||0)/1000,1)}<small>千 CNY</small></div><div class="kpi-extra">另有 ${formatAmount(pendingSetAmounts.TWD||0)} TWD</div></div>
      <div class="kpi-card success"><span class="kpi-icon">${icon("badge-check")}</span><div class="kpi-label">待处理分摊集</div><div class="kpi-value">${pools.filter(item=>item.status!=="已分摊").length}<small>个</small></div><div class="kpi-extra">其中 ${pools.filter(item=>!item.ruleId).length} 个待确认规则</div></div>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><span class="panel-title">五大成本板块</span><div class="panel-tools">按财务本位币人民币折算</div></div><div class="panel-body"><div class="cost-bars">
        ${boardRows.map(([n,w,v,currency,c])=>`<div class="cost-bar-row"><span>${n}</span><div class="bar-track"><div class="bar-fill ${c}" style="width:${w}%"></div></div><span class="bar-value">${formatAmount(v)} ${currency}</span></div>`).join("")}
      </div></div></section>
      <section class="panel"><div class="panel-head"><span class="panel-title">待处理事项</span><button class="btn small" data-view="pool">全部处理</button></div><div class="panel-body"><div class="todo-list">
        <div class="todo-item" data-view="bills"><span class="todo-icon danger">${icon("file-x-2")}</span><div><div class="todo-name">待结清账单</div><div class="todo-desc">来源于当前样本文件</div></div><strong class="todo-count">${bills.filter(item=>item.state==="待结清").length}</strong></div>
        <div class="todo-item" data-view="pool"><span class="todo-icon">${icon("link-2-off")}</span><div><div class="todo-name">待确认规则</div><div class="todo-desc">分摊集尚未选定分摊规则</div></div><strong class="todo-count">${pools.filter(item=>!item.ruleId).length}</strong></div>
        <div class="todo-item" data-view="bills"><span class="todo-icon info">${icon("split")}</span><div><div class="todo-name">待执行分摊</div><div class="todo-desc">到账单详情确认并预览</div></div><strong class="todo-count">${pools.filter(item=>item.status!=="已分摊").length}</strong></div>
        <div class="todo-item" data-view="bills"><span class="todo-icon">${icon("badge-alert")}</span><div><div class="todo-name">原始样本文件</div><div class="todo-desc">已全部建立成本账单</div></div><strong class="todo-count">${sampleFiles.length}</strong></div>
      </div></div></section>
    </div>
    <section class="panel"><div class="panel-head"><span class="panel-title">最近供应商账单</span><button class="btn small" data-view="bills">查看全部 ${icon("arrow-right")}</button></div>${billTable(bills.slice(0,5), false)}</section>`;
}

function renderSuppliers() {
  return `${pageHeader("供应商管理", "维护成本账期、适用成本板块及按币种分桶的账单金额", `<button class="btn primary" data-action="new-supplier">${icon("plus")}新增供应商财务档案</button>`)}
  <div class="filter-panel"><div class="filter-grid">
    <div class="field"><label>供应商</label><input class="input" placeholder="供应商编码或名称"></div>
    <div class="field"><label>成本板块</label><select class="select"><option>全部板块</option><option>派送成本</option><option>清关成本</option><option>海运成本</option><option>空运成本</option><option>租车成本</option></select></div>
      <div class="field"><label>成本账期类型</label><select class="select"><option>全部类型</option><option>周</option><option>半月</option><option>月</option><option>自然天</option></select></div>
    <div class="field"><label>状态</label><select class="select"><option>全部状态</option><option>启用</option><option>停用</option></select></div>
  <div class="field"><label>成本账期范围</label><div id="supplier-period-range" class="date-range-control"></div></div>
    <div class="filter-actions"><button class="btn primary">${icon("search")}查询</button><button class="btn">${icon("rotate-ccw")}重置</button></div>
  </div></div>
  <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>供应商编码</th><th>供应商名称</th><th>适用成本板块</th><th>账期类型</th><th>当前成本账期</th><th>默认币种</th><th>成本账单</th><th>待结清金额</th><th>已结清金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${suppliers.map(s=>`<tr><td class="link" data-action="open-supplier" data-id="${s.code}">${s.code}</td><td class="strong">${s.name}</td><td>${renderSupplierBoardTags(s.boards)}</td><td>${s.cycle}</td><td title="按当前日期和供应商账期配置实时推导">${currentSupplierPeriod(s)}</td><td>${s.currency}</td><td class="num">${s.bills}</td><td class="num">${s.pending}</td><td class="num">${s.settled}</td><td>${status(s.state)}</td><td><button class="btn small" data-action="open-supplier" data-id="${s.code}">详情</button></td></tr>`).join("")}
  </tbody></table></div>${tableFooter(suppliers.length)}</section>`;
}

function billTable(rows, selectable = true) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${selectable?"<th><input class=\"row-check\" type=\"checkbox\"></th>":""}<th>成本账单编号</th><th>供应商</th><th>成本板块</th><th>实际成本账期</th><th>账单金额</th><th>已结清金额</th><th>状态</th><th>成本明细</th><th>待处理</th><th>账单日期</th><th>操作</th></tr></thead><tbody>${rows.map(b=>`<tr>${selectable?"<td><input class=\"row-check\" type=\"checkbox\"></td>":""}<td class="link mono" data-action="open-bill" data-id="${b.id}">${b.id}</td><td>${b.supplier}</td><td>${tag(b.board,b.board.includes("清关")?"green":b.board.includes("海运")?"blue":b.board.includes("空运")?"orange":"purple")}</td><td>${b.period}</td><td class="num strong">${money(b.amount,b.currency)}</td><td class="num">${money(b.settled,b.currency)}</td><td>${status(b.state)}</td><td class="num">${b.rows}</td><td>${b.unresolved?tag(`${b.unresolved} 项`,"orange"):"-"}</td><td>${b.created}</td><td><button class="btn small" data-action="open-bill" data-id="${b.id}">详情</button>${b.state==="待结清"?`<button class="btn small" data-action="settle-bill" data-id="${b.id}">登记结清</button>`:""}</td></tr>`).join("")}</tbody></table></div>`;
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
    <div class="field"><label class="required">实际成本账期</label><div id="cost-period-range" class="date-range-control"></div><small class="field-hint">已根据供应商成本账期与账单日期预填推导值，可按供应商账单的实际范围修改；导入时以当前值为准。</small></div><div class="field"><label class="required">导入时结清状态</label><select class="select"><option>待结清</option><option>已结清</option></select></div><div class="field"><label>账期差异说明</label><input id="cost-period-note" class="input" value="${escapeHtml(state.costPeriodDifferenceNote)}" placeholder="实际账期与推导值不一致时必填"><small class="field-hint">采用系统推导值时无需填写。</small></div>
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
  const profiles = {
    "派送成本": {
      key: { raw: "追踪号", type: "尾程运单号", result: "历史快照", match: "预计匹配 1,248 条" },
      fees: [
        { raw: "運費", standard: "派送费", type: "直接成本", basis: "关键单号可追溯到尾程包裹" },
        { raw: "超才費", standard: "超才费", type: "直接成本", basis: "沿用同一关键单号归属" },
        { raw: "偏遠費", standard: "偏远附加费", type: "直接成本", basis: "沿用同一关键单号归属" }
      ]
    },
    "清关成本": {
      key: { raw: "分提单号", type: "分提单号", result: "自动识别", match: "预计匹配 386 条" },
      fees: [
        { raw: "稅金", standard: "进口税费", type: "直接成本", basis: "分提单号可追溯到业务订单" },
        { raw: "報關費", standard: "报关费", type: "间接成本", basis: "按整票收取，无法直接归属单个订单" }
      ]
    },
    "海运成本": {
      key: { raw: "提单号", type: "提单号", result: "历史快照", match: "预计匹配 63 条" },
      fees: [
        { raw: "海運費", standard: "海运费", type: "间接成本", basis: "覆盖整票运输，需分摊到业务订单" },
        { raw: "拖櫃費", standard: "拖柜费", type: "间接成本", basis: "覆盖整柜运输，需分摊到业务订单" }
      ]
    },
    "空运成本": {
      key: { raw: "提单号", type: "提单号", result: "自动识别", match: "预计匹配 2 条" },
      fees: [
        { raw: "中港段費", standard: "中港运输费", type: "直接成本", basis: "提单号可追溯到业务订单" },
        { raw: "提單費", standard: "提单费", type: "间接成本", basis: "按整票收取，需分摊到业务订单" }
      ]
    },
    "租车成本": {
      key: { raw: "未识别到可用单号", type: "无关键单号", result: "待确认", match: "全部按间接成本推导" },
      fees: [
        { raw: "租车费", standard: "租车费", type: "间接成本", basis: "无关键单号，无法直接归属业务对象" },
        { raw: "搬运费", standard: "搬运费", type: "间接成本", basis: "无关键单号，需分摊到业务订单" }
      ]
    }
  };
  const profile = profiles[f.board] || profiles["派送成本"];
  const keyStatusClass = profile.key.result === "待确认" ? "warning" : "info";
  return `<div class="form-section"><div class="form-section-title">选择参与导入的工作表</div><div class="sheet-layout"><div class="sheet-list">${sheets.map(s=>`<button class="sheet-item ${s.n===state.selectedSheet?"active":""}" data-action="select-sheet" data-id="${s.n}">${icon(s.r==="成本明细"?"table-2":s.r.includes("汇总")?"sigma":"file-text")}<span>${s.n}</span><span class="sheet-role">${s.r}</span></button>`).join("")}</div><div class="mapping-area">
    <div class="mapping-note">系统已引用该供应商最近一次导入设置，并重新检查当前文件结构。当前 sheet 识别为“成本明细”，表头位于第 2 行，数据从第 3 行开始。</div>
    <section class="mapping-block key-mapping-block">
      <div class="mapping-block-head"><div><strong>关键单号识别</strong><span class="mapping-limit">最多 1 个</span></div><p>仅选定字段进入财务标准字段并用于匹配业务对象；其它单号随原始行完整保存在账单快照。</p></div>
      <div class="key-mapping-grid header"><span>原始单号字段</span><span></span><span>关键单号类型</span><span>匹配预估</span><span>识别结果</span></div>
      <div class="key-mapping-grid"><input class="input" value="${profile.key.raw}" readonly><span class="mapping-arrow">${icon("arrow-right")}</span><select class="select"><option>${profile.key.type}</option><option>无关键单号</option></select><span class="mapping-match">${profile.key.match}</span><span class="status ${keyStatusClass}">${profile.key.result}</span></div>
    </section>
    <section class="mapping-block fee-mapping-block">
      <div class="mapping-block-head"><div><strong>成本费项识别</strong><span class="mapping-count">${profile.fees.length} 个费项</span></div><p>每个原始金额字段分别映射标准成本费项；系统依据关键单号匹配结果推导直接成本或间接成本。</p></div>
      <div class="fee-mapping-grid header"><span>原始成本费项</span><span></span><span>标准成本费项</span><span>成本类型推导</span><span>识别结果</span></div>
      ${profile.fees.map(item=>`<div class="fee-mapping-grid"><input class="input" value="${item.raw}" readonly><span class="mapping-arrow">${icon("arrow-right")}</span><select class="select"><option>${item.standard}</option><option>选择其它标准成本费项</option><option>不导入，仅保留原始值</option></select><div class="cost-type-inference"><span class="tag ${item.type==="直接成本"?"green":"orange"}">${item.type}</span><small>${item.basis}</small></div><span class="status success">自动推导</span></div>`).join("")}
    </section>
    <div class="form-grid" style="margin-top:14px"><div class="field"><label>币种来源</label><select class="select"><option>本次导入默认币种</option><option>原始币种列</option></select></div><div class="field"><label>金额方向</label><select class="select"><option>正数表示应付成本</option><option>负数表示应付成本</option></select></div><div class="field"><label>识别方式</label><button class="btn" data-action="reanalyze">${icon("scan-search")}重新自动识别</button></div></div>
  </div></div></div>`;
}

function wizardThree() {
  const f=sampleFiles.find(x=>x.id===state.selectedFile);
  const sourceBill=bills.find(item=>item.file===f.name);
  const previewCosts=costs.filter(item=>item.bill===sourceBill?.id).slice(0,4);
  return `<div class="form-section"><div class="form-section-title">导入预览</div><div class="preview-summary"><div class="preview-metric"><span>拟生成成本明细</span><strong>${sourceBill?.rows || 0}</strong></div><div class="preview-metric"><span>直接成本</span><strong>${sourceBill?.direct || 0}</strong></div><div class="preview-metric"><span>间接成本</span><strong>${sourceBill?.indirect || 0}</strong></div><div class="preview-metric"><span>实际成本账期</span><strong class="compact-value">${state.costPeriodStart} 至 ${state.costPeriodEnd}</strong><small>${state.costPeriodAdjusted ? "财务已调整" : "采用系统推导值"}</small></div><div class="preview-metric"><span>拟入池金额</span><strong>${sourceBill?money(sourceBill.amount,sourceBill.currency):"-"}</strong></div></div>
  <div class="validation-list"><div class="validation-item ok">${icon("circle-check")}文件仅包含当前供应商“${f.supplier}”的数据</div><div class="validation-item ok">${icon("circle-check")}原始账单合计与拟入池金额一致</div></div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>原始行</th><th>关键单号</th><th>供应商原始费项</th><th>标准成本费项</th><th>金额</th><th>成本类型建议</th><th>归属结果</th><th>校验</th></tr></thead><tbody>
  ${previewCosts.map((cost,index)=>`<tr><td>样本项 ${index+1}</td><td>${cost.key}</td><td>${cost.raw}</td><td>${cost.fee}</td><td class="num">${money(cost.amount,cost.currency)}</td><td>${tag(cost.type,cost.type==="直接成本"?"green":"orange")}</td><td>${cost.target}</td><td>${status("已匹配")}</td></tr>`).join("")}
  </tbody></table></div></div>`;
}

function renderPool() {
  const totalDetails=sumRows(bills,"rows");
  const directDetails=sumRows(bills,"direct");
  const indirectDetails=sumRows(bills,"indirect");
  const pendingSetAmounts=amountsByCurrency(pools.filter(item=>item.treatment!=="不分摊"&&item.status!=="已分摊"));
  const pendingRules=pools.filter(item=>item.treatment!=="不分摊"&&!item.ruleId).length;
  return `${pageHeader("成本池", "逐行查看已标准化成本；直接成本归属业务对象，间接成本按所属账单进入分摊集", `<button class="btn">${icon("plus")}补录成本</button><button class="btn primary" data-view="bills">${icon("file-spreadsheet")}查看成本账单</button>`)}
  <div class="kpi-grid"><div class="kpi-card"><div class="kpi-label">成本明细</div><div class="kpi-value">${totalDetails.toLocaleString("en-US")}<small>笔</small></div><div class="kpi-extra">来自 ${bills.length} 份供应商账单</div></div><div class="kpi-card success"><div class="kpi-label">直接成本</div><div class="kpi-value">${directDetails.toLocaleString("en-US")}<small>笔</small></div><div class="kpi-extra">按样本金额字段展开</div></div><div class="kpi-card warning"><div class="kpi-label">间接成本</div><div class="kpi-value">${indirectDetails.toLocaleString("en-US")}<small>笔</small></div><div class="kpi-extra">待分摊 ${formatAmount(pendingSetAmounts.CNY||0)} CNY</div></div><div class="kpi-card danger"><div class="kpi-label">待确认规则</div><div class="kpi-value">${pendingRules}<small>个</small></div><div class="kpi-extra">分摊集尚未选定规则</div></div><div class="kpi-card info"><div class="kpi-label">待分摊台币</div><div class="kpi-value">${formatAmount(pendingSetAmounts.TWD||0)}<small>TWD</small></div><div class="kpi-extra">保持供应商账单原币种</div></div></div>
  <div class="filter-panel"><div class="filter-grid"><div class="field"><label>成本明细编号 / 关键单号</label><input class="input" placeholder="输入编号、运单、提单或柜号"></div><div class="field"><label>供应商</label><select class="select"><option>全部供应商</option>${suppliers.map(s=>`<option>${s.name}</option>`).join("")}</select></div><div class="field"><label>成本类型</label><select class="select"><option>全部类型</option><option>直接成本</option><option>间接成本</option></select></div><div class="field"><label>处理状态</label><select class="select"><option>全部状态</option><option>已归属</option><option>待分摊</option><option>已分摊</option><option>待人工确认</option></select></div><div class="filter-actions"><button class="btn primary">${icon("search")}查询</button><button class="btn">${icon("rotate-ccw")}重置</button></div></div></div>
  <section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th><input class="row-check" type="checkbox"></th><th>成本明细编号</th><th>供应商</th><th>成本板块</th><th>供应商原始费项</th><th>标准成本费项</th><th>关键单号</th><th>原始金额</th><th>成本类型</th><th>归属对象 / 所属分摊集</th><th>处理状态</th><th>操作</th></tr></thead><tbody>${costs.map(c=>`<tr><td><input class="row-check" type="checkbox"></td><td class="link mono" data-action="open-cost" data-id="${c.id}">${c.id}</td><td>${c.supplier}</td><td>${tag(getCostBoardLabel(c),"purple")}</td><td>${c.raw}</td><td>${c.fee}</td><td><span class="muted">${c.keyType}</span><br>${c.key}</td><td class="num strong">${money(c.amount,c.currency)}</td><td>${tag(c.type,c.type==="直接成本"?"green":"orange")}</td><td>${c.type === "间接成本" ? `<button class="count-link" data-action="open-bucket" data-id="${c.target}">${c.target}</button>` : c.target}</td><td>${status(c.status)}</td><td><button class="btn small" data-action="open-cost" data-id="${c.id}">详情</button><button class="btn small" data-action="toggle-cost" data-id="${c.id}">切换类型</button></td></tr>`).join("")}</tbody></table></div>${tableFooter(costs.length)}</section>`;
}

function renderRules() {
  const isSupplierRule = rule => rule.supplier && rule.supplier !== "全部供应商";
  const activeType = state.ruleTab === "supplier" ? "supplier" : "base";
  const keyword = state.ruleKeyword.trim().toLowerCase();
  const filtered = allocationRules.filter(rule => {
    const matchesType = activeType === "supplier" ? isSupplierRule(rule) : !isSupplierRule(rule);
    const matchesKeyword = !keyword || `${rule.id} ${rule.fee} ${rule.scope}`.toLowerCase().includes(keyword);
    const matchesBoard = !state.ruleBoard || rule.board === state.ruleBoard;
    const matchesSupplier = activeType === "base" || !state.ruleSupplier || rule.supplier === state.ruleSupplier;
    const matchesStatus = !state.ruleStatus || rule.status === state.ruleStatus;
    return matchesType && matchesKeyword && matchesBoard && matchesSupplier && matchesStatus;
  });
  const baseCount = allocationRules.filter(rule => !isSupplierRule(rule)).length;
  const supplierCount = allocationRules.filter(isSupplierRule).length;
  const supplierFilter = activeType === "supplier" ? `<div class="field"><label>供应商</label><select id="rule-supplier-filter" class="select"><option value="">全部供应商</option>${suppliers.map(item => `<option value="${escapeHtml(item.name)}" ${state.ruleSupplier === item.name ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>` : "";
  const supplierColumn = activeType === "supplier" ? "<th>适用供应商</th>" : "";
  const emptyMessage = activeType === "supplier" ? "没有符合条件的供应商特调分摊规则" : "没有符合条件的基础分摊规则";
  return `${pageHeader("间接成本分摊规则", "统一维护间接成本的候选订单范围和分摊口径", `<button class="btn primary" data-action="new-allocation-rule" data-type="${activeType}">${icon("plus")}新增${activeType === "supplier" ? "供应商特调" : "基础"}规则</button>`)}
    <section class="rule-priority-panel" aria-label="分摊规则命中优先级">
      <div class="rule-priority-title">规则命中优先级</div>
      <div class="rule-priority-flow"><span class="priority-step primary"><b>1</b>供应商特调分摊规则</span>${icon("arrow-right")}<span class="priority-step"><b>2</b>基础分摊规则</span></div>
      <p>系统先按供应商、标准成本费项和成本发生时间匹配特调规则；未命中时再采用同一标准成本费项的基础规则。同一层级命中多条规则时停止自动匹配，转财务确认。</p>
    </section>
    <div class="filter-panel rule-filter-panel"><div class="filter-grid rule-filter-grid"><div class="field"><label>规则编号 / 标准成本费项</label><input id="rule-keyword" class="input" value="${escapeHtml(state.ruleKeyword)}" placeholder="输入规则编号、标准成本费项或候选订单范围"></div><div class="field"><label>成本板块</label><select id="rule-board-filter" class="select"><option value="">全部板块</option>${["派送成本","清关成本","海运成本","空运成本","租车成本"].map(item => `<option value="${item}" ${state.ruleBoard === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>${supplierFilter}<div class="field"><label>状态</label><select id="rule-status-filter" class="select"><option value="">全部状态</option>${["启用","停用"].map(item => `<option value="${item}" ${state.ruleStatus === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="filter-actions"><button class="btn primary" data-action="rule-query">${icon("search")}查询</button><button class="btn" data-action="rule-reset">${icon("rotate-ccw")}重置</button></div></div></div>
    <section class="panel"><div class="panel-head rule-type-tabbar"><div class="rule-type-tabs"><button class="${activeType === "base" ? "active" : ""}" data-action="rule-type-tab" data-value="base"><span>基础分摊规则</span><small>${baseCount}</small></button><button class="${activeType === "supplier" ? "active" : ""}" data-action="rule-type-tab" data-value="supplier"><span>供应商特调分摊规则</span><small>${supplierCount}</small></button></div><span class="panel-tools">共 ${filtered.length} 条</span></div>
      <div class="table-wrap"><table class="data-table rule-list-table"><thead><tr><th>规则编号</th><th>成本板块</th><th>标准成本费项</th>${supplierColumn}<th>候选业务订单范围</th><th>优先 / 兜底因子</th><th>生效期间</th><th>状态</th><th>操作</th></tr></thead><tbody>${filtered.map(rule => `<tr><td class="link mono" data-action="open-rule" data-id="${rule.id}">${rule.id}</td><td>${tag(rule.board,"purple")}</td><td><strong>${escapeHtml(rule.fee)}</strong></td>${activeType === "supplier" ? `<td>${escapeHtml(rule.supplier)}</td>` : ""}<td class="wrap-cell">${escapeHtml(rule.scope)}</td><td>${escapeHtml(rule.factor)}<br><span class="muted">兜底：${escapeHtml(rule.fallback)}</span></td><td>${escapeHtml(rule.effective || "长期有效")}</td><td>${status(rule.status)}</td><td><button class="btn small" data-action="open-rule" data-id="${rule.id}">详情</button><button class="btn small" data-action="edit-rule" data-id="${rule.id}">编辑</button></td></tr>`).join("") || `<tr><td colspan="${activeType === "supplier" ? 9 : 8}" class="empty-cell">${emptyMessage}</td></tr>`}</tbody></table></div>${tableFooter(filtered.length)}</section>`;
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
    const aliasText = feeAliases.filter(alias => alias.feeCode === item.code).map(alias => alias.rawName).join(" ");
    const codeText = `${item.code}`.toLowerCase();
    const nameText = `${item.name} ${aliasText}`.toLowerCase();
    return (!state.feeCodeKeyword || codeText.includes(state.feeCodeKeyword.toLowerCase())) && (!state.feeNameKeyword || nameText.includes(state.feeNameKeyword.toLowerCase())) && (!state.feeBoard || item.board === state.feeBoard) && (!state.feeStatus || item.status === state.feeStatus);
  });
  const boardTabs = `<div class="fee-board-tabs">${["", ...costBoards].map(board => {
    const label = board || "全部";
    const count = board ? fees.filter(item => item.board === board).length : fees.length;
    return `<button class="${state.feeBoard === board ? "active" : ""}" data-action="fee-board-tab" data-value="${board}"><span>${label}</span><small>${count}</small></button>`;
  }).join("")}</div>`;
  const indexView = `<div class="filter-panel fee-filter-panel"><div class="filter-grid fee-filter-grid"><div class="field fee-keyword-field"><label>费项编号</label><input id="fee-code-keyword" class="input" value="${escapeHtml(state.feeCodeKeyword)}" placeholder="输入费项编号"></div><div class="field fee-keyword-field"><label>费项名称</label><input id="fee-name-keyword" class="input" value="${escapeHtml(state.feeNameKeyword)}" placeholder="输入标准名或别名"></div><div class="field"><label>状态</label><select id="fee-status" class="select"><option value="">全部状态</option>${["启用","停用"].map(item => `<option value="${item}" ${state.feeStatus === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="filter-actions"><button class="btn primary" data-action="fee-query">${icon("search")}查询</button><button class="btn" data-action="fee-reset">${icon("rotate-ccw")}重置</button></div></div></div>
    <section class="panel"><div class="panel-head fee-board-tabbar">${boardTabs}<span class="panel-tools">共 ${filteredFees.length} 项</span></div><div class="table-wrap"><table class="data-table fee-index-table"><thead><tr><th>成本费项编码</th><th>标准成本费项</th><th>成本板块</th><th>费项类型</th><th>成本费项别名</th><th>分摊规则</th><th>状态</th><th>操作</th></tr></thead><tbody>${filteredFees.map(f => `<tr><td class="link mono" data-action="open-fee" data-id="${f.code}">${f.code}</td><td><div class="fee-name-cell"><strong class="fee-name-main">${escapeHtml(f.name)}</strong></div></td><td>${tag(f.board,"purple")}</td><td>${tag("应付类","blue")}</td><td>${renderFeeAliasCell(f.code)}</td><td><button class="count-link" data-action="fee-rules" data-id="${f.code}"><strong>${f.rules}</strong><span>条</span></button></td><td>${status(f.status)}</td><td><button class="btn small" data-action="open-fee" data-id="${f.code}">详情</button><button class="btn small" data-action="edit-fee" data-id="${f.code}">编辑</button></td></tr>`).join("") || `<tr><td colspan="8" class="empty-cell">没有符合条件的成本费项</td></tr>`}</tbody></table></div>${tableFooter(filteredFees.length)}</section>`;
  return `${pageHeader("成本费项索引", "统一五大成本板块的内部费项口径，供应商原始名称映射由导入设置快照保存", `<button class="btn primary" data-action="new-fee">${icon("plus")}新增标准成本费项</button>`)}${indexView}`;
}
function renderView() {
  destroyAllDateRangePickers();
  const content=document.getElementById("content");
  const views={overview:renderOverview,suppliers:renderSuppliers,bills:renderBills,billDetail:renderBillDetail,pool:renderPool,rules:renderRules,profit:renderProfit,fees:renderFees};
  content.innerHTML=(views[state.view]||renderOverview)();
  document.querySelector(".current-route").textContent=routeNames[state.view];
  document.getElementById("route-back").classList.toggle("hidden",state.view!=="billDetail");
  const activeView = state.view === "billDetail" ? "bills" : state.view;
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===activeView));
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

function mountSingleDatePicker({ id, value, onUpdate, ariaLabel }) {
  destroyDateRangePicker(id);
  const mountPoint = document.getElementById(id);
  if (!mountPoint) return;
  const app = createApp({
    setup() {
      const selectedDate = ref(value);
      const updateDate = nextValue => {
        selectedDate.value = nextValue;
        if (!nextValue) return;
        onUpdate(nextValue);
      };
      return () => h(ElConfigProvider, { locale: zhCn }, {
        default: () => h(ElDatePicker, {
          modelValue: selectedDate.value,
          "onUpdate:modelValue": updateDate,
          type: "date",
          placeholder: "选择日期",
          format: "YYYY/MM/DD dddd",
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
    onUpdate: value => {
      [state.costPeriodStart, state.costPeriodEnd] = value;
      state.costPeriodAdjusted = state.costPeriodStart !== state.inferredCostPeriodStart || state.costPeriodEnd !== state.inferredCostPeriodEnd;
    }
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
function showModal(title, body, confirm="确认") { destroyDateRangePicker("cost-period-range");destroyDateRangePicker("supplier-cycle-anchor-picker");const m=document.getElementById("modal"); m.classList.remove("import-wizard-modal","allocation-config-modal","supplier-config-modal");m.innerHTML=`<div class="modal-head"><span class="modal-title">${title}</span><button class="icon-btn" data-action="close-modal">${icon("x")}</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn" data-action="close-modal">取消</button><button id="modal-confirm" class="btn primary" data-action="modal-confirm">${confirm}</button></div>`;m.classList.remove("hidden");document.getElementById("modal-backdrop").classList.remove("hidden");refreshIcons();}
function closeModal(){destroyDateRangePicker("cost-period-range");destroyDateRangePicker("supplier-cycle-anchor-picker");const modal=document.getElementById("modal");modal.classList.add("hidden");modal.classList.remove("import-wizard-modal","allocation-config-modal","supplier-config-modal");document.getElementById("modal-backdrop").classList.add("hidden");state.pendingAction=null;}
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
    if (!Array.isArray(payload.data[tableName]) && !["feeAliases", "allocationRules"].includes(tableName)) throw new Error(`模拟数据缺少 ${tableName}`);
  }
  await prototypeDb.transaction("rw", prototypeDb.tables, async () => {
    await Promise.all(prototypeDb.tables.map(table => table.clear()));
    for (const tableName of dataTableNames) {
      const rows = Array.isArray(payload.data[tableName]) ? payload.data[tableName] : initialData[tableName];
      if (rows.length) await prototypeDb.table(tableName).bulkAdd(cloneData(rows));
    }
    if (Array.isArray(payload.data.operationLogs) && payload.data.operationLogs.length) await prototypeDb.operationLogs.bulkAdd(cloneData(payload.data.operationLogs).map(({ id, ...row }) => row));
    await prototypeDb.settings.put({ key: "seedVersion", value: 13 });
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

  if (action.type === "saveSupplier") {
    const original = suppliers.find(item => item.code === action.id);
    const code = (document.getElementById("supplier-form-code")?.value || "").trim().toUpperCase();
    const name = (document.getElementById("supplier-form-name")?.value || "").trim();
    const boards = [...document.querySelectorAll('input[name="supplier-board"]:checked')].map(input => input.value);
    const cycleType = document.getElementById("supplier-form-cycle")?.value || "";
    const currency = document.getElementById("supplier-form-currency")?.value || "";
    const supplierStatus = document.getElementById("supplier-form-status")?.value || "启用";
    const remark = (document.getElementById("supplier-form-remark")?.value || "").trim();
    const naturalDays = Number(document.getElementById("supplier-form-natural-days")?.value || 0);
    const cycleAnchor = state.supplierCycleAnchor || "";
    if (!code || !name || !boards.length || !cycleType || !currency) { toast("请完整填写供应商编码、名称、成本板块、账期类型和默认币种", "warning"); return; }
    if (!/^SUP-[A-Z0-9-]+$/.test(code)) { toast("供应商编码应以 SUP- 开头，并仅使用大写字母、数字和连字符", "warning"); return; }
    if (!original && suppliers.some(item => item.code === code)) { toast("供应商编码已存在", "warning"); return; }
    if (suppliers.some(item => item.code !== original?.code && item.name === name)) { toast("供应商名称已存在", "warning"); return; }
    if (cycleType === "自然天" && (!Number.isInteger(naturalDays) || naturalDays < 1 || !cycleAnchor)) { toast("自然天账期必须填写周期天数和首个账期开始日", "warning"); return; }
    const cycle = cycleType === "自然天" ? `${naturalDays} 自然天` : cycleType;
    const updated = new Date().toLocaleDateString("zh-CN").replaceAll("/", "-");
    const next = {
      ...original,
      code,
      name,
      boards,
      cycle,
      currency,
      state: supplierStatus,
      remark,
      updated,
      bills: original?.bills || 0,
      pending: original?.pending || `0.000 ${currency}`,
      settled: original?.settled || `0.000 ${currency}`
    };
    if (cycleType === "自然天") next.cycleAnchor = cycleAnchor; else delete next.cycleAnchor;
    delete next.weekStart;
    if (original) Object.assign(original, next); else suppliers.unshift(next);
    await prototypeDb.suppliers.put(cloneData(next));
    await recordOperation("供应商财务档案", code, original ? "编辑供应商财务档案" : "新增供应商财务档案", `${name} / ${cycle} / ${boards.join("、")}`);
  } else if (action.type === "saveFee") {
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
    await recordOperation("成本费项索引", code, original ? "编辑标准成本费项" : "新增标准成本费项", `${board} / ${name}`);
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
    if (!supplier || !board || !rawName || !targetFee) { toast("请完整填写供应商、成本板块、原始费项名称和标准成本费项", "warning"); return; }
    if (targetFee.board !== board) { toast("供应商映射与标准成本费项必须属于同一成本板块", "warning"); return; }
    if (aliasStatus === "启用" && targetFee.status !== "启用") { toast("启用中的映射只能映射到启用中的标准成本费项", "warning"); return; }
    const duplicate = feeAliases.find(item => item.id !== original?.id && item.supplier === supplier && item.board === board && item.rawName.trim().toLowerCase() === rawName.toLowerCase() && (item.structure || "") === structure && (item.sheet || "") === sheet && item.status === "启用" && aliasStatus === "启用");
    if (duplicate) { toast("相同供应商、板块、原始名称和适用范围下已存在启用映射", "warning"); return; }
    const confirmedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-");
    const next = { ...original, id: original?.id || makeId("ALIAS"), supplier, board, rawName, feeCode, structure, sheet, status: aliasStatus, note, version: (original?.version || 0) + 1, confirmer: "谭清辉", confirmedAt };
    if (original) Object.assign(original, next); else feeAliases.unshift(next);
    await prototypeDb.feeAliases.put(cloneData(next));
    await recordOperation("供应商导入设置快照中的费项映射", next.id, original ? "更新导入设置快照中的费项映射版本" : "新增导入设置快照中的费项映射", `${supplier} / ${rawName} → ${targetFee.name}`);
  } else if (action.type === "saveAllocationRule") {
    const original = allocationRules.find(item => item.id === action.id);
    const board = document.getElementById("rule-form-board")?.value || "";
    const fee = document.getElementById("rule-form-fee")?.value || "";
    const supplier = action.ruleType === "supplier" ? (document.getElementById("rule-form-supplier")?.value || "") : "全部供应商";
    const scope = (document.getElementById("rule-form-scope")?.value || "").trim();
    const factor = document.getElementById("rule-form-factor")?.value || "";
    const fallback = document.getElementById("rule-form-fallback")?.value || "";
    const rounding = document.getElementById("rule-form-rounding")?.value || "最大余数法";
    const effective = (document.getElementById("rule-form-effective")?.value || "").trim();
    const ruleStatus = document.getElementById("rule-form-status")?.value || "启用";
    const targetFee = fees.find(item => item.name === fee && item.board === board);
    if (!board || !fee || !supplier || !scope || !factor || !fallback || !effective) { toast("请完整填写分摊规则的必填信息", "warning"); return; }
    if (!targetFee) { toast("标准成本费项必须与所选成本板块一致", "warning"); return; }
    const duplicate = allocationRules.find(item => item.id !== original?.id && item.board === board && item.fee === fee && item.supplier === supplier && item.status === "启用" && ruleStatus === "启用");
    if (duplicate) { toast("相同标准成本费项和规则层级下已存在启用中的分摊规则", "warning"); return; }
    const rule = { ...original, id: original?.id || makeId(action.ruleType === "supplier" ? "RULE-SP" : "RULE"), board, fee, supplier, scope, factor, fallback, rounding, effective, status: ruleStatus };
    if (original) Object.assign(original, rule); else allocationRules.unshift(rule);
    await prototypeDb.allocationRules.put(cloneData(rule));
    await recordOperation("分摊规则", rule.id, original ? "更新间接成本分摊规则" : "新增间接成本分摊规则", `${action.ruleType === "supplier" ? "供应商特调" : "基础"} / ${board} / ${fee} / ${supplier}`);
  } else if (action.type === "saveBucketTreatment") {
    const bucket = pools.find(item => item.id === action.id);
    const treatment = document.getElementById("bucket-treatment-select")?.value || "";
    const reason = document.getElementById("bucket-no-allocation-reason")?.value || "";
    const note = (document.getElementById("bucket-no-allocation-note")?.value || "").trim();
    if (!bucket || !treatment) { toast("请选择间接成本处理方式", "warning"); return; }
    if (treatment === "不分摊" && !reason) { toast("选择不分摊时必须填写原因", "warning"); return; }
    if (treatment === "不分摊" && reason === "其他" && !note) { toast("不分摊原因为其他时必须补充说明", "warning"); return; }
    const previous = bucket.treatment || "分摊至业务订单";
    bucket.treatment = treatment;
    bucket.noAllocationReason = treatment === "不分摊" ? reason : "";
    bucket.noAllocationNote = treatment === "不分摊" ? note : "";
    bucket.treatmentConfirmedBy = "谭清辉";
    bucket.treatmentConfirmedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-");
    if (treatment === "不分摊") {
      bucket.ruleId = "";
      bucket.factor = "-";
      bucket.fallback = "-";
      bucket.version = "-";
      bucket.status = "不分摊";
    } else if (previous === "不分摊") {
      bucket.status = "待人工确认";
    }
    await prototypeDb.pools.put(cloneData(bucket));
    const affected = costs.filter(cost => cost.target === bucket.id);
    for (const cost of affected) cost.status = treatment === "不分摊" ? "不分摊" : "待人工确认";
    if (affected.length) await prototypeDb.costs.bulkPut(cloneData(affected));
    await recordOperation("间接成本分摊集", bucket.id, "确认间接成本处理方式", `${previous} → ${treatment}${reason ? ` / ${reason}` : ""}`);
  } else if (action.type === "saveBucketRule") {
    const bucket = pools.find(item => item.id === action.id);
    const ruleId = document.getElementById("bucket-rule-select")?.value || "";
    const rule = allocationRules.find(item => item.id === ruleId && item.status === "启用");
    if (!bucket || !rule) { toast("请选择一条有效分摊规则", "warning"); return; }
    bucket.ruleId = rule.id;
    bucket.factor = rule.factor;
    bucket.fallback = rule.fallback;
    bucket.scope = rule.scope;
    bucket.status = "待分摊";
    await prototypeDb.pools.put(cloneData(bucket));
    await recordOperation("间接成本分摊集", bucket.id, "确认采用的分摊规则", `${rule.id} / ${rule.supplier}`);
  } else if (action.type === "toggleFee") {
    const fee = fees.find(item => item.code === action.id);
    fee.status = fee.status === "启用" ? "停用" : "启用";
    fee.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-");
    await prototypeDb.fees.put(cloneData(fee));
    await recordOperation("成本费项索引", fee.code, `${fee.status}标准成本费项`);
  } else if (action.type === "toggleAlias") {
    const alias = feeAliases.find(item => item.id === action.id);
    const nextStatus = alias.status === "启用" ? "停用" : "启用";
    const targetFee = fees.find(item => item.code === alias.feeCode);
    if (nextStatus === "启用" && targetFee?.status !== "启用") { toast("目标标准成本费项已停用，不能启用该映射", "warning"); return; }
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
    cost.target = cost.type === "直接成本" ? "待匹配业务对象" : "待归入间接成本分摊集";
    await prototypeDb.costs.put(cloneData(cost));
    await recordOperation("成本明细", cost.id, `切换为${cost.type}`);
  } else if (action.type === "runAllocation") {
    const bucket = pools.find(item => item.id === action.id);
    bucket.status = "已分摊";
    bucket.version = bucket.version === "-" ? "V1" : `V${Number(bucket.version.slice(1)) + 1}`;
    await prototypeDb.pools.put(cloneData(bucket));
    const affected = costs.filter(cost => cost.target === bucket.id);
    for (const cost of affected) cost.status = "已分摊";
    if (affected.length) await prototypeDb.costs.bulkPut(cloneData(affected));
    await recordOperation("间接成本分摊集", bucket.id, "执行间接成本分摊", bucket.version);
  } else if (action.type === "importBill") {
    const file = sampleFiles.find(item => item.id === state.selectedFile);
    const supplier = suppliers.find(item => item.name === file.supplier);
    const sourceBill = initialData.bills.find(item => item.file === file.name);
    const bill = { ...cloneData(sourceBill), id: makeId(`APB-${supplier?.code || file.supplier}`), period: `${state.costPeriodStart} 至 ${state.costPeriodEnd}`, inferredPeriod: `${state.inferredCostPeriodStart} 至 ${state.inferredCostPeriodEnd}`, periodConfirmation: state.costPeriodAdjusted ? "财务调整" : "采用推导值", periodDifferenceNote: state.costPeriodDifferenceNote, settled: "0.000", state: "待结清" };
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
  if (["saveSupplier", "saveFee", "saveAlias", "toggleFee"].includes(action.type)) closeDrawer();
  renderView();
  toast(action.type === "resetData" ? "已恢复初始模拟数据" : "操作已保存到浏览器本地数据库");
}

function supplierCycleType(supplier) {
  return /^\d+ 自然天$/.test(supplier?.cycle || "") ? "自然天" : supplier?.cycle || "月";
}

function syncSupplierCycleFields() {
  const cycleType = document.getElementById("supplier-form-cycle")?.value;
  document.getElementById("supplier-natural-fields")?.classList.toggle("hidden", cycleType !== "自然天");
  const naturalDays = document.getElementById("supplier-form-natural-days");
  if (cycleType === "自然天" && naturalDays && !naturalDays.value) naturalDays.value = "7";
  const hint = document.getElementById("supplier-cycle-hint");
  if (hint) hint.textContent = cycleType === "半月" ? "按每月 1-15 日、16 日至月末划分。" : cycleType === "月" ? "按自然月划分。" : cycleType === "周" ? "按自然周划分，固定为周一至周日。" : "从首个账期开始日按设定天数连续滚动。";
}

function initializeSupplierAnchorPicker() {
  mountSingleDatePicker({
    id: "supplier-cycle-anchor-picker",
    value: state.supplierCycleAnchor,
    ariaLabel: "首个账期开始日",
    onUpdate: value => { state.supplierCycleAnchor = value; }
  });
}

function supplierFormModal(id = "") {
  const supplier = suppliers.find(item => item.code === id);
  const model = supplier || { code: "", name: "", boards: [], cycle: "月", currency: "CNY", state: "启用", remark: "" };
  const boards = normalizeSupplierBoards(model.boards);
  const cycleType = supplierCycleType(model);
  const naturalDays = Number(model.cycle.match(/^(\d+) 自然天$/)?.[1]) || 7;
  const boardOptions = ["派送", "清关", "海运", "空运", "租车"];
  state.supplierCycleAnchor = model.cycleAnchor || "2026-01-01";
  state.pendingAction = { type: "saveSupplier", id };
  showModal(supplier ? `编辑供应商财务档案 · ${supplier.name}` : "新增供应商财务档案", `<div class="form-grid supplier-form-grid">
    <div class="field"><label class="required">供应商编码</label><input id="supplier-form-code" class="input mono" value="${escapeHtml(model.code)}" placeholder="例如 SUP-ABC" ${supplier ? "disabled" : ""}></div>
    <div class="field"><label class="required">供应商名称</label><input id="supplier-form-name" class="input" value="${escapeHtml(model.name)}" placeholder="输入供应商名称"></div>
    <div class="field"><label class="required">状态</label><select id="supplier-form-status" class="select">${["启用","停用"].map(item => `<option ${model.state === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
    <div class="field"><label class="required">默认币种</label><select id="supplier-form-currency" class="select">${["CNY","TWD","USD","HKD","JPY","EUR"].map(item => `<option ${model.currency === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
    <div class="field form-span-2"><label class="required">适用成本板块</label><div class="supplier-board-options">${boardOptions.map(item => `<label class="check-option"><input type="checkbox" name="supplier-board" value="${item}" ${boards.includes(item) ? "checked" : ""}><span>${item}成本</span></label>`).join("")}</div><small class="field-help">一个供应商可以同时适用于多个成本板块。</small></div>
    <div class="field"><label class="required">成本账期类型</label><select id="supplier-form-cycle" class="select">${["周","半月","月","自然天"].map(item => `<option ${cycleType === item ? "selected" : ""}>${item}</option>`).join("")}</select><small id="supplier-cycle-hint" class="field-help"></small></div>
    <div id="supplier-natural-fields" class="supplier-cycle-fields form-span-2"><div class="field"><label class="required">周期天数</label><div class="input-suffix"><input id="supplier-form-natural-days" class="input" type="number" min="1" step="1" value="${naturalDays}"><span>自然天</span></div></div><div class="field"><label class="required">首个账期开始日</label><div id="supplier-cycle-anchor-picker" class="single-date-control"></div></div></div>
    <div class="field form-span-2"><label>备注</label><textarea id="supplier-form-remark" class="textarea" placeholder="记录供应商对账口径、账期例外或其它财务关注事项">${escapeHtml(model.remark || "")}</textarea></div>
  </div>`, supplier ? "保存修改" : "确认新增");
  document.getElementById("modal").classList.add("supplier-config-modal");
  syncSupplierCycleFields();
  initializeSupplierAnchorPicker();
}

function supplierDrawer(id){const s=suppliers.find(x=>x.code===id);const boards=normalizeSupplierBoards(s?.boards);showDrawer(`供应商财务档案 · ${s.name}`,`<div class="header-actions" style="justify-content:flex-start;margin-bottom:12px"><button class="btn primary" data-action="edit-supplier" data-id="${s.code}">${icon("pencil")}编辑档案</button><button class="btn" data-view="bills">查看成本账单</button></div><div class="detail-grid"><div class="detail-item"><span class="detail-label">供应商编码</span><span class="detail-value">${s.code}</span></div><div class="detail-item"><span class="detail-label">供应商状态</span><span class="detail-value">${status(s.state)}</span></div><div class="detail-item"><span class="detail-label">供应商名称</span><span class="detail-value">${s.name}</span></div><div class="detail-item"><span class="detail-label">适用成本板块</span><span class="detail-value">${renderSupplierBoardTags(boards)}</span></div><div class="detail-item"><span class="detail-label">成本账期类型</span><span class="detail-value">${s.cycle}</span></div><div class="detail-item"><span class="detail-label">默认币种</span><span class="detail-value">${s.currency}</span></div><div class="detail-item"><span class="detail-label">当前成本账期</span><span class="detail-value">${currentSupplierPeriod(s)}</span><small class="detail-hint">按当前日期和账期配置实时推导</small></div><div class="detail-item"><span class="detail-label">最近更新时间</span><span class="detail-value">${s.updated}</span></div></div><div class="drawer-section"><h3>金额统计</h3><div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)"><div class="kpi-card"><div class="kpi-label">成本账单</div><div class="kpi-value">${s.bills}</div></div><div class="kpi-card warning"><div class="kpi-label">待结清金额</div><div class="kpi-value" style="font-size:16px">${s.pending}</div></div><div class="kpi-card success"><div class="kpi-label">已结清金额</div><div class="kpi-value" style="font-size:16px">${s.settled}</div></div></div></div><div class="drawer-section"><h3>当前导入设置</h3><div class="timeline"><div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-title">最近确认的导入设置可直接复用</div><div class="timeline-meta">成本板块：${boards[0] || "未配置"} · 最近确认：${s.updated}</div></div><div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-title">供应商导入设置快照 8 项</div><div class="timeline-meta">下次账单格式变化时仍可重新自动识别</div></div></div></div>`);}

function renderBillDetail(){
  const b=bills.find(item=>item.id===state.selectedBillId);
  if(!b){
    return `${pageHeader("成本账单详情", "未找到指定成本账单")}<div class="validation-item warn">${icon("triangle-alert")}该成本账单不存在或已被移除。</div>`;
  }
  const billCosts=costs.filter(cost=>cost.bill===b.id);
  const billDetails=costDetails.filter(detail=>detail.file===b.file);
  const allocationSets=pools.filter(item=>item.bill===b.id);
  const summaryRows=billCosts.map(cost=>{
    const allocationSet=allocationSets.find(item=>item.id===cost.target);
    const rule=allocationSet?allocationRules.find(ruleItem=>ruleItem.id===allocationSet.ruleId):null;
    const setText=allocationSet?`<button class="count-link mono" data-action="open-bucket" data-id="${allocationSet.id}">${allocationSet.id}</button>`:"-";
    const ruleText=allocationSet?(allocationSet.treatment === "不分摊"?'<span class="muted">不适用</span>':(rule?`${rule.id}<br><span class="muted">${rule.supplier === "全部供应商" ? "基础规则" : "供应商特调"}</span>`:'<span class="muted">待财务确认</span>')):"-";
    return `<tr><td>${cost.fee}</td><td>${cost.raw}</td><td>${tag(cost.type,cost.type==="直接成本"?"green":"orange")}</td><td class="num">${cost.detailCount || 1}</td><td class="num strong">${money(cost.amount,cost.currency)}</td><td>${setText}</td><td>${ruleText}</td><td>${status(cost.status)}</td></tr>`;
  }).join("") || `<tr><td colspan="8" class="empty-cell">该账单暂无成本费项</td></tr>`;
  const actions=`<button class="btn">${icon("file-down")}下载原始账单</button>${b.state==="待结清"?`<button class="btn primary" data-action="settle-bill" data-id="${b.id}">${icon("badge-check")}登记结清</button>`:""}`;
  const detailTabs=`<div class="bill-detail-tabs" role="tablist" aria-label="成本账单详情内容"><button role="tab" aria-selected="${state.billDetailTab==="summary"}" class="${state.billDetailTab==="summary"?"active":""}" data-action="bill-detail-tab" data-value="summary">成本费项汇总</button><button role="tab" aria-selected="${state.billDetailTab==="details"}" class="${state.billDetailTab==="details"?"active":""}" data-action="bill-detail-tab" data-value="details">成本费项明细</button></div>`;
  const summaryContent=`<div class="preview-summary bill-detail-metrics"><div class="preview-metric"><span>成本明细</span><strong>${b.rows}</strong></div><div class="preview-metric"><span>直接成本</span><strong>${b.direct}</strong></div><div class="preview-metric"><span>间接成本</span><strong>${b.indirect}</strong></div><div class="preview-metric"><span>待处理</span><strong>${b.unresolved}</strong></div></div><div class="bill-detail-section-head"><span class="panel-title">成本费项汇总</span><button class="btn small" data-view="rules">${icon("list-checks")}维护分摊规则</button></div><div class="bill-detail-note"><div class="inline-note">汇总金额与明细数量取自供应商原始账单。直接成本不使用分摊集；间接成本按标准成本费项归入分摊集，并标记采用的分摊规则。</div></div><div class="table-wrap"><table class="data-table bucket-table"><thead><tr><th>标准成本费项</th><th>原始成本费项</th><th>成本类型</th><th>明细数量</th><th>汇总金额</th><th>分摊集</th><th>分摊规则</th><th>状态</th></tr></thead><tbody>${summaryRows}</tbody></table></div>`;
  const detailRows=billDetails.map(detail=>{
    const target=detail.type === "间接成本" && pools.some(item=>item.id===detail.target)
      ? `<button class="count-link mono" data-action="open-bucket" data-id="${detail.target}">${detail.target}</button>`
      : detail.target;
    return `<tr><td class="mono">${detail.id}</td><td>${detail.sheet} · 第 ${detail.row} 行</td><td>${detail.date}</td><td>${detail.fee}</td><td>${detail.raw}</td><td><span class="muted">${detail.keyType}</span><br><span class="mono">${detail.key}</span></td><td class="num strong">${money(detail.amount,detail.currency)}</td><td>${tag(detail.type,detail.type==="直接成本"?"green":"orange")}</td><td>${target}</td><td>${status(detail.status)}</td></tr>`;
  }).join("")||`<tr><td colspan="10" class="empty-cell">当前账单暂无逐笔成本明细</td></tr>`;
  const detailContent=`<div class="bill-detail-note"><div class="inline-note">每行对应供应商原始账单中一个非零费用单元格；同一原始行包含多个费项时，按费项拆成多条成本明细。来源 Sheet 与行号用于回查原始账单。</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>成本明细编号</th><th>原始位置</th><th>费用日期</th><th>标准成本费项</th><th>原始成本费项</th><th>关键单号</th><th>金额</th><th>成本类型</th><th>归属对象 / 所属分摊集</th><th>状态</th></tr></thead><tbody>${detailRows}</tbody></table></div><div class="table-footer"><span>当前页展示 ${billDetails.length} 条逐笔成本明细</span><span>数据均取自原始样本文件</span></div>`;
  return `<div class="bill-detail-page">${pageHeader("成本账单详情", `${b.id} · ${b.supplier}`, actions)}
    <section class="panel"><div class="panel-head"><span class="panel-title">账单基本信息</span></div><div class="panel-body"><div class="detail-grid"><div class="detail-item"><span class="detail-label">成本账单编号</span><span class="detail-value mono">${b.id}</span></div><div class="detail-item"><span class="detail-label">结清状态</span><span class="detail-value">${status(b.state)}</span></div><div class="detail-item"><span class="detail-label">供应商</span><span class="detail-value">${b.supplier}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${b.board}</span></div><div class="detail-item"><span class="detail-label">实际成本账期</span><span class="detail-value">${b.period}</span></div><div class="detail-item"><span class="detail-label">原始文件</span><span class="detail-value">${b.file}</span></div><div class="detail-item"><span class="detail-label">账单金额</span><span class="detail-value strong">${money(b.amount,b.currency)}</span></div><div class="detail-item"><span class="detail-label">已结清金额</span><span class="detail-value">${money(b.settled,b.currency)}</span></div></div></div></section>
    <section class="panel bill-detail-content">${detailTabs}<div class="bill-detail-tab-content">${state.billDetailTab==="details"?detailContent:summaryContent}</div></section>
  </div>`;
}

function costDrawer(id){const c=costs.find(x=>x.id===id);showDrawer("成本明细详情",`<div class="header-actions" style="justify-content:flex-start;margin-bottom:12px"><button class="btn" data-action="toggle-cost" data-id="${c.id}">${icon("repeat-2")}切换成本类型</button><button class="btn">${icon("link")}维护单号关系</button></div><div class="detail-grid"><div class="detail-item"><span class="detail-label">成本明细编号</span><span class="detail-value mono">${c.id}</span></div><div class="detail-item"><span class="detail-label">处理状态</span><span class="detail-value">${status(c.status)}</span></div><div class="detail-item"><span class="detail-label">供应商</span><span class="detail-value">${c.supplier}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${getCostBoardLabel(c)}</span></div><div class="detail-item"><span class="detail-label">供应商原始费项</span><span class="detail-value">${c.raw}</span></div><div class="detail-item"><span class="detail-label">标准成本费项</span><span class="detail-value">${c.fee}</span></div><div class="detail-item"><span class="detail-label">关键单号</span><span class="detail-value">${c.keyType} · ${c.key}</span></div><div class="detail-item"><span class="detail-label">原始金额</span><span class="detail-value strong">${money(c.amount,c.currency)}</span></div><div class="detail-item"><span class="detail-label">成本类型</span><span class="detail-value">${tag(c.type,c.type==="直接成本"?"green":"orange")}</span></div><div class="detail-item"><span class="detail-label">归属结果</span><span class="detail-value">${c.target}</span></div></div><div class="drawer-section"><h3>判断依据</h3><div class="inline-note">系统依据供应商侧单号关系提出建议，财务确认后形成当前成本类型。若一笔金额覆盖多个对象且未拆分，即使单号可追溯也应按间接成本处理。</div></div><div class="drawer-section"><h3>原始行快照</h3><div class="detail-grid"><div class="detail-item"><span class="detail-label">原始表头</span><span class="detail-value">追踪号 / ${c.raw} / 币别 / 备注</span></div><div class="detail-item"><span class="detail-label">原始值</span><span class="detail-value">${c.key} / ${c.amount} / ${c.currency} / -</span></div></div></div>`);}

function bucketDrawer(id){
  const p=pools.find(x=>x.id===id);
  if(!p)return;
  const rule=allocationRules.find(item=>item.id===p.ruleId);
  const treatment=p.treatment||"分摊至业务订单";
  const treatmentAction=`<button class="btn primary" data-action="configure-bucket-treatment" data-id="${p.id}">${icon("settings-2")}${p.treatment?"调整处理方式":"确认处理方式"}</button>`;
  const allocationActions=treatment === "分摊至业务订单"?`<button class="btn" data-action="configure-bucket" data-id="${p.id}">${icon("list-checks")}${p.ruleId?"调整采用规则":"确认采用规则"}</button>${p.ruleId?`<button class="btn" data-action="run-allocation" data-id="${p.id}">${icon("play")}预览分摊</button>`:""}`:"";
  const treatmentDetail=treatment === "不分摊"?`<div class="drawer-section"><h3>不分摊确认</h3><div class="detail-grid"><div class="detail-item"><span class="detail-label">不分摊原因</span><span class="detail-value">${p.noAllocationReason||"-"}</span></div><div class="detail-item"><span class="detail-label">确认人</span><span class="detail-value">${p.treatmentConfirmedBy||"-"}</span></div><div class="detail-item"><span class="detail-label">确认时间</span><span class="detail-value">${p.treatmentConfirmedAt||"-"}</span></div>${p.noAllocationNote?`<div class="detail-item detail-full"><span class="detail-label">补充说明</span><span class="detail-value">${escapeHtml(p.noAllocationNote)}</span></div>`:""}</div><div class="inline-note">该分摊集不生成订单分摊结果，金额仍计入成本中心总成本和公司总利润扣减。</div></div>`:`<div class="drawer-section"><h3>采用的分摊规则</h3>${rule?`<div class="detail-grid"><div class="detail-item"><span class="detail-label">规则编号</span><span class="detail-value mono">${rule.id}</span></div><div class="detail-item"><span class="detail-label">规则层级</span><span class="detail-value">${rule.supplier === "全部供应商" ? "基础分摊规则" : "供应商特调分摊规则"}</span></div><div class="detail-item detail-full"><span class="detail-label">候选订单范围</span><span class="detail-value">${rule.scope}</span></div><div class="detail-item"><span class="detail-label">优先分摊因子</span><span class="detail-value">${rule.factor}</span></div><div class="detail-item"><span class="detail-label">兜底分摊因子</span><span class="detail-value">${rule.fallback}</span></div></div>`:`<div class="validation-item warn">${icon("triangle-alert")}尚未确认分摊规则，不能执行分摊。</div>`}</div><div class="drawer-section"><h3>计算边界</h3><div class="inline-note">分摊集只统一规则口径，不合并成本明细的业务范围。系统仍依据每条成本明细自己的金额与范围锚点寻找候选业务订单，再汇总形成分摊结果。</div></div>`;
  showDrawer(`间接成本分摊集 · ${p.id}`,`<div class="header-actions" style="justify-content:flex-start;margin-bottom:12px">${treatmentAction}${allocationActions}</div><div class="detail-grid"><div class="detail-item"><span class="detail-label">所属成本账单</span><span class="detail-value mono">${p.bill}</span></div><div class="detail-item"><span class="detail-label">分摊状态</span><span class="detail-value">${status(p.status)}</span></div><div class="detail-item"><span class="detail-label">处理方式</span><span class="detail-value">${tag(treatment,treatment === "不分摊"?"gray":"blue")}</span></div><div class="detail-item"><span class="detail-label">供应商</span><span class="detail-value">${p.supplier}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${p.board}</span></div><div class="detail-item"><span class="detail-label">标准成本费项</span><span class="detail-value">${p.fee}</span></div><div class="detail-item"><span class="detail-label">币种</span><span class="detail-value">${p.currency}</span></div><div class="detail-item"><span class="detail-label">成本明细</span><span class="detail-value">${p.detailCount} 条</span></div><div class="detail-item"><span class="detail-label">分摊集金额</span><span class="detail-value strong">${p.amount}</span></div><div class="detail-item"><span class="detail-label">当前分摊版本</span><span class="detail-value">${p.version}</span></div></div>${treatmentDetail}`);
}

function ruleDrawer(id) {
  const rule = allocationRules.find(item => item.id === id);
  if (!rule) return;
  const typeLabel = rule.supplier === "全部供应商" ? "基础分摊规则" : "供应商特调分摊规则";
  showDrawer(`分摊规则详情 · ${rule.id}`, `<div class="header-actions" style="justify-content:flex-start;margin-bottom:12px"><button class="btn primary" data-action="edit-rule" data-id="${rule.id}">${icon("pencil")}编辑规则</button></div><div class="detail-grid"><div class="detail-item"><span class="detail-label">规则类型</span><span class="detail-value">${tag(typeLabel, rule.supplier === "全部供应商" ? "blue" : "purple")}</span></div><div class="detail-item"><span class="detail-label">规则状态</span><span class="detail-value">${status(rule.status)}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${rule.board}</span></div><div class="detail-item"><span class="detail-label">标准成本费项</span><span class="detail-value">${rule.fee}</span></div><div class="detail-item"><span class="detail-label">适用供应商</span><span class="detail-value">${rule.supplier}</span></div><div class="detail-item"><span class="detail-label">生效期间</span><span class="detail-value">${rule.effective || "长期有效"}</span></div><div class="detail-item"><span class="detail-label">尾差处理</span><span class="detail-value">${rule.rounding}</span></div></div><div class="drawer-section"><h3>候选业务订单范围</h3><div class="inline-note">${escapeHtml(rule.scope)}</div></div><div class="drawer-section"><h3>分摊因子</h3><div class="detail-grid"><div class="detail-item"><span class="detail-label">优先分摊因子</span><span class="detail-value">${rule.factor}</span></div><div class="detail-item"><span class="detail-label">兜底分摊因子</span><span class="detail-value">${rule.fallback}</span></div></div></div>${rule.supplier !== "全部供应商" ? `<div class="validation-item ok">${icon("badge-check")}该规则命中时优先于同一标准成本费项的基础分摊规则。</div>` : ""}`);
}

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
    <div class="drawer-section"><h3>成本费项别名</h3><div class="tag-row">${getFeeAliases(fee.code).length ? getFeeAliases(fee.code).map(item => tag(escapeHtml(item), "neutral")).join("") : '<span class="fee-alias-empty">-</span>'}</div><div class="inline-note">这些别名用于导入时系统自动识别账单原始字段映射到成本标准字段时参考；最终是否入池仍以财务确认后的导入设置快照为准。</div></div>
    <div class="drawer-section"><h3>映射说明</h3><div class="inline-note">供应商账单中的原始费项名称由各供应商的导入设置快照保存，不在本页单独维护映射入口。财务首次导入并确认后，系统会把原始名称、适用文件特征和对应标准成本费项一起写入快照，供后续导入复用。</div></div>
    <div class="drawer-section"><div class="section-heading"><h3>间接成本分摊规则</h3><button class="btn small" data-action="fee-rules" data-id="${fee.code}">查看全部</button></div><div class="table-wrap"><table class="data-table compact-table"><thead><tr><th>适用层级</th><th>适用供应商</th><th>优先分摊因子</th><th>状态</th></tr></thead><tbody>${ruleRows.map(item => `<tr><td>${item.name}</td><td>${escapeHtml(item.supplier)}</td><td>${item.factor}</td><td>${status(item.status)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty-cell">该费项暂未配置分摊规则</td></tr>`}</tbody></table></div></div>`);
}

function feeFormModal(id = "") {
  const fee = fees.find(item => item.code === id);
  const model = fee || { code: "", name: "", board: "派送成本", definition: "", remark: "", status: "启用" };
  state.pendingAction = { type: "saveFee", id };
  showModal(fee ? `编辑标准成本费项 · ${fee.name}` : "新增标准成本费项", `<div class="inline-note">标准成本费项是成本中心内部统一口径。供应商账单中的原始名称应通过导入设置快照中的费项映射接入，不直接作为费项名称。</div><div class="form-grid fee-form-grid"><div class="field"><label class="required">成本费项编码</label><input id="fee-form-code" class="input mono" value="${escapeHtml(model.code)}" placeholder="例如 COST-DEL-010" ${fee ? "disabled" : ""}></div><div class="field"><label class="required">内部标准名称</label><input id="fee-form-name" class="input" value="${escapeHtml(model.name)}" placeholder="同一成本板块内不可重复"></div><div class="field"><label class="required">成本板块</label><select id="fee-form-board" class="select" ${fee && fee.references ? "disabled" : ""}>${["派送成本","清关成本","海运成本","空运成本","租车成本"].map(item => `<option value="${item}" ${model.board === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field"><label class="required">状态</label><select id="fee-form-status" class="select">${["启用","停用"].map(item => `<option value="${item}" ${model.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field form-span-2"><label class="required">业务定义</label><textarea id="fee-form-definition" class="textarea" placeholder="说明该费项包含和不包含的供应商收费内容">${escapeHtml(model.definition)}</textarea><small class="field-help">业务定义用于导入设置快照中的费项映射和导入确认，应能区分相近但核算含义不同的费用。</small></div><div class="field form-span-2"><label>备注</label><textarea id="fee-form-remark" class="textarea" placeholder="记录板块内的特殊核算口径">${escapeHtml(model.remark || "")}</textarea></div></div>${fee && fee.references ? `<div class="validation-item warn">${icon("lock-keyhole")}该费项已被 ${fee.references} 条成本明细引用，编码和成本板块不可修改；停用只影响后续导入、补录和分摊配置。</div>` : ""}`, fee ? "保存修改" : "确认新增");
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
  showModal(alias ? `编辑供应商导入设置快照中的费项映射 · ${alias.rawName}` : "新增供应商导入设置快照中的费项映射", `<div class="inline-note">只有在业务含义一致时，才将供应商原始名称映射到标准成本费项。同名异义时应通过文件结构或 Sheet 缩小适用范围。</div><div class="form-grid fee-form-grid"><div class="field"><label class="required">供应商</label><select id="alias-form-supplier" class="select">${supplierOptions.map(item => `<option value="${escapeHtml(item)}" ${model.supplier === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></div><div class="field"><label class="required">成本板块</label><select id="alias-form-board" class="select">${["派送成本","清关成本","海运成本","空运成本","租车成本"].map(item => `<option value="${item}" ${model.board === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field"><label class="required">供应商原始费项名称</label><input id="alias-form-raw" class="input" value="${escapeHtml(model.rawName)}" placeholder="原样保留账单中的文本"></div><div class="field"><label class="required">映射至标准成本费项</label><select id="alias-form-fee" class="select">${fees.map(item => `<option value="${item.code}" data-board="${item.board}" ${model.feeCode === item.code ? "selected" : ""}>${item.name} · ${item.board}</option>`).join("")}</select></div><div class="field"><label>文件结构特征</label><input id="alias-form-structure" class="input" value="${escapeHtml(model.structure || "")}" placeholder="同名异义时填写"></div><div class="field"><label>适用 Sheet</label><input id="alias-form-sheet" class="input" value="${escapeHtml(model.sheet || "")}" placeholder="不填写表示全部 Sheet"></div><div class="field"><label class="required">状态</label><select id="alias-form-status" class="select">${["启用","停用"].map(item => `<option value="${item}" ${model.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field form-span-2"><label>业务说明</label><textarea id="alias-form-note" class="textarea" placeholder="首次映射、同名异义或调整映射时说明口径">${escapeHtml(model.note || "")}</textarea></div></div>${alias ? `<div class="validation-item ok">${icon("history")}保存后版本由 V${alias.version} 更新为 V${alias.version + 1}，历史成本明细继续使用导入时的映射快照。</div>` : ""}`, alias ? "保存并生成新版本" : "确认新增");
  syncAliasFeeOptions(model.board, model.feeCode);
}

function feeAliasModal(id) {
  state.feeTab = "index";
  state.aliasKeyword = "";
  closeDrawer();
  renderView();
}

function settleModal(id){state.pendingAction={type:"settleBill",id};const b=bills.find(x=>x.id===id);showModal("登记成本账单结清",`<div class="inline-note">结清只登记供应商账单的资金闭环事实，不会自动确认成本归属或成本已齐。</div><div class="form-grid" style="grid-template-columns:1fr 1fr"><div class="field"><label class="required">本次结清金额</label><input class="input" value="${(Number(b.amount.replaceAll(',',''))-Number(b.settled.replaceAll(',',''))).toFixed(3)}"></div><div class="field"><label class="required">结清币种</label><select class="select"><option>${b.currency}</option></select></div><div class="field"><label class="required">结清日期</label><input class="input" type="date" value="2026-07-17"></div><div class="field"><label class="required">结清方式</label><select class="select"><option>银行转账</option><option>抵扣</option><option>其它</option></select></div><div class="field"><label class="required">成本核销汇率</label><input class="input" value="${b.currency==="CNY"?"1.00000":"0.21780"}"></div><div class="field"><label>付款凭证</label><button class="btn" style="width:100%">${icon("paperclip")}上传凭证</button></div></div><div class="field"><label>备注</label><textarea class="textarea" placeholder="填写供应商付款或抵扣说明"></textarea></div>`,"确认登记");}

function allocationRuleModal(ruleType = "base", id = "") {
  const original = allocationRules.find(item => item.id === id);
  const actualType = original && original.supplier !== "全部供应商" ? "supplier" : ruleType;
  const model = original || { board: "派送成本", fee: "", supplier: actualType === "supplier" ? suppliers.find(item => item.state === "启用")?.name || "" : "全部供应商", scope: "", factor: "订单计费重", fallback: "订单包裹数", rounding: "最大余数法", effective: "2026-07-01 起", status: "启用" };
  const activeFees = fees.filter(item => item.status === "启用");
  if (!model.fee) model.fee = activeFees.find(item => item.board === model.board)?.name || "";
  state.pendingAction = { type: "saveAllocationRule", ruleType: actualType, id };
  const typeLabel = actualType === "supplier" ? "供应商特调分摊规则" : "基础分摊规则";
  const supplierField = actualType === "supplier" ? `<div class="field"><label class="required">适用供应商</label><select id="rule-form-supplier" class="select">${suppliers.filter(item => item.state === "启用").map(item => `<option value="${escapeHtml(item.name)}" ${model.supplier === item.name ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>` : `<div class="field"><label>适用范围</label><input class="input" value="全部供应商" disabled></div>`;
  showModal(`${original ? "编辑" : "新增"}${typeLabel}`, `<div class="inline-note">${actualType === "supplier" ? "该规则仅适用于指定供应商，命中时优先于同口径的基础分摊规则。" : "该规则作为全部供应商的默认口径，仅在未命中供应商特调分摊规则时采用。"}</div>
    <div class="form-grid allocation-form-grid">
      <div class="field"><label class="required">成本板块</label><select id="rule-form-board" class="select">${["派送成本","清关成本","海运成本","空运成本","租车成本"].map(item => `<option value="${item}" ${model.board === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
      <div class="field"><label class="required">标准成本费项</label><select id="rule-form-fee" class="select">${activeFees.map(item => `<option value="${escapeHtml(item.name)}" data-board="${item.board}" ${model.fee === item.name ? "selected" : ""}>${escapeHtml(item.name)} · ${item.board}</option>`).join("")}</select></div>
      ${supplierField}
      <div class="field form-span-2"><label class="required">候选业务订单范围</label><input id="rule-form-scope" class="input" value="${escapeHtml(model.scope)}" placeholder="例如：同一提单覆盖且完成时间落在成本账期内的业务订单"></div>
      <div class="field"><label class="required">优先分摊因子</label><select id="rule-form-factor" class="select">${["订单计费重","订单包裹数","订单占用体积","订单体积","订单实重","订单计费吨","申报金额","占用量 × 仓储天数"].map(item => `<option ${model.factor === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
      <div class="field"><label class="required">兜底分摊因子</label><select id="rule-form-fallback" class="select">${["订单包裹数","订单计费重","订单体积","订单实重","订单数"].map(item => `<option ${model.fallback === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
      <div class="field"><label class="required">生效期间</label><input id="rule-form-effective" class="input" value="${escapeHtml(model.effective || "")}" placeholder="例如：2026-07-01 起"></div>
      <div class="field"><label class="required">尾差处理</label><select id="rule-form-rounding" class="select"><option ${model.rounding === "最大余数法" ? "selected" : ""}>最大余数法</option></select></div>
      <div class="field"><label class="required">状态</label><select id="rule-form-status" class="select">${["启用","停用"].map(item => `<option ${model.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
    </div>`, original ? "保存变更" : "确认新增");
  document.getElementById("modal").classList.add("allocation-config-modal");
  syncRuleFeeOptions(model.board, model.fee);
}

function syncRuleFeeOptions(board, preferredFee = "") {
  const select = document.getElementById("rule-form-fee");
  if (!select) return;
  const matching = [...select.options].filter(option => option.dataset.board === board);
  [...select.options].forEach(option => { option.disabled = option.dataset.board !== board; });
  const preferred = matching.find(option => option.value === preferredFee);
  if (preferred) select.value = preferred.value;
  else if (matching.length) select.value = matching[0].value;
}

function bucketTreatmentModal(id) {
  const bucket = pools.find(item => item.id === id);
  if (!bucket) return;
  const treatment = bucket.treatment || "分摊至业务订单";
  const reasons = ["公司整体管理费用", "无合理分摊依据", "金额较小，无需分摊", "不纳入订单利润核算", "其他"];
  state.pendingAction = { type: "saveBucketTreatment", id };
  showModal("确认间接成本处理方式", `<div class="inline-note">处理方式在分摊集层统一确认，集内成本明细共同继承。这里只提供分摊至业务订单和不分摊，不提供暂不分摊。</div><div class="detail-grid"><div class="detail-item"><span class="detail-label">分摊集编号</span><span class="detail-value mono">${bucket.id}</span></div><div class="detail-item"><span class="detail-label">标准成本费项</span><span class="detail-value">${bucket.fee}</span></div><div class="detail-item"><span class="detail-label">分摊集金额</span><span class="detail-value strong">${bucket.amount}</span></div><div class="detail-item"><span class="detail-label">当前状态</span><span class="detail-value">${status(bucket.status)}</span></div></div><div class="field"><label class="required">处理方式</label><select id="bucket-treatment-select" class="select"><option value="分摊至业务订单" ${treatment === "分摊至业务订单" ? "selected" : ""}>分摊至业务订单</option><option value="不分摊" ${treatment === "不分摊" ? "selected" : ""}>不分摊</option></select></div><div id="bucket-no-allocation-fields" class="${treatment === "不分摊" ? "" : "hidden"}"><div class="field"><label class="required">不分摊原因</label><select id="bucket-no-allocation-reason" class="select"><option value="">请选择原因</option>${reasons.map(item => `<option value="${item}" ${bucket.noAllocationReason === item ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field"><label>补充说明</label><textarea id="bucket-no-allocation-note" class="textarea" placeholder="选择其他时必填">${escapeHtml(bucket.noAllocationNote || "")}</textarea></div><div class="validation-item warn">${icon("triangle-alert")}确认不分摊后，该金额不进入任何业务订单成本或订单利润，但仍计入成本中心总成本和公司总利润扣减。</div></div>`, "确认处理方式");
}

function bucketRuleModal(id) {
  const bucket = pools.find(item => item.id === id);
  if (!bucket) return;
  if (bucket.treatment === "不分摊") { toast("该分摊集已确认为不分摊，无需选择分摊规则", "warning"); return; }
  const matchingRules = allocationRules.filter(rule => rule.status === "启用" && rule.board === bucket.board && rule.fee === bucket.fee && (rule.supplier === bucket.supplier || rule.supplier === "全部供应商"));
  matchingRules.sort((left, right) => Number(right.supplier === bucket.supplier) - Number(left.supplier === bucket.supplier));
  state.pendingAction = { type: "saveBucketRule", id };
  showModal("确认分摊集采用的分摊规则", `<div class="inline-note">系统已按“供应商特调分摊规则 > 基础分摊规则”的优先级给出候选项。确认后，分摊集内所有间接成本明细沿用同一规则版本，但每条明细仍按自身金额和范围锚点独立计算。</div><div class="detail-grid"><div class="detail-item"><span class="detail-label">成本账单</span><span class="detail-value mono">${bucket.bill}</span></div><div class="detail-item"><span class="detail-label">分摊集编号</span><span class="detail-value mono">${bucket.id}</span></div><div class="detail-item"><span class="detail-label">标准成本费项</span><span class="detail-value">${bucket.fee}</span></div><div class="detail-item"><span class="detail-label">币种</span><span class="detail-value">${bucket.currency}</span></div><div class="detail-item"><span class="detail-label">成本明细</span><span class="detail-value">${bucket.detailCount} 条</span></div></div><div class="field"><label class="required">采用的分摊规则</label><select id="bucket-rule-select" class="select">${matchingRules.map(rule => `<option value="${rule.id}" ${bucket.ruleId === rule.id ? "selected" : ""}>${rule.id} · ${rule.supplier === bucket.supplier ? "供应商特调" : "基础"} · ${rule.factor}</option>`).join("")}</select></div>${matchingRules.length ? `<div class="validation-list"><div class="validation-item ok">${icon("circle-check")}已找到 ${matchingRules.length} 条适用规则，列表已按命中优先级排序</div></div>` : `<div class="validation-item warn">${icon("triangle-alert")}当前没有适用规则，请先到“分摊规则”页面新增或启用规则。</div>`}`, "确认规则");
  document.getElementById("modal-confirm")?.toggleAttribute("disabled", matchingRules.length === 0);
}

function allocationModal(id){
  const p=pools.find(x=>x.id===id);
  if(p?.treatment==="不分摊"){toast("该分摊集已确认为不分摊，不执行金额分摊","warning");return;}
  if(!p?.ruleId){toast("请先确认该分摊集采用的分摊规则","warning");return;}
  state.pendingAction={type:"runAllocation",id};
  showModal("分摊预览",`<div class="preview-summary" style="grid-template-columns:repeat(4,1fr)"><div class="preview-metric"><span>成本明细</span><strong>${p.detailCount}</strong></div><div class="preview-metric"><span>候选业务订单</span><strong>${p.orders}</strong></div><div class="preview-metric"><span>分摊集金额</span><strong>${p.amount}</strong></div><div class="preview-metric"><span>金额差异</span><strong style="color:var(--success)">0.000</strong></div></div><div class="validation-list"><div class="validation-item ok">${icon("circle-check")}已锁定规则 ${p.ruleId}，候选订单范围不为空</div><div class="validation-item ok">${icon("circle-check")}每条成本明细按自身范围锚点独立筛选候选订单</div><div class="validation-item ok">${icon("circle-check")}分摊集内逐明细计算后汇总，${p.currency} 金额守恒</div><div class="validation-item ok">${icon("circle-check")}尾差按最大余数法处理</div></div><div class="inline-note">执行后生成新的分摊版本，结果只落到业务订单，用于计算业务订单利润。</div>`,"执行分摊");
}

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
  else if(a==="open-supplier") supplierDrawer(id); else if(a==="new-supplier") supplierFormModal(); else if(a==="edit-supplier"){closeDrawer();supplierFormModal(id);} else if(a==="open-bill"){state.selectedBillId=id;state.billDetailTab="summary";state.view="billDetail";closeDrawer();renderView();} else if(a==="back-bills"){state.view="bills";renderView();} else if(a==="bill-detail-tab"){state.billDetailTab=el.dataset.value;renderView();} else if(a==="open-cost") costDrawer(id); else if(a==="open-bucket") bucketDrawer(id);
  else if(a==="select-file"){
    state.selectedFile=id;
    const file=sampleFiles.find(x=>x.id===id);
    const sourceBill=initialData.bills.find(item=>item.file===file?.name);
    state.selectedSheet=file.defaultSheet;
    if(sourceBill?.period) {
      [state.inferredCostPeriodStart,state.inferredCostPeriodEnd]=sourceBill.period.split(" 至 ");
      [state.costPeriodStart,state.costPeriodEnd]=[state.inferredCostPeriodStart,state.inferredCostPeriodEnd];
      state.costPeriodAdjusted=false;
      state.costPeriodDifferenceNote="";
    }
    openImportModal();
  }
  else if(a==="select-sheet"){state.selectedSheet=id;openImportModal();}
  else if(a==="wizard-next"){
    if(state.wizardStep===1){
      state.costPeriodDifferenceNote=document.getElementById("cost-period-note")?.value.trim()||"";
      if(state.costPeriodAdjusted&&!state.costPeriodDifferenceNote){toast("实际成本账期与推导值不一致，请填写账期差异说明","warning");return;}
    }
    state.wizardStep=Math.min(3,state.wizardStep+1);openImportModal();
  }
  else if(a==="wizard-back"){state.wizardStep=Math.max(1,state.wizardStep-1);openImportModal();}
  else if(a==="confirm-import"){const file=sampleFiles.find(item=>item.id===state.selectedFile);const sourceBill=initialData.bills.find(item=>item.file===file?.name);state.pendingAction={type:"importBill"};showModal("确认导入供应商账单",`<div class="validation-list"><div class="validation-item ok">${icon("circle-check")}导入将按整批原子方式执行</div><div class="validation-item ok">${icon("circle-check")}完全成功后形成一张成本账单及 ${sourceBill?.rows || 0} 条成本明细</div></div><div class="inline-note">导入成功后可在成本账单列表查看结果；任一应导入数据失败时，本次不保留部分成本明细。</div>`,"开始导入");}
  else if(a==="bill-filter"){state.billFilter=el.dataset.value;renderView();}
  else if(a==="rule-type-tab"){state.ruleTab=el.dataset.value;state.ruleSupplier="";renderView();}
  else if(a==="rule-query"){state.ruleKeyword=document.getElementById("rule-keyword")?.value.trim()||"";state.ruleBoard=document.getElementById("rule-board-filter")?.value||"";state.ruleSupplier=document.getElementById("rule-supplier-filter")?.value||"";state.ruleStatus=document.getElementById("rule-status-filter")?.value||"";renderView();}
  else if(a==="rule-reset"){state.ruleKeyword="";state.ruleBoard="";state.ruleSupplier="";state.ruleStatus="";renderView();}
  
  else if(a==="fee-board-tab"){state.feeBoard=el.dataset.value||"";renderView();}
  else if(a==="fee-query"){state.feeCodeKeyword=document.getElementById("fee-code-keyword")?.value.trim()||"";state.feeNameKeyword=document.getElementById("fee-name-keyword")?.value.trim()||"";state.feeStatus=document.getElementById("fee-status")?.value||"";renderView();}
  else if(a==="fee-reset"){state.feeCodeKeyword="";state.feeNameKeyword="";state.feeStatus="";renderView();}
  
  
  else if(a==="settle-bill") settleModal(id);
  else if(a==="run-allocation") allocationModal(id);
  else if(a==="configure-bucket-treatment"){closeDrawer();bucketTreatmentModal(id);}
  else if(a==="configure-bucket"){closeDrawer();bucketRuleModal(id);}
  else if(a==="allocation-rules"){state.view="rules";renderView();}
  else if(a==="new-allocation-rule") allocationRuleModal(el.dataset.type || state.ruleTab);
  else if(a==="open-rule") ruleDrawer(id);
  else if(a==="edit-rule"){closeDrawer();allocationRuleModal("base",id);}
  else if(a==="toggle-cost"){state.pendingAction={type:"toggleCost",id};const c=costs.find(x=>x.id===id);showModal("切换成本类型",`<div class="inline-note">当前为${c.type}。切换前系统会重新校验供应商侧单号关系，并解除原业务对象归属或分摊集关系。</div><div class="field"><label class="required">目标成本类型</label><select class="select"><option>${c.type==="直接成本"?"间接成本":"直接成本"}</option></select></div><div class="field"><label class="required">切换原因</label><textarea class="textarea" placeholder="说明单号关系、覆盖范围或金额粒度发生了什么变化"></textarea></div>`,"确认切换");}
  else if(a==="open-fee") feeDrawer(id);
  else if(a==="new-fee") feeFormModal();
  else if(a==="edit-fee") feeFormModal(id);
  
  
  
  else if(a==="toggle-fee"){const fee=fees.find(item=>item.code===id);state.pendingAction={type:"toggleFee",id};showModal(`${fee.status==="启用"?"停用":"启用"}标准成本费项`, `<div class="validation-item warn">${icon("triangle-alert")}${fee.status==="启用"?"停用后，后续账单导入、成本补录和分摊配置不能再选择该费项；历史成本明细与映射快照不变。":"启用后，该费项重新允许用于后续导入、补录和分摊配置。"}</div><div class="detail-grid"><div class="detail-item"><span class="detail-label">成本费项</span><span class="detail-value">${fee.name}</span></div><div class="detail-item"><span class="detail-label">成本板块</span><span class="detail-value">${fee.board}</span></div></div>`, `确认${fee.status==="启用"?"停用":"启用"}`);}
  
  else if(a==="fee-rules") feeDrawer(id);
  else if(a==="reanalyze") toast("已基于当前文件重新识别字段，原快照尚未被覆盖");
  else if(a==="modal-confirm") await commitPendingAction();
  else if(["profit-detail","switch-org"].includes(a)) toast("该入口已纳入原型交互范围，可继续按场景深化","warning");
});
document.addEventListener("change", event => {
  if (event.target.id === "bucket-treatment-select") document.getElementById("bucket-no-allocation-fields")?.classList.toggle("hidden", event.target.value !== "不分摊");
  if (event.target.id === "rule-form-board") syncRuleFeeOptions(event.target.value);
  if (event.target.id === "supplier-form-cycle") syncSupplierCycleFields();
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


