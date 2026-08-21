export const billingBaseRateFixtures = [
  { pair: 'USD / CNY', direction: 'USD -> CNY', rate: 7.1846, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '生效', current: '是', operator: '谭清辉' },
  { pair: 'GBP / CNY', direction: 'GBP -> CNY', rate: 9.4628, source: '手动添加', sourceAt: '2026-08-02 09:12', status: '生效', current: '是', operator: '郑雅雯' },
  { pair: 'CAD / CNY', direction: 'CAD -> CNY', rate: 5.2184, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '待确认', current: '否', operator: '谭清辉' },
  { pair: 'AUD / CNY', direction: 'CNY -> AUD', rate: 0.2146, source: '手动添加', sourceAt: '2026-08-01 16:20', status: '停用', current: '否', operator: '郑雅雯' },
]

export const billingRateFixtures = [
  { id: 'R-001', scopeType: 'STORE', scope: ['星际货运(中转)'], pair: 'USD / CNY', direction: 'USD -> CNY', method: '百分比缩放', adjustDirection: '上浮', adjustValue: 1.5, base: 7.1846, result: 7.292369, status: '启用', operator: '谭清辉', updatedAt: '2026-08-02 09:28' },
  { id: 'R-002', scopeType: 'GROUP', scope: ['台湾大客户组'], pair: 'GBP / CNY', direction: 'GBP -> CNY', method: '固定汇率差', adjustDirection: '下浮', adjustValue: 0.02, base: 9.4628, result: 9.4428, status: '启用', operator: '郑雅雯', updatedAt: '2026-08-01 18:41' },
  { id: 'R-003', scopeType: 'CUSTOMER', scope: ['OG4155 OceanGate Logistics'], pair: 'GBP / CNY', direction: 'GBP -> CNY', method: '固定汇率值', adjustDirection: '直接指定', adjustValue: 9.6, base: '--', result: 9.6, status: '停用', operator: '谭清辉', updatedAt: '2026-07-30 11:02' },
  { id: 'R-004', scopeType: 'STORE', scope: ['星际中转2', '台湾集运店'], pair: 'CAD / CNY', direction: 'CAD -> CNY', method: '固定汇率差', adjustDirection: '上浮', adjustValue: 0.01, base: 5.2184, result: 5.2284, status: '启用', operator: '郑雅雯', updatedAt: '2026-08-01 16:35' },
  { id: 'R-005', scopeType: 'CUSTOMER', scope: ['TK9012 TopKing Supply'], pair: 'USD / CNY', direction: 'USD -> CNY', method: '百分比缩放', adjustDirection: '下浮', adjustValue: 1, base: 7.1846, result: 7.112754, status: '启用', operator: '谭清辉', updatedAt: '2026-08-02 09:40' },
]
