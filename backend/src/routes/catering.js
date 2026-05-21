const router = require('express').Router();
const ctrl = require('../controllers/cateringController');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope, requireTenant } = require('../middleware/tenant');

router.use(authenticate, tenantScope, requireTenant);
router.get('/vendors', ctrl.getVendors);
router.get('/vendors/:id', ctrl.getVendor);
router.post('/vendors', authorize('ADMIN'), ctrl.createVendor);
router.put('/vendors/:id', authorize('ADMIN'), ctrl.updateVendor);
router.delete('/vendors/:id', authorize('ADMIN'), ctrl.deleteVendor);

router.get('/meal-plans', ctrl.getMealPlans);
router.post('/meal-plans', authorize('ADMIN'), ctrl.createMealPlan);
router.put('/meal-plans/:id', authorize('ADMIN'), ctrl.updateMealPlan);
router.delete('/meal-plans/:id', authorize('ADMIN'), ctrl.deleteMealPlan);

module.exports = router;
