import { beforeAll, describe, expect, it } from 'vitest';
import { createDataLayer } from './index';

describe('data layer', () => {
  const layer = createDataLayer();
  const { api, keys, queryClient } = layer;
  beforeAll(() => api.ready(), 30000);
  it('loads catalog metadata and counts', async () => {
    const catalog = await api.catalog();
    const orders = catalog.find(t => t.name === 'orders')!;
    expect(orders.rowCount).toBe(800);
    expect(orders.columns.find(c => c.name === 'customer_id')).toMatchObject({ nullable: false, references: { table: 'customers', column: 'id' } });
    expect(catalog.find(t => t.name === 'customers')!.referencedBy).toContainEqual({ table: 'orders', column: 'customer_id' });
  });
  it('describes outgoing and incoming relations', async () => {
    const order = await api.record('orders','61');
    const relations = await api.relations('orders',order!);
    expect(relations).toContainEqual({ label: 'Customer', table: 'customers', where: {id:61} });
    expect(relations).toContainEqual({ label: 'Address', table: 'addresses', where: {id:61} });
    const customer = await api.record('customers','61');
    expect(await api.relations('customers',customer!)).toContainEqual({label:'Orders by this customer',table:'orders',where:{customer_id:61}});
  });
  it('invalidates affected entities and lists without touching products', async () => {
    const opts = {where:{customer_id:61}};
    const customer = await queryClient.fetchQuery({queryKey:keys.record('customers','61'), queryFn:() => api.record('customers','61')});
    await queryClient.fetchQuery({queryKey:keys.relations('customers','61'), queryFn:() => api.relations('customers',customer!)});
    await queryClient.fetchQuery({queryKey:keys.rows('customers',{}), queryFn:() => api.rows('customers',{})});
    await queryClient.fetchQuery({queryKey:keys.rows('orders',opts), queryFn:() => api.rows('orders',opts)});
    await queryClient.fetchQuery({queryKey:keys.rows('products',{}), queryFn:() => api.rows('products',{})});
    await layer.invalidateEntities(await api.updateRow('customers','61',{name:'Changed'}));
    for (const k of [keys.record('customers','61'),keys.relations('customers','61'),keys.rows('customers',{}),keys.rows('orders',opts)]) expect(queryClient.getQueryState(k)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keys.rows('products',{}))?.isInvalidated).toBe(false);
  });
  it('shares result slices and updates identifiable rows without rerunning SQL', async () => {
    const handle = await api.run('SELECT * FROM customers WHERE id = 61');
    const before = layer.stats();
    expect(api.resultRows(handle.runId,0,1)[0]?.name).toBe('Changed');
    expect(api.resultRows(handle.runId,0,1)[0]).toBe(api.resultRows(handle.runId,0,1)[0]);
    expect(layer.stats().fetches).toBe(before.fetches);
    expect(layer.stats().cacheHits).toBeGreaterThan(before.cacheHits);
    await api.updateRow('customers','61',{name:'Again'});
    expect(api.resultRows(handle.runId,0,1)[0]?.name).toBe('Again');
  });
  it('reports trigger-written audit entities', async () => {
    const changed = await api.updateRow('products','1',{price_cents:1234});
    expect(changed).toContainEqual({table:'products',id:'1'});
    expect(changed).toContainEqual({table:'audit_log',id:'121'});
  });
});
