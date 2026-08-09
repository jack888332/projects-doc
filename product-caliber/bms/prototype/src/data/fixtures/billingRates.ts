export const billingBaseRateFixtures = [
  { pair: 'USD / CNY', direction: 'USD -> CNY', rate: 7.1846, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '生效', current: '是', operator: '谭清辉' },
  { pair: 'GBP / CNY', direction: 'GBP -> CNY', rate: 9.4628, source: '手动添加', sourceAt: '2026-08-02 09:12', status: '生效', current: '是', operator: '郑雅雯' },
  { pair: 'CAD / CNY', direction: 'CAD -> CNY', rate: 5.2184, source: '手动导入', sourceAt: '2026-08-02 09:00', status: '待确认', current: '否', operator: '谭清辉' },
  { pair: 'AUD / CNY', direction: 'CNY -> AUD', rate: 0.2146, source: '手动添加', sourceAt: '2026-08-01 16:20', status: '停用', current: '否', operator: '郑雅雯' },
]

export const billingCustomerRateFixtures = [
  { customerNo: 'OG4155', customer: 'OceanGate Logistics', shop: '深圳集运店', pair: 'GBP / CNY', direction: 'GBP -> CNY', method: '百分比缩放', adjustDirection: '上浮', adjustValue: '1.5%', base: 9.4628, result: 9.604742, status: '启用', operator: '谭清辉', updatedAt: '2026-08-02 09:28' },
  { customerNo: 'TK9012', customer: 'TopKing Supply', shop: '义乌集运店', pair: 'USD / CNY', direction: 'USD -> CNY', method: '固定汇率差', adjustDirection: '下浮', adjustValue: '0.0200', base: 7.1846, result: 7.1646, status: '启用', operator: '郑雅雯', updatedAt: '2026-08-01 18:41' },
  { customerNo: 'NW2048', customer: 'NorthWind Cargo', shop: '上海集运店', pair: 'CAD / CNY', direction: 'CAD -> CNY', method: '固定汇率值', adjustDirection: '直接指定', adjustValue: '5.2500', base: '--', result: 5.25, status: '停用', operator: '谭清辉', updatedAt: '2026-07-30 11:02' },
]
