const router = require('express').Router();
const ctrl = require('../controllers/rbacController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

// All RBAC management is ADMIN-only (authorize backstop) AND permission-gated.
router.use(authenticate, tenantScope, requireTenant);

router.get('/catalog', ctrl.getCatalog);
router.get('/roles', authorize('ADMIN'), requirePermission('roles', 'view'), ctrl.listRoles);
router.post('/roles', authorize('ADMIN'), requirePermission('roles', 'create'), ctrl.createRole);
router.put('/roles/:id', authorize('ADMIN'), requirePermission('roles', 'edit'), ctrl.updateRole);
router.put('/roles/:id/permissions', authorize('ADMIN'), requirePermission('roles', 'edit'), ctrl.setPermissions);
router.delete('/roles/:id', authorize('ADMIN'), requirePermission('roles', 'delete'), ctrl.deleteRole);
router.put('/users/:id/role', authorize('ADMIN'), requirePermission('users', 'edit'), ctrl.assignUserRole);

module.exports = router;
