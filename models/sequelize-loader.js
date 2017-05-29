//複数のモデルをそれぞれ別のファイルに記述したいので、このファイルにはsequelize の読み込みの定義を書く
'use strict';
const Sequelize = require('sequelize');
const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost/schedule_arranger',
  { logging: true });

module.exports = {
  database: sequelize,
  Sequelize: Sequelize
};