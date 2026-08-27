export const billingBaseRateFixtures = [
  { pair: 'USD / CNY', direction: 'USD -> CNY', rate: 7.1846, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '生效', current: '是' },
  { pair: 'GBP / CNY', direction: 'GBP -> CNY', rate: 9.4628, source: '手动添加', sourceAt: '2026-08-02 09:12', status: '生效', current: '是' },
  { pair: 'CAD / CNY', direction: 'CAD -> CNY', rate: 5.2184, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '待确认', current: '否' },
  { pair: 'AUD / CNY', direction: 'CNY -> AUD', rate: 0.2146, source: '手动添加', sourceAt: '2026-08-01 16:20', status: '停用', current: '否' },
]

export const billingRateFixtures = [
  { id:'R-001', customerCode:'OG4155', customerName:'OceanGate Logistics', store:'星际货运(中转)', group:'台湾大客户组', sourceType:'MASTER', sourceName:'台湾客户特调母版', sourceNo:'RATE-MASTER-20260801-01', masterId:'RM-001', version:'V2', pair:'USD / CNY', direction:'USD -> CNY', method:'百分比缩放', adjustDirection:'上浮', adjustValue:1.5, base:7.1846, result:7.292369, status:'启用' },
  { id:'R-002', customerCode:'TK9012', customerName:'TopKing Supply', store:'星际中转2', group:'日本同行组', sourceType:'CUSTOM', sourceName:'客户自定义特调', sourceNo:'RATE-CUSTOM-TK9012', version:'V3', pair:'GBP / CNY', direction:'GBP -> CNY', method:'固定汇率差', adjustDirection:'下浮', adjustValue:0.02, base:9.4628, result:9.4428, status:'启用' },
  { id:'R-003', customerCode:'NW2048', customerName:'NorthWind Cargo', store:'台湾集运店', group:'美国电商组', sourceType:'MASTER', sourceName:'固定约定汇率母版', sourceNo:'RATE-MASTER-20260715-02', masterId:'RM-002', version:'V1', pair:'GBP / CNY', direction:'GBP -> CNY', method:'固定汇率值', adjustDirection:'直接指定', adjustValue:9.6, base:'--', result:9.6, status:'启用' },
  { id:'R-004', customerCode:'OG0271', customerName:'渣渣辉3号', store:'星际货运(中转)', group:'台湾大客户组', sourceType:'MASTER', sourceName:'台湾客户特调母版', sourceNo:'RATE-MASTER-20260801-01', masterId:'RM-001', version:'V1', pair:'CAD / CNY', direction:'CAD -> CNY', method:'固定汇率差', adjustDirection:'上浮', adjustValue:0.01, base:5.2184, result:5.2284, status:'启用' },
  { id:'R-005', customerCode:'OG0370', customerName:'JYK-深圳立杰海快', store:'星际中转2', group:'日本同行组', sourceType:'NONE', sourceName:'未配置', sourceNo:'-', version:'-', pair:'-', direction:'-', method:'-', adjustDirection:'-', adjustValue:'-', base:'--', result:null, status:'未配置' },
]

export const billingRateMasterFixtures = [
  { id:'RM-001', no:'RATE-MASTER-20260801-01', name:'台湾客户特调母版', version:'V2', rangeMode:'STORE', rangeValues:['星际货运(中转)','台湾集运店'], rangeText:'店铺：星际货运(中转)、台湾集运店', rules:2, direction:'USD -> CNY', method:'百分比缩放', adjustDirection:'上浮', adjustValue:1.5, base:7.1846, result:7.292369, status:'启用', updatedAt:'2026-08-01 10:18' },
  { id:'RM-002', no:'RATE-MASTER-20260715-02', name:'固定约定汇率母版', version:'V1', rangeMode:'GROUP', rangeValues:['美国电商组'], rangeText:'客户组：美国电商组', rules:1, direction:'GBP -> CNY', method:'固定汇率值', adjustDirection:'直接指定', adjustValue:9.6, base:'--', result:9.6, status:'启用', updatedAt:'2026-07-15 11:05' },
]
