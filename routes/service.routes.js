const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/service.controller');
const auth = require("../middlewares/auth.middleware");


router.post('/generate', auth({ allowedRoles: ['superAdmin'] }), ctrl.generateServices);
router.post('/generate-all', auth({ allowedRoles: ['superAdmin'] }), ctrl.generateServicesForAllActiveRoutes);

// Listar servicios
router.get('/', auth(), ctrl.getServices);
router.get('/filter', auth(), ctrl.getServicesByFilter);
router.get('/available-destinations', auth(), ctrl.getAvailableDestinations);
router.get('/:id', auth(), ctrl.getServicesByID);

// tripulacion
router.put('/:id/assign', auth({ allowedRoles: ['superAdmin', 'admin'] }), ctrl.assignBusAndCrew);

// far
router.put('/:id/far', auth({ allowedRoles: ['superAdmin', 'admin'] }), ctrl.assignFar);
router.put('/:id/far/expenses', auth({ allowedRoles: ['superAdmin', 'admin'] }), ctrl.addFarExpenses);


module.exports = router;
