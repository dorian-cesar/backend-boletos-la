const express = require('express');
const router = express.Router();

// routers
const authRoutes = require('./auth.routes');
const busLayout = require('./busLayout.routes');
const routeMaster = require('./routeMaster.routes');
const seat = require('./seat.routes');
const service = require('./service.routes');
const user = require('./user.routes');
const bus = require('./bus.routes');
const city = require('./city.routes');
const gds = require('./gds.routes');

// auth middleware
const auth = require('../middlewares/auth.middleware');

router.use('/auth', authRoutes); // maneja su propio auth en sus rutas
router.use('/users', auth({ allowedRoles: ['superAdmin', 'admin'] }), user);
router.use('/cities', auth({ allowedRoles: ['superAdmin', 'admin'] }), city);
router.use('/bus-layout', auth({ allowedRoles: ['superAdmin', 'admin'] }), busLayout);
router.use('/buses', auth({ allowedRoles: ['superAdmin', 'admin'] }), bus);
router.use('/route-masters', auth({ allowedRoles: ['superAdmin', 'admin'] }), routeMaster);
router.use('/services', service); // maneja su propio auth en sus rutas
router.use('/seats', auth(), seat);
router.use('/gds', gds);

module.exports = router;
