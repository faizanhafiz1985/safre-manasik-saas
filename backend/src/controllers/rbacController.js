const prisma = require('../config/database');
const { FEATURES, ACTIONS, FEATURE_KEYS, DEFAULT_PERMISSIONS } = require('../config/permissions');
const { getTenantQuota } = require('../middleware/quota');
const { invalidateRoleCache } = require('../services/permissionService');

const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

async function audit(req, action, entityId, payload) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: req.user.tenantId, userId: req.user.id,
        action, entityType: 'rbac', entityId: entityId || null,
        payload: payload ? JSON.stringify(payload).slice(0, 4000) : null,
        ipAddress: req.ip, userAgent: req.headers['user-agent'] || null,
      },
    });
  } catch { /* audit must never break the request */ }
}

// Lazily ensure a tenant has its three built-in system roles (covers tenants
// created after the last server boot).
async function ensureTenantSystemRoles(tenantId) {
  for (const key of ['ADMIN', 'AGENT', 'CUSTOMER']) {
    let role = await prisma.tenantRole.findFirst({ where: { tenantId, key } });
    if (!role) {
      role = await prisma.tenantRole.create({
        data: { tenantId, key, name: key.charAt(0) + key.slice(1).toLowerCase(), isSystem: true },
      });
      const data = [...DEFAULT_PERMISSIONS[key]].map((p) => {
        const [feature, action] = p.split(':');
        return { tenantId, roleId: role.id, feature, action };
      });
      if (data.length) await prisma.rolePermission.createMany({ data, skipDuplicates: true });
    }
  }
}

// GET /rbac/catalog — features (with plan-lock state) + actions
const getCatalog = async (req, res, next) => {
  try {
    const quota = await getTenantQuota(req.user.tenantId).catch(() => null);
    const planFeatures = quota?.features || {};
    const features = FEATURE_KEYS.map((key) => {
      const m = FEATURES[key];
      return {
        key, label: m.label || key,
        adminOnly: !!m.adminOnly,
        planLocked: !!(m.plan && !planFeatures[m.plan]),
        plan: m.plan || null,
      };
    });
    res.json({ features, actions: ACTIONS });
  } catch (err) { next(err); }
};

// GET /rbac/roles — all tenant roles + their grants + user counts
const listRoles = async (req, res, next) => {
  try {
    await ensureTenantSystemRoles(req.user.tenantId);
    const roles = await prisma.tenantRole.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { permissions: true, _count: { select: { users: true } } },
    });
    res.json(roles.map((r) => ({
      id: r.id, key: r.key, name: r.name, description: r.description,
      isSystem: r.isSystem, isActive: r.isActive, userCount: r._count.users,
      permissions: r.permissions.map((p) => `${p.feature}:${p.action}`),
    })));
  } catch (err) { next(err); }
};

const createRole = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Role name is required' });
    const key = `custom_${slugify(name)}_${Math.random().toString(36).slice(2, 6)}`;
    const role = await prisma.tenantRole.create({
      data: { tenantId: req.user.tenantId, key, name: name.trim(), description: description || null, isSystem: false },
    });
    await audit(req, 'role.created', role.id, { name: role.name });
    res.status(201).json(role);
  } catch (err) { next(err); }
};

const updateRole = async (req, res, next) => {
  try {
    const role = await prisma.tenantRole.findFirst({ where: { id: req.params.id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    const { name, description, isActive } = req.body;
    const data = {};
    if (name !== undefined && name.trim()) data.name = name.trim();
    if (description !== undefined) data.description = description;
    // System roles cannot be deactivated (lockout protection); custom roles can.
    if (isActive !== undefined && !role.isSystem) data.isActive = !!isActive;
    data.updatedAt = new Date();
    await prisma.tenantRole.updateMany({ where: { id: req.params.id }, data });
    const updated = await prisma.tenantRole.findFirst({ where: { id: req.params.id } });
    await audit(req, 'role.updated', role.id, data);
    res.json(updated);
  } catch (err) { next(err); }
};

// PUT /rbac/roles/:id/permissions  body: { permissions: ["feature:action", ...] }
const setPermissions = async (req, res, next) => {
  try {
    const role = await prisma.tenantRole.findFirst({ where: { id: req.params.id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const incoming = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    // Validate + apply governance guards.
    const clean = [];
    for (const p of incoming) {
      const [feature, action] = String(p).split(':');
      if (!FEATURE_KEYS.includes(feature) || !ACTIONS.includes(action)) continue; // unknown → drop
      // Governance: custom roles cannot be granted admin-only features
      // (prevents non-admins from gaining roles/users/settings control).
      if (FEATURES[feature].adminOnly && !role.isSystem) {
        return res.status(403).json({ error: `Feature "${feature}" cannot be granted to a custom role` });
      }
      clean.push({ tenantId: req.user.tenantId, roleId: role.id, feature, action });
    }

    // Lockout protection: the ADMIN system role must always keep roles + users control.
    if (role.isSystem && role.key === 'ADMIN') {
      for (const must of ['roles:view', 'roles:edit', 'users:view']) {
        const [f, a] = must.split(':');
        if (!clean.some((c) => c.feature === f && c.action === a)) clean.push({ tenantId: req.user.tenantId, roleId: role.id, feature: f, action: a });
      }
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      ...(clean.length ? [prisma.rolePermission.createMany({ data: clean, skipDuplicates: true })] : []),
    ]);
    invalidateRoleCache(role.id);
    await audit(req, 'role.permissions_changed', role.id, { count: clean.length, permissions: clean.map((c) => `${c.feature}:${c.action}`) });
    res.json({ message: 'Permissions updated', permissions: clean.map((c) => `${c.feature}:${c.action}`) });
  } catch (err) { next(err); }
};

const deleteRole = async (req, res, next) => {
  try {
    const role = await prisma.tenantRole.findFirst({ where: { id: req.params.id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    if (role.isSystem) return res.status(403).json({ error: 'Built-in roles cannot be deleted' });
    // FK ON DELETE SET NULL demotes affected users back to their legacy role.
    await prisma.tenantRole.deleteMany({ where: { id: req.params.id } });
    invalidateRoleCache(role.id);
    await audit(req, 'role.deleted', role.id, { name: role.name });
    res.json({ message: 'Role deleted; affected users reverted to their built-in role' });
  } catch (err) { next(err); }
};

// PUT /rbac/users/:id/role  body: { customRoleId: string | null }
const assignUserRole = async (req, res, next) => {
  try {
    const { customRoleId } = req.body;
    const target = await prisma.user.findFirst({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'Cannot change a super admin' });

    if (customRoleId) {
      const role = await prisma.tenantRole.findFirst({ where: { id: customRoleId } });
      if (!role) return res.status(400).json({ error: 'Role not found for this tenant' });
      if (!role.isActive) return res.status(400).json({ error: 'Role is inactive' });
    }
    await prisma.user.updateMany({ where: { id: req.params.id }, data: { customRoleId: customRoleId || null } });
    await audit(req, 'user.role_assigned', req.params.id, { customRoleId: customRoleId || null });
    res.json({ message: 'Role assigned' });
  } catch (err) { next(err); }
};

module.exports = { getCatalog, listRoles, createRole, updateRole, setPermissions, deleteRole, assignUserRole, ensureTenantSystemRoles };
