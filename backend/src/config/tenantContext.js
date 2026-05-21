const { AsyncLocalStorage } = require('async_hooks');

const tenantContext = new AsyncLocalStorage();

const runWithTenant = (ctx, fn) => tenantContext.run(ctx, fn);
const getTenantId = () => tenantContext.getStore()?.tenantId || null;
const getUserId = () => tenantContext.getStore()?.userId || null;
const isSuperAdmin = () => tenantContext.getStore()?.isSuperAdmin === true;
const getContext = () => tenantContext.getStore() || {};

module.exports = { tenantContext, runWithTenant, getTenantId, getUserId, isSuperAdmin, getContext };
