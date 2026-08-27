const unique = values => [...new Set(values.filter(Boolean))]

export function customerRelationsFor(customer = {}) {
  const source = customer.relations || customer.customerRelations || []
  if (source.length) {
    return source.map(relation => ({
      store:relation.store || relation.shop || '',
      group:relation.group || relation.customerGroup || '',
      memberCode:relation.memberCode || relation.member || '',
    }))
  }
  const store = customer.store || customer.shop || ''
  const group = customer.group || customer.customerGroup || ''
  const memberCode = customer.memberCode || ''
  return store || group || memberCode ? [{ store, group, memberCode }] : []
}

export function customerRelationSummary(customer = {}) {
  const relations = customerRelationsFor(customer)
  return {
    relations,
    stores:unique([...(customer.stores || customer.shops || []), ...relations.map(item => item.store)]),
    groups:unique([...(customer.groups || customer.customerGroups || []), ...relations.map(item => item.group)]),
    memberCodes:unique([...(customer.memberCodes || []), ...relations.map(item => item.memberCode)]),
  }
}

export function matchCustomerRelations(customer, { stores = [], groups = [] } = {}) {
  const summary = customerRelationSummary(customer)
  const storeValues = Array.isArray(stores) ? stores : stores ? [stores] : []
  const groupValues = Array.isArray(groups) ? groups : groups ? [groups] : []
  const matchedRelations = summary.relations.filter(relation => (
    (!storeValues.length || storeValues.includes(relation.store))
    && (!groupValues.length || groupValues.includes(relation.group))
  ))
  return {
    ...summary,
    matchedRelations:storeValues.length || groupValues.length ? matchedRelations : summary.relations,
    matches:!storeValues.length && !groupValues.length ? true : matchedRelations.length > 0,
  }
}

export function formatCustomerRelations(relations = []) {
  return relations.map(relation => [relation.store, relation.group, relation.memberCode].filter(Boolean).join(' / ')).join('；') || '-'
}
