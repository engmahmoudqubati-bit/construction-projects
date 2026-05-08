require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const runMigration = require('./db/runMigration');

const app = express();

app.use(cors());
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth',            require('./routes/auth'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/projects',        require('./routes/projects'));
app.use('/api/classifications', require('./routes/classifications'));
app.use('/api/items',           require('./routes/items'));
app.use('/api/measurements',     require('./routes/measurements'));
app.use('/api/planning',        require('./routes/planning'));
app.use('/api/delivery',        require('./routes/delivery'));
app.use('/api/installation',    require('./routes/installation'));
app.use('/api/inspection',      require('./routes/inspection'));
app.use('/api/dashboard',       require('./routes/dashboard'));
app.use('/api/reports',         require('./routes/reports'));
app.use('/api/companies',       require('./routes/companies'));
app.use('/api/position-roles',  require('./routes/positionRoles'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;

runMigration().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
});