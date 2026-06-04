const router = require('express').Router();
const ctrl = require('../controllers/cateringController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');
const { requirePermission } = require('../middleware/permission');

router.use(authenticate, tenantScope, requireTenant);
router.get('/vendors', requirePermission('catering', 'view'), ctrl.getVendors);
router.get('/vendors/:id', requirePermission('catering', 'view'), ctrl.getVendor);
router.post('/vendors', authorize('ADMIN'), requirePermission('catering', 'create'), ctrl.createVendor);
router.put('/vendors/:id', authorize('ADMIN'), requirePermission('catering', 'edit'), ctrl.updateVendor);
router.delete('/vendors/:id', authorize('ADMIN'), requirePermission('catering', 'delete'), ctrl.deleteVendor);

router.get('/meal-plans', requirePermission('catering', 'view'), ctrl.getMealPlans);
router.post('/meal-plans', authorize('ADMIN'), requirePermission('catering', 'create'), ctrl.createMealPlan);
router.put('/meal-plans/:id', authorize('ADMIN'), requirePermission('catering', 'edit'), ctrl.updateMealPlan);
router.delete('/meal-plans/:id', authorize('ADMIN'), requirePermission('catering', 'delete'), ctrl.deleteMealPlan);

module.exports = router;
