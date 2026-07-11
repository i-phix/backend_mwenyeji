const {
  addDailyChecklist,
  createParent,
  addChildrenToParent,
  addSingleChild,
} = require("./add_daily_checklist");
const { getDailyChecklist, getParentData } = require("./get_daily_checklist");
const { updateSingleChild } = require("./update_daily_checklist");
const {
  addReading,
  getReadingHistory,
  updateReading,
  deleteReading,
  getCurrentValues,
} = require("./readings");

module.exports = {
  addDailyChecklist,
  getDailyChecklist,
  getParentData,
  createParent,
  addChildrenToParent,
  addSingleChild,
  updateSingleChild,
  addReading,
  getReadingHistory,
  updateReading,
  deleteReading,
  getCurrentValues,
};
