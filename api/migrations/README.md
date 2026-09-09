# Migrations
Use YYYYMMDDHHMM-description.js names and ES-module up({ context }) / down({ context }) exports.
Context is the Sequelize query interface. Use transactions where supported.
Never edit applied migrations or use sync({ alter: true }) / sync({ force: true }) in production.
Run npm run db:migrate once per deployment before starting the new API.
Business tables will be introduced with their features; none are defined yet.
